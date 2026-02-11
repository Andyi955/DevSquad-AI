"""
Optimization Loop Service
Iterative prompt optimization via evaluate-then-edit cycles.
TextGrad/DSPy-style: agents run → review scores → optimizer edits prompts → repeat.
"""

import asyncio
import json
import shutil
import uuid
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class OptimizationLoop:
    """
    Closed-loop prompt optimizer.
    
    Flow:
    1. Snapshot current prompts (version control)
    2. Run benchmark suite
    3. Review Agent scores the result
    4. If score < target: Optimizer edits prompts
    5. Repeat until convergence or max_iterations
    6. Restore best-scoring prompt version
    """

    def __init__(self, orchestrator, benchmark_service, scoring_engine):
        self.orchestrator = orchestrator
        self.benchmark_service = benchmark_service
        self.scoring_engine = scoring_engine

        # Directories
        self.prompts_dir = Path(__file__).parent.parent / "prompts"
        self.versions_dir = self.prompts_dir / "versions"
        self.versions_dir.mkdir(parents=True, exist_ok=True)

        # Loop state
        self.current_run: Optional[Dict] = None
        self.run_history: List[Dict] = []
        self._history_file = Path(__file__).parent.parent / "data" / "optimization_runs.json"
        self._load_history()

        # Control
        self._stop_requested = False
        self._waiting_for_approval = False
        self._approval_event = asyncio.Event()
        self._approved = False

    # ── History Persistence ─────────────────────────────────────────

    def _load_history(self):
        """Load past optimization runs from disk."""
        try:
            if self._history_file.exists():
                with open(self._history_file, "r", encoding="utf-8") as f:
                    self.run_history = json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load optimization history: {e}")
            self.run_history = []

    def _save_history(self):
        """Persist optimization runs to disk."""
        try:
            self._history_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self._history_file, "w", encoding="utf-8") as f:
                json.dump(self.run_history, f, indent=2, default=str)
        except Exception as e:
            logger.warning(f"Failed to save optimization history: {e}")

    # ── Prompt Versioning ───────────────────────────────────────────

    def _snapshot_prompts(self, version_label: str) -> Path:
        """Copy all prompts/*.md → prompts/versions/{version_label}/"""
        version_dir = self.versions_dir / version_label
        version_dir.mkdir(parents=True, exist_ok=True)

        for prompt_file in self.prompts_dir.glob("*.md"):
            shutil.copy2(prompt_file, version_dir / prompt_file.name)

        logger.info(f"📸 Snapshot prompts → {version_dir}")
        return version_dir

    def _restore_prompts(self, version_label: str) -> bool:
        """Restore prompts from a version snapshot."""
        version_dir = self.versions_dir / version_label
        if not version_dir.exists():
            logger.error(f"Version {version_label} not found")
            return False

        for prompt_file in version_dir.glob("*.md"):
            shutil.copy2(prompt_file, self.prompts_dir / prompt_file.name)

        logger.info(f"♻️ Restored prompts from {version_label}")
        return True

    # ── Convergence Detection ───────────────────────────────────────

    def _detect_convergence(self, scores: List[float], threshold: float = 2.0, window: int = 2) -> bool:
        """Stop early if score delta < threshold for `window` consecutive iterations."""
        if len(scores) < window + 1:
            return False

        recent = scores[-(window + 1):]
        deltas = [abs(recent[i + 1] - recent[i]) for i in range(len(recent) - 1)]

        converged = all(d < threshold for d in deltas)
        if converged:
            logger.info(f"🎯 Convergence detected: deltas {deltas} all < {threshold}")
        return converged

    # ── Main Loop ───────────────────────────────────────────────────

    async def run(
        self,
        suite_id: str = "python_benchmarks",
        max_iterations: int = 5,
        target_score: float = 85.0,
        auto_apply: bool = False
    ) -> Dict[str, Any]:
        """
        Run the optimization loop.
        
        Args:
            suite_id: Benchmark suite to use as the evaluation task
            max_iterations: Max epochs before stopping
            target_score: Stop if score >= this
            auto_apply: If True, auto-apply optimizer changes. If False, pause for approval each iteration.
        """
        run_id = uuid.uuid4().hex[:8]
        self._stop_requested = False

        self.current_run = {
            "run_id": run_id,
            "suite_id": suite_id,
            "max_iterations": max_iterations,
            "target_score": target_score,
            "auto_apply": auto_apply,
            "status": "running",
            "started_at": datetime.now().isoformat(),
            "current_iteration": 0,
            "iterations": [],
            "best_version": None,
            "best_score": 0.0,
            "final_score": 0.0
        }

        scores = []

        try:
            for iteration in range(1, max_iterations + 1):
                if self._stop_requested:
                    self.current_run["status"] = "stopped"
                    break

                self.current_run["current_iteration"] = iteration
                version_label = f"{run_id}_v{iteration}"

                # 1. Snapshot current prompts
                self._snapshot_prompts(version_label)

                # 2. Run benchmark suite
                logger.info(f"🔄 Iteration {iteration}/{max_iterations} — Running benchmarks...")
                self.current_run["status"] = f"running_iteration_{iteration}"

                bench_result = await self.benchmark_service.run_suite(suite_id, auto_mode=True)
                if not bench_result or bench_result.get("status") == "error":
                    logger.error(f"Benchmark run failed at iteration {iteration}")
                    iteration_data = {
                        "iteration": iteration,
                        "version": version_label,
                        "score": 0,
                        "error": "Benchmark run failed",
                        "changes": []
                    }
                    self.current_run["iterations"].append(iteration_data)
                    continue

                # 3. Get score from the benchmark run
                score = bench_result.get("overall_score", 0)
                scores.append(score)

                # Track best version
                if score > self.current_run["best_score"]:
                    self.current_run["best_score"] = score
                    self.current_run["best_version"] = version_label

                iteration_data = {
                    "iteration": iteration,
                    "version": version_label,
                    "score": score,
                    "changes": [],
                    "applied": False
                }

                logger.info(f"📊 Iteration {iteration}: Score = {score:.1f} (target: {target_score})")

                # 4. Check if we've hit the target
                if score >= target_score:
                    logger.info(f"🎉 Target score reached! {score:.1f} >= {target_score}")
                    iteration_data["note"] = "Target score reached"
                    self.current_run["iterations"].append(iteration_data)
                    self.current_run["status"] = "converged"
                    break

                # 5. Check convergence
                if self._detect_convergence(scores):
                    iteration_data["note"] = "Converged (score plateau)"
                    self.current_run["iterations"].append(iteration_data)
                    self.current_run["status"] = "converged"
                    break

                # 6. Run optimizer to propose prompt edits
                self.current_run["status"] = f"optimizing_iteration_{iteration}"
                opt_result = await self.orchestrator.run_optimization_analysis()
                changes = opt_result.get("changes", [])
                iteration_data["changes"] = changes

                if not changes:
                    logger.info("No changes proposed by optimizer")
                    iteration_data["note"] = "No changes proposed"
                    self.current_run["iterations"].append(iteration_data)
                    continue

                # 7. Apply changes (auto or manual approval)
                if auto_apply:
                    # Auto-apply all changes
                    for change in changes:
                        await self.orchestrator.optimizer.apply_optimization(change)
                    iteration_data["applied"] = True
                    logger.info(f"⚡ Auto-applied {len(changes)} changes")
                else:
                    # Wait for manual approval
                    self._waiting_for_approval = True
                    self._approval_event.clear()
                    self.current_run["status"] = f"waiting_approval_iteration_{iteration}"

                    logger.info(f"⏸️ Waiting for approval of {len(changes)} changes...")

                    # Block until approval/rejection signal
                    try:
                        await asyncio.wait_for(self._approval_event.wait(), timeout=3600)  # 1hr timeout
                    except asyncio.TimeoutError:
                        logger.warning("Approval timeout — stopping loop")
                        self.current_run["status"] = "timeout"
                        self.current_run["iterations"].append(iteration_data)
                        break

                    self._waiting_for_approval = False

                    if self._approved:
                        for change in changes:
                            await self.orchestrator.optimizer.apply_optimization(change)
                        iteration_data["applied"] = True
                        logger.info(f"✅ Approved and applied {len(changes)} changes")
                    else:
                        iteration_data["applied"] = False
                        iteration_data["note"] = "Changes rejected by user"
                        logger.info("❌ Changes rejected — continuing to next iteration")

                self.current_run["iterations"].append(iteration_data)

            # 8. Restore best prompt version (best-of-N selection)
            if self.current_run["best_version"]:
                self._restore_prompts(self.current_run["best_version"])
                logger.info(f"♻️ Restored best prompts: {self.current_run['best_version']} "
                           f"(score: {self.current_run['best_score']:.1f})")

            self.current_run["final_score"] = scores[-1] if scores else 0
            if self.current_run["status"].startswith("running") or \
               self.current_run["status"].startswith("optimizing"):
                self.current_run["status"] = "completed"
            self.current_run["finished_at"] = datetime.now().isoformat()

        except Exception as e:
            logger.error(f"Optimization loop error: {e}")
            self.current_run["status"] = "error"
            self.current_run["error"] = str(e)

        # Save to history
        self.run_history.append(self.current_run)
        self._save_history()

        result = dict(self.current_run)
        self.current_run = None
        return result

    # ── Control Methods ─────────────────────────────────────────────

    def approve_iteration(self):
        """Approve the pending prompt changes."""
        self._approved = True
        self._approval_event.set()

    def reject_iteration(self):
        """Reject the pending prompt changes."""
        self._approved = False
        self._approval_event.set()

    def stop(self):
        """Stop the loop after the current iteration finishes."""
        self._stop_requested = True
        # Also unblock if waiting for approval
        if self._waiting_for_approval:
            self._approved = False
            self._approval_event.set()

    def get_status(self) -> Dict[str, Any]:
        """Get current loop status."""
        if self.current_run:
            return {
                "active": True,
                "run_id": self.current_run["run_id"],
                "status": self.current_run["status"],
                "current_iteration": self.current_run["current_iteration"],
                "max_iterations": self.current_run["max_iterations"],
                "target_score": self.current_run["target_score"],
                "auto_apply": self.current_run["auto_apply"],
                "best_score": self.current_run["best_score"],
                "scores": [it["score"] for it in self.current_run["iterations"]],
                "waiting_for_approval": self._waiting_for_approval,
                "pending_changes": (
                    self.current_run["iterations"][-1]["changes"]
                    if self._waiting_for_approval and self.current_run["iterations"]
                    else []
                )
            }
        return {"active": False, "status": "idle"}

    def get_history(self) -> List[Dict]:
        """Get all past optimization runs."""
        return self.run_history
