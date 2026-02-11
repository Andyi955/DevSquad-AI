"""
Tests for the Benchmark & Scoring System.
Covers ScoringEngine (unit) and BenchmarkService (integration).
"""

import sys
import os
import json
import shutil
import pytest
from pathlib import Path
from datetime import datetime

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from services.scoring_engine import ScoringEngine
from services.benchmark_service import BenchmarkService

# --- Test Fixtures ---

TEST_DATA_DIR = Path(__file__).parent / "test_benchmark_data"

@pytest.fixture(autouse=True)
def clean_test_data():
    """Clean up test data before and after each test"""
    if TEST_DATA_DIR.exists():
        shutil.rmtree(TEST_DATA_DIR)
    TEST_DATA_DIR.mkdir(parents=True, exist_ok=True)
    yield
    if TEST_DATA_DIR.exists():
        shutil.rmtree(TEST_DATA_DIR)

@pytest.fixture
def scoring_engine():
    """Create a ScoringEngine pointed at test data directory"""
    engine = ScoringEngine()
    engine.scores_file = TEST_DATA_DIR / "benchmark_scores.json"
    engine.scores = {"runs": []}
    return engine

@pytest.fixture
def benchmark_service():
    """Create a BenchmarkService without a real orchestrator"""
    engine = ScoringEngine()
    engine.scores_file = TEST_DATA_DIR / "benchmark_scores.json"
    engine.scores = {"runs": []}
    service = BenchmarkService(
        orchestrator=None,
        review_service=None,
        scoring_engine=engine
    )
    return service


def _record(engine, run_id="test-run", benchmark_id="py_001", category="code_gen",
            difficulty="easy", weight=1.0, agent_scores=None, raw_review=None):
    """Helper to call record_score with defaults"""
    return engine.record_score(
        run_id=run_id,
        benchmark_id=benchmark_id,
        category=category,
        difficulty=difficulty,
        weight=weight,
        agent_scores=agent_scores or {"Junior Dev": 80},
        raw_review=raw_review or {}
    )


# =============================================================
# ScoringEngine Unit Tests
# =============================================================

class TestScoringEngine:
    """Tests for the ScoringEngine class"""

    def test_record_score_basic(self, scoring_engine):
        """Test recording a basic benchmark score"""
        result = _record(scoring_engine, agent_scores={"Junior Dev": 80, "Senior Dev": 90})

        assert result is not None
        assert result["benchmark_id"] == "py_001"
        assert result["overall_raw_score"] > 0
        assert "Junior Dev" in result["agent_scores"]
        assert "Senior Dev" in result["agent_scores"]

    def test_weighted_scoring(self, scoring_engine):
        """Test that category weights affect overall score"""
        # terminal_usage has a higher category weight
        result_terminal = _record(
            scoring_engine, run_id="run-t", benchmark_id="py_004",
            category="terminal_usage", weight=2.0,
            agent_scores={"Junior Dev": 90}
        )

        result_codegen = _record(
            scoring_engine, run_id="run-c", benchmark_id="py_001",
            category="code_gen", weight=1.0,
            agent_scores={"Junior Dev": 90}
        )

        # terminal_usage should have a higher weighted score
        assert result_terminal["overall_weighted_score"] >= result_codegen["overall_weighted_score"]

    def test_persistence(self, scoring_engine):
        """Test that scores are saved and loaded from file"""
        _record(scoring_engine, run_id="persist-run")

        # Create a new engine pointing at the same file
        engine2 = ScoringEngine()
        engine2.scores_file = scoring_engine.scores_file
        data = engine2._load_scores()

        assert len(data["runs"]) == 1
        assert data["runs"][0]["benchmark_id"] == "py_001"

    def test_get_trend_insufficient_data(self, scoring_engine):
        """Test trend with less than 3 runs returns 'insufficient_data'"""
        _record(scoring_engine, run_id="trend-01")

        trend = scoring_engine.get_trend("Junior Dev")
        assert trend["direction"] == "insufficient_data"

    def test_get_trend_improving(self, scoring_engine):
        """Test that improving scores produce an 'improving' trend"""
        for i, score in enumerate([60, 70, 80, 90]):
            _record(scoring_engine, run_id=f"trend-{i}",
                    agent_scores={"Junior Dev": score})

        trend = scoring_engine.get_trend("Junior Dev")
        assert trend["direction"] == "improving"
        assert trend["slope"] > 0

    def test_get_trend_degrading(self, scoring_engine):
        """Test that declining scores produce a 'degrading' trend"""
        for i, score in enumerate([90, 80, 70, 60]):
            _record(scoring_engine, run_id=f"trend-{i}",
                    agent_scores={"Junior Dev": score})

        trend = scoring_engine.get_trend("Junior Dev")
        assert trend["direction"] == "degrading"
        assert trend["slope"] < 0

    def test_compare_runs(self, scoring_engine):
        """Test comparison between two runs"""
        _record(scoring_engine, run_id="run-A", agent_scores={"Junior Dev": 70})
        _record(scoring_engine, run_id="run-B", agent_scores={"Junior Dev": 90})

        comparison = scoring_engine.compare_runs("run-A", "run-B")
        assert comparison is not None
        assert comparison["run_a"]["run_id"] == "run-A"
        assert comparison["run_b"]["run_id"] == "run-B"
        assert comparison["run_b"]["overall_score"] > comparison["run_a"]["overall_score"]

    def test_compare_nonexistent_run(self, scoring_engine):
        """Test comparison with a non-existent run returns None"""
        _record(scoring_engine, run_id="run-exists")

        comparison = scoring_engine.compare_runs("run-exists", "run-does-not-exist")
        assert comparison.get("error") is not None

    def test_get_agent_summary(self, scoring_engine):
        """Test agent summary data"""
        for i in range(5):
            _record(scoring_engine, run_id=f"summary-{i}",
                    agent_scores={"Junior Dev": 70 + i * 5, "Senior Dev": 80 + i * 3})

        summary = scoring_engine.get_agent_summary()
        assert "Junior Dev" in summary
        assert "Senior Dev" in summary
        assert summary["Junior Dev"]["run_count"] == 5
        assert "avg_score" in summary["Junior Dev"]
        assert "trend" in summary["Junior Dev"]
        assert "last_5_scores" in summary["Junior Dev"]

    def test_get_chart_data(self, scoring_engine):
        """Test chart data for dashboard visualization"""
        for i in range(3):
            _record(scoring_engine, run_id=f"chart-{i}", benchmark_id=f"py_00{i+1}",
                    agent_scores={"Junior Dev": 75 + i * 5})

        chart = scoring_engine.get_chart_data()
        assert "labels" in chart
        assert "datasets" in chart
        assert len(chart["labels"]) == 3


