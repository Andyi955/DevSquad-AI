"""
Scoring Engine
Robust weighted scoring system with persistence and trend detection.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
import statistics


class ScoringEngine:
    """
    Robust scoring system with:
    - Weighted scores per category
    - Per-agent tracking over time
    - Persistent JSON history
    - Trend detection (improving/degrading/stable)
    """
    
    CATEGORY_WEIGHTS = {
        "code_gen": 1.0,
        "debugging": 1.2,
        "refactoring": 1.0,
        "terminal_usage": 1.5  # Critical skill, weigh higher
    }
    
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.scores_file = self.data_dir / "benchmark_scores.json"
        
        # Ensure file exists
        if not self.scores_file.exists():
            with open(self.scores_file, 'w') as f:
                json.dump({"runs": []}, f)
    
    def _load_scores(self) -> Dict[str, Any]:
        """Load scores from persistent storage"""
        try:
            with open(self.scores_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {"runs": []}
    
    def _save_scores(self, data: Dict[str, Any]):
        """Save scores to persistent storage"""
        with open(self.scores_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    
    def record_score(
        self,
        run_id: str,
        benchmark_id: str,
        category: str,
        difficulty: str,
        weight: float,
        agent_scores: Dict[str, Any],
        raw_review: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Record a scored benchmark result.
        
        Args:
            run_id: Unique ID for this benchmark run session
            benchmark_id: ID of the specific benchmark (e.g. 'py_fizzbuzz')
            category: Benchmark category (e.g. 'code_gen')
            difficulty: 'easy', 'medium', 'hard'
            weight: Score multiplier from benchmark definition
            agent_scores: Dict of {agent_name: score} from the review
            raw_review: Full review JSON from the Review Agent
            
        Returns:
            Dict with the weighted overall score and per-agent breakdowns
        """
        
        category_weight = self.CATEGORY_WEIGHTS.get(category, 1.0)
        combined_weight = weight * category_weight
        
        # Calculate weighted scores per agent
        weighted_agent_scores = {}
        for agent_name, score in agent_scores.items():
            weighted_score = round(score * combined_weight, 2)
            weighted_agent_scores[agent_name] = {
                "raw_score": score,
                "weight": combined_weight,
                "weighted_score": weighted_score
            }
        
        # Overall weighted average
        if agent_scores:
            raw_avg = sum(agent_scores.values()) / len(agent_scores)
            weighted_avg = round(raw_avg * combined_weight, 2)
        else:
            raw_avg = 0
            weighted_avg = 0
        
        record = {
            "run_id": run_id,
            "benchmark_id": benchmark_id,
            "category": category,
            "difficulty": difficulty,
            "weight": combined_weight,
            "timestamp": datetime.now().isoformat(),
            "overall_raw_score": round(raw_avg, 2),
            "overall_weighted_score": weighted_avg,
            "agent_scores": weighted_agent_scores,
            "review_summary": raw_review.get("overall_summary", ""),
            "reviews": raw_review.get("reviews", [])
        }
        
        # Persist
        data = self._load_scores()
        data["runs"].append(record)
        
        # Keep last 500 records to avoid unbounded growth
        data["runs"] = data["runs"][-500:]
        self._save_scores(data)
        
        print(f"📊 [ScoringEngine] Recorded {benchmark_id}: raw={raw_avg:.1f}, weighted={weighted_avg:.1f}")
        
        return record
    
    def get_history(self, agent_name: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get score history for charting.
        
        Args:
            agent_name: Filter to specific agent (None = all)
            limit: Max records to return
            
        Returns:
            List of score records, newest first
        """
        data = self._load_scores()
        runs = data.get("runs", [])
        
        if agent_name:
            # Filter to only runs that include this agent
            runs = [r for r in runs if agent_name in r.get("agent_scores", {})]
        
        # Return newest first, limited
        return list(reversed(runs[-limit:]))
    
    def get_chart_data(self, agent_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Get data formatted for the dashboard line chart.
        
        Returns:
            {
                "labels": [timestamps],
                "datasets": {
                    "Agent Name": [scores],
                    ...
                },
                "overall": [scores]
            }
        """
        data = self._load_scores()
        runs = data.get("runs", [])
        
        if not runs:
            return {"labels": [], "datasets": {}, "overall": []}
        
        labels = []
        overall_scores = []
        agent_datasets: Dict[str, List] = {}
        
        for run in runs:
            labels.append(run["timestamp"])
            overall_scores.append(run["overall_raw_score"])
            
            for agent, score_data in run.get("agent_scores", {}).items():
                if agent not in agent_datasets:
                    # Backfill with None for previous entries
                    agent_datasets[agent] = [None] * (len(labels) - 1)
                agent_datasets[agent].append(score_data["raw_score"])
            
            # Fill None for agents not in this run
            for agent in agent_datasets:
                if len(agent_datasets[agent]) < len(labels):
                    agent_datasets[agent].append(None)
        
        return {
            "labels": labels,
            "datasets": agent_datasets,
            "overall": overall_scores
        }
    
    def get_trend(self, agent_name: Optional[str] = None, last_n: int = 10) -> Dict[str, Any]:
        """
        Calculate if scores are improving, degrading, or stable.
        
        Returns:
            {
                "direction": "improving" | "degrading" | "stable",
                "slope": float,
                "delta": float (last - first),
                "avg_score": float,
                "min_score": float,
                "max_score": float
            }
        """
        data = self._load_scores()
        runs = data.get("runs", [])[-last_n:]
        
        if len(runs) < 2:
            return {
                "direction": "insufficient_data",
                "slope": 0,
                "delta": 0,
                "avg_score": runs[0]["overall_raw_score"] if runs else 0,
                "min_score": runs[0]["overall_raw_score"] if runs else 0,
                "max_score": runs[0]["overall_raw_score"] if runs else 0
            }
        
        if agent_name:
            scores = []
            for r in runs:
                agent_data = r.get("agent_scores", {}).get(agent_name)
                if agent_data:
                    scores.append(agent_data["raw_score"])
        else:
            scores = [r["overall_raw_score"] for r in runs]
        
        if len(scores) < 2:
            return {
                "direction": "insufficient_data",
                "slope": 0,
                "delta": 0,
                "avg_score": scores[0] if scores else 0,
                "min_score": scores[0] if scores else 0,
                "max_score": scores[0] if scores else 0
            }
        
        # Simple linear regression slope
        n = len(scores)
        x_mean = (n - 1) / 2
        y_mean = sum(scores) / n
        
        numerator = sum((i - x_mean) * (s - y_mean) for i, s in enumerate(scores))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        
        slope = numerator / denominator if denominator != 0 else 0
        delta = scores[-1] - scores[0]
        
        # Classify trend
        if abs(slope) < 0.5:
            direction = "stable"
        elif slope > 0:
            direction = "improving"
        else:
            direction = "degrading"
        
        return {
            "direction": direction,
            "slope": round(slope, 3),
            "delta": round(delta, 2),
            "avg_score": round(statistics.mean(scores), 2),
            "min_score": round(min(scores), 2),
            "max_score": round(max(scores), 2)
        }
    
    def compare_runs(self, run_id_a: str, run_id_b: str) -> Dict[str, Any]:
        """
        Side-by-side comparison of two benchmark runs.
        
        Returns:
            {
                "run_a": {...},
                "run_b": {...},
                "delta": {agent: score_diff, ...},
                "improved_agents": [...],
                "degraded_agents": [...]
            }
        """
        data = self._load_scores()
        
        run_a = None
        run_b = None
        
        for run in data.get("runs", []):
            if run["run_id"] == run_id_a and run_a is None:
                run_a = run
            elif run["run_id"] == run_id_b and run_b is None:
                run_b = run
        
        if not run_a or not run_b:
            return {"error": "One or both run IDs not found"}
        
        # Calculate deltas
        all_agents = set(
            list(run_a.get("agent_scores", {}).keys()) + 
            list(run_b.get("agent_scores", {}).keys())
        )
        
        deltas = {}
        improved = []
        degraded = []
        
        for agent in all_agents:
            score_a = run_a.get("agent_scores", {}).get(agent, {}).get("raw_score", 0)
            score_b = run_b.get("agent_scores", {}).get(agent, {}).get("raw_score", 0)
            diff = round(score_b - score_a, 2)
            deltas[agent] = diff
            
            if diff > 2:
                improved.append(agent)
            elif diff < -2:
                degraded.append(agent)
        
        return {
            "run_a": {
                "run_id": run_id_a,
                "benchmark_id": run_a.get("benchmark_id"),
                "overall_score": run_a.get("overall_raw_score"),
                "timestamp": run_a.get("timestamp")
            },
            "run_b": {
                "run_id": run_id_b,
                "benchmark_id": run_b.get("benchmark_id"),
                "overall_score": run_b.get("overall_raw_score"),
                "timestamp": run_b.get("timestamp")
            },
            "overall_delta": round(
                run_b.get("overall_raw_score", 0) - run_a.get("overall_raw_score", 0), 2
            ),
            "agent_deltas": deltas,
            "improved_agents": improved,
            "degraded_agents": degraded
        }
    
    def get_agent_summary(self) -> Dict[str, Any]:
        """
        Get a summary of each agent's performance across all runs.
        Used for the dashboard agent cards.
        
        Returns:
            {
                "Agent Name": {
                    "avg_score": float,
                    "trend": "improving"|"degrading"|"stable",
                    "run_count": int,
                    "last_5_scores": [float, ...]
                },
                ...
            }
        """
        data = self._load_scores()
        runs = data.get("runs", [])
        
        agent_runs: Dict[str, List[float]] = {}
        
        for run in runs:
            for agent, score_data in run.get("agent_scores", {}).items():
                if agent not in agent_runs:
                    agent_runs[agent] = []
                agent_runs[agent].append(score_data["raw_score"])
        
        summary = {}
        for agent, scores in agent_runs.items():
            trend_data = self.get_trend(agent_name=agent)
            summary[agent] = {
                "avg_score": round(statistics.mean(scores), 2) if scores else 0,
                "trend": trend_data["direction"],
                "slope": trend_data["slope"],
                "run_count": len(scores),
                "last_5_scores": scores[-5:]
            }
        
        return summary
