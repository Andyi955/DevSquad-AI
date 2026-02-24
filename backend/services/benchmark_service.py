"""
Benchmark Service
Manages benchmark test suites and orchestrates benchmark runs against agents.
"""

import json
import shutil
import uuid
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from services.scoring_engine import ScoringEngine


class BenchmarkService:
    """
    Manages benchmark test suites and orchestrates runs.
    - Loads benchmark definitions from JSON files
    - Runs benchmarks via the orchestrator
    - Scores results via the review service
    - Records scores via the scoring engine
    """
    
    def __init__(self, orchestrator=None, review_service=None, scoring_engine: ScoringEngine = None, file_manager=None):
        self.orchestrator = orchestrator
        self.review_service = review_service
        self.scoring_engine = scoring_engine or ScoringEngine()
        self.file_manager = file_manager
        
        self.benchmarks_dir = Path(__file__).parent.parent / "benchmarks"
        self.sandbox_dir = self.benchmarks_dir / "sandbox"
        self.benchmarks: Dict[str, List[Dict]] = {}
        
        # Current run state
        self.current_run: Optional[Dict[str, Any]] = None
        self._lock = asyncio.Lock()
        self._stop_requested = False
        self._original_workspace = None
        
        # Load benchmark definitions
        self._load_benchmarks()
    
    def _load_benchmarks(self):
        """Load all benchmark JSON files from the benchmarks directory"""
        self.benchmarks = {}
        
        if not self.benchmarks_dir.exists():
            print("⚠️ [BenchmarkService] No benchmarks directory found")
            return
        
        for json_file in self.benchmarks_dir.glob("*_benchmarks.json"):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    benchmarks = json.load(f)
                
                # Extract suite name from filename (e.g. "python" from "python_benchmarks.json")
                suite_name = json_file.stem.replace("_benchmarks", "")
                self.benchmarks[suite_name] = benchmarks
                
                print(f"📋 [BenchmarkService] Loaded {len(benchmarks)} {suite_name} benchmarks")
            except Exception as e:
                print(f"❌ [BenchmarkService] Failed to load {json_file}: {e}")
    
    def list_suites(self) -> Dict[str, Any]:
        """List all available benchmark suites"""
        suites = {}
        for suite_name, benchmarks in self.benchmarks.items():
            suites[suite_name] = {
                "count": len(benchmarks),
                "benchmarks": [
                    {
                        "id": b["id"],
                        "language": b["language"],
                        "category": b["category"],
                        "difficulty": b["difficulty"],
                        "weight": b["weight"]
                    }
                    for b in benchmarks
                ]
            }
        
        total = sum(len(b) for b in self.benchmarks.values())
        return {
            "suites": suites,
            "total_benchmarks": total
        }
    
    def get_all_benchmarks(self, suite: str = "all") -> List[Dict]:
        """Get all benchmarks in a suite or across all suites"""
        # Normalize suite name (e.g. "python_benchmarks" -> "python")
        if suite and suite != "all" and suite.endswith("_benchmarks"):
            suite = suite.replace("_benchmarks", "")
            
        if suite == "all":
            all_b = []
            for b_list in self.benchmarks.values():
                all_b.extend(b_list)
            return all_b
        
        return self.benchmarks.get(suite, [])
    
    # ── Sandbox Workspace Management ─────────────────────────────────
    
    def _setup_sandbox(self, run_id: str) -> Path:
        """
        Create a sandbox workspace for benchmark runs.
        Agents need a real workspace to create files, use terminal, etc.
        """
        sandbox_path = self.sandbox_dir / run_id
        sandbox_path.mkdir(parents=True, exist_ok=True)
        
        # Save current workspace so we can restore it
        if self.file_manager:
            self._original_workspace = self.file_manager.workspace_path
            self.file_manager.set_workspace(sandbox_path)
            print(f"📦 [BenchmarkService] Sandbox workspace set: {sandbox_path}")
        
        return sandbox_path
    
    def _teardown_sandbox(self, sandbox_path: Path = None):
        """
        Restore original workspace and clean up sandbox.
        """
        if self.file_manager:
            if self._original_workspace:
                self.file_manager.set_workspace(self._original_workspace)
                print(f"♻️ [BenchmarkService] Restored workspace: {self._original_workspace}")
            else:
                self.file_manager.detach_workspace()
                print(f"♻️ [BenchmarkService] Detached workspace (no previous workspace)")
            self._original_workspace = None
        
        # Clean up sandbox files (keep the directory structure for debugging)
        if sandbox_path and sandbox_path.exists():
            try:
                shutil.rmtree(sandbox_path, ignore_errors=True)
                print(f"🧹 [BenchmarkService] Cleaned up sandbox: {sandbox_path}")
            except Exception as e:
                print(f"⚠️ [BenchmarkService] Sandbox cleanup failed: {e}")
    
    def stop(self):
        """Stop the current benchmark suite run."""
        self._stop_requested = True
        # Also stop the orchestrator if it's mid-turn
        if self.orchestrator:
            self.orchestrator.stop()
        
        # Update current run status immediately if possible
        if self.current_run:
            self.current_run["status"] = "stopped"
            
        print("🛑 [BenchmarkService] Stop requested and status updated")
    
    async def run_suite(self, suite: str = "all", auto_mode: bool = False) -> Dict[str, Any]:
        """
        Run a benchmark suite.
        
        Args:
            suite: Suite name ('python', 'javascript', 'go', 'all')
            auto_mode: If True, runs all benchmarks back-to-back without pausing
                       If False, yields after each benchmark for approval
                       
        Returns:
            Dict with run_id, status, and results
        """
        run_id = str(uuid.uuid4())[:12]
        benchmarks = self.get_all_benchmarks(suite)
        self._stop_requested = False
        
        if not benchmarks:
            return {"status": "error", "message": f"No benchmarks found for suite: {suite}"}
        
        async with self._lock:
            self.current_run = {
                "run_id": run_id,
                "suite": suite,
                "auto_mode": auto_mode,
                "status": "running",
                "started_at": datetime.now().isoformat(),
                "total": len(benchmarks),
                "completed": 0,
                "current_benchmark": None,
                "results": [],
                "errors": []
            }
        
        print(f"🏁 [BenchmarkService] Starting run {run_id}: {len(benchmarks)} benchmarks ({suite}), auto_mode={auto_mode}")
        
        # Setup sandbox workspace so agents can actually use files/terminal
        sandbox_path = self._setup_sandbox(run_id)
        
        try:
            # Run benchmarks
            for i, benchmark in enumerate(benchmarks):
                # Check stop flag
                if self._stop_requested:
                    print(f"🛑 [BenchmarkService] Stopped after {i} benchmarks")
                    async with self._lock:
                        self.current_run["status"] = "stopped"
                    break
                
                try:
                    async with self._lock:
                        self.current_run["current_benchmark"] = benchmark["id"]
                    
                    print(f"🔬 [BenchmarkService] [{i+1}/{len(benchmarks)}] Running: {benchmark['id']}")
                    
                    # Clear orchestrator state for fresh evaluation
                    if self.orchestrator:
                        self.orchestrator.clear_history()
                    
                    result = await self._run_single_benchmark(run_id, benchmark)
                    
                    if self._stop_requested:
                        async with self._lock:
                            self.current_run["status"] = "stopped"
                        break

                    async with self._lock:
                        self.current_run["results"].append(result)
                        self.current_run["completed"] = i + 1
                    
                    if not auto_mode and i < len(benchmarks) - 1:
                        # In manual mode, mark as paused after each benchmark
                        async with self._lock:
                            self.current_run["status"] = "paused"
                        print(f"⏸️ [BenchmarkService] Paused after {benchmark['id']}. Call /api/benchmarks/resume to continue.")
                        return self.get_status()
                        
                except Exception as e:
                    error_msg = f"Benchmark {benchmark['id']} failed: {str(e)}"
                    print(f"❌ [BenchmarkService] {error_msg}")
                    async with self._lock:
                        self.current_run["errors"].append(error_msg)
                        self.current_run["completed"] = i + 1
            
            # All done (if not stopped)
            async with self._lock:
                if self.current_run["status"] != "stopped":
                    self.current_run["status"] = "completed"
                self.current_run["finished_at"] = datetime.now().isoformat()
            
            print(f"✅ [BenchmarkService] Run {run_id} completed: {len(self.current_run['results'])} scored")
        
        finally:
            # Always teardown sandbox, even on error
            self._teardown_sandbox(sandbox_path)
        
        return self.get_status()
    
    async def resume_run(self) -> Dict[str, Any]:
        """Resume a paused benchmark run (for manual mode)"""
        if not self.current_run:
            return {"error": "No active benchmark run"}
        
        if self.current_run["status"] != "paused":
            return {"error": f"Run is not paused, status: {self.current_run['status']}"}
        
        suite = self.current_run["suite"]
        auto_mode = self.current_run["auto_mode"]
        run_id = self.current_run["run_id"]
        completed = self.current_run["completed"]
        
        all_benchmarks = self.get_all_benchmarks(suite)
        remaining = all_benchmarks[completed:]
        
        # Re-setup sandbox workspace for resumed run
        sandbox_path = self._setup_sandbox(run_id)
        
        async with self._lock:
            self.current_run["status"] = "running"
        
        try:
            for i, benchmark in enumerate(remaining):
                if self._stop_requested:
                    async with self._lock:
                        self.current_run["status"] = "stopped"
                    break
                
                actual_index = completed + i
                try:
                    async with self._lock:
                        self.current_run["current_benchmark"] = benchmark["id"]
                    
                    print(f"🔬 [BenchmarkService] [{actual_index+1}/{len(all_benchmarks)}] Running: {benchmark['id']}")
                    
                    # Clear orchestrator state for fresh evaluation
                    if self.orchestrator:
                        self.orchestrator.clear_history()
                    
                    result = await self._run_single_benchmark(run_id, benchmark)
                    
                    if self._stop_requested:
                        async with self._lock:
                            self.current_run["status"] = "stopped"
                        break

                    async with self._lock:
                        self.current_run["results"].append(result)
                        self.current_run["completed"] = actual_index + 1
                    
                    if not auto_mode and i < len(remaining) - 1:
                        async with self._lock:
                            self.current_run["status"] = "paused"
                        return self.get_status()
                        
                except Exception as e:
                    error_msg = f"Benchmark {benchmark['id']} failed: {str(e)}"
                    async with self._lock:
                        self.current_run["errors"].append(error_msg)
                        self.current_run["completed"] = actual_index + 1
            
            async with self._lock:
                if self.current_run["status"] != "stopped":
                    self.current_run["status"] = "completed"
                self.current_run["finished_at"] = datetime.now().isoformat()
        
        finally:
            self._teardown_sandbox(sandbox_path)
        
        return self.get_status()
    
    async def _run_single_benchmark(self, run_id: str, benchmark: Dict) -> Dict[str, Any]:
        """
        Run a single benchmark task: send to agents, collect response, score it.
        """
        import traceback
        benchmark_id = benchmark["id"]
        prompt = benchmark["prompt"]
        
        # Send the benchmark prompt to the orchestrator
        # This simulates a user sending the benchmark task
        response_chunks = []
        
        if self.orchestrator:
            try:
                async for chunk in self.orchestrator.process_message_stream(prompt, benchmark_mode=True):
                    response_chunks.append(chunk)
            except Exception as e:
                print(f"⚠️ [BenchmarkService] Orchestrator error on {benchmark_id}: {e}")
                print(f"⚠️ [BenchmarkService] Traceback: {traceback.format_exc()}")
                # fall through with empty response for scoring
        
        # Now trigger a review of the conversation
        review_data = {}
        if self.review_service and self.orchestrator:
            try:
                review_data = await self.review_service.trigger_review(
                    self.orchestrator.conversation
                )
            except Exception as e:
                print(f"⚠️ [BenchmarkService] Review failed for {benchmark_id}: {e}")
                review_data = {"reviews": [], "overall_summary": f"Review failed: {e}"}
        
        # Extract agent scores from the review
        agent_scores = {}
        for review in review_data.get("reviews", []):
            agent_name = review.get("agent_name", "Unknown")
            score = review.get("score", 0)
            agent_scores[agent_name] = score
        
        # Record the score in the scoring engine
        scored_result = self.scoring_engine.record_score(
            run_id=run_id,
            benchmark_id=benchmark_id,
            category=benchmark.get("category", "code_gen"),
            difficulty=benchmark.get("difficulty", "medium"),
            weight=benchmark.get("weight", 1.0),
            agent_scores=agent_scores,
            raw_review=review_data
        )
        
        return scored_result
    
    def get_status(self) -> Dict[str, Any]:
        """Get status of the current benchmark run"""
        if not self.current_run:
            return {"status": "idle", "message": "No benchmark run in progress"}
        
        # Derive an overall score for this suite run so other services
        # (like the OptimizationLoop) can treat a suite as a single scalar.
        # Each entry in `results` is the dict returned by ScoringEngine.record_score.
        overall_score = 0.0
        if self.current_run["results"]:
            raw_scores = [
                r.get("overall_raw_score", 0) 
                for r in self.current_run["results"]
                if isinstance(r, dict)
            ]
            if raw_scores:
                overall_score = round(sum(raw_scores) / len(raw_scores), 2)
        
        return {
            "run_id": self.current_run["run_id"],
            "suite": self.current_run["suite"],
            "auto_mode": self.current_run["auto_mode"],
            "status": self.current_run["status"],
            "started_at": self.current_run["started_at"],
            "finished_at": self.current_run.get("finished_at"),
            "progress": {
                "completed": self.current_run["completed"],
                "total": self.current_run["total"],
                "current": self.current_run.get("current_benchmark"),
                "percent": round(self.current_run["completed"] / self.current_run["total"] * 100, 1) if self.current_run["total"] > 0 else 0
            },
            "results_count": len(self.current_run["results"]),
            "overall_score": overall_score,
            "errors": self.current_run["errors"]
        }
    
    def get_results(self, limit: int = 50) -> Dict[str, Any]:
        """Get all historical benchmark results for charting"""
        return {
            "chart_data": self.scoring_engine.get_chart_data(),
            "history": self.scoring_engine.get_history(limit=limit),
            "trend": self.scoring_engine.get_trend(),
            "agent_summary": self.scoring_engine.get_agent_summary()
        }
    
    def compare(self, run_id_a: str, run_id_b: str) -> Dict[str, Any]:
        """Compare two benchmark runs"""
        return self.scoring_engine.compare_runs(run_id_a, run_id_b)