# =============================================================
# BenchmarkService Tests
# =============================================================

class TestBenchmarkService:
    """Tests for the BenchmarkService class"""

    def test_list_suites(self, benchmark_service):
        """Test listing available benchmark suites"""
        suites = benchmark_service.list_suites()
        assert "suites" in suites
        assert "total_benchmarks" in suites

        # suites is a dict keyed by language name
        assert isinstance(suites["suites"], dict)
        assert suites["total_benchmarks"] >= 0

    def test_get_all_benchmarks(self, benchmark_service):
        """Test getting all benchmarks flat list"""
        all_benchmarks = benchmark_service.get_all_benchmarks()
        assert isinstance(all_benchmarks, list)
        if len(all_benchmarks) > 0:
            assert "id" in all_benchmarks[0]
            assert "language" in all_benchmarks[0]

    def test_get_status_no_run(self, benchmark_service):
        """Test status when no run is active"""
        status = benchmark_service.get_status()
        assert status["status"] == "idle"

    def test_get_results_empty(self, benchmark_service):
        """Test results when no benchmarks have been run"""
        results = benchmark_service.get_results()
        assert "history" in results
        assert "chart_data" in results
        assert "trend" in results
        assert "agent_summary" in results

    def test_compare_no_data(self, benchmark_service):
        """Test comparing runs when there is no data"""
        comparison = benchmark_service.compare("fake-a", "fake-b")
        assert comparison is None or comparison.get("error") is not None


# =============================================================
# API Endpoint Tests (Integration)
# =============================================================

class TestBenchmarkAPI:
    """Integration tests for benchmark API endpoints"""

    @pytest.fixture(autouse=True)
    def setup_client(self):
        """Setup test client"""
        from main import app
        from fastapi.testclient import TestClient
        self.client = TestClient(app)

    def test_suites_endpoint(self):
        """GET /api/benchmarks/suites should return suite list"""
        response = self.client.get("/api/benchmarks/suites")
        assert response.status_code == 200
        data = response.json()
        assert "suites" in data
        assert "total_benchmarks" in data

    def test_status_endpoint(self):
        """GET /api/benchmarks/status should return current status"""
        response = self.client.get("/api/benchmarks/status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data

    def test_results_endpoint(self):
        """GET /api/benchmarks/results should return results data"""
        response = self.client.get("/api/benchmarks/results")
        assert response.status_code == 200
        data = response.json()
        assert "history" in data
        assert "chart_data" in data

    def test_compare_endpoint_missing_params(self):
        """GET /api/benchmarks/compare without params should 422"""
        response = self.client.get("/api/benchmarks/compare")
        assert response.status_code == 422  # Missing required query params
