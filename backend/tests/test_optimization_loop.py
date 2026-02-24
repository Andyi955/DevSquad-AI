import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from pathlib import Path
from services.optimization_loop import OptimizationLoop

@pytest.fixture
def mock_orchestrator():
    orchestrator = Mock()
    orchestrator.run_optimization_analysis = AsyncMock(return_value={
        "changes": [
            {
                "file": "prompts/test_agent.md",
                "action": "append",
                "content": "TEST CONTENT",
                "reason": "For testing"
            }
        ],
        "summary": "1 change proposed"
    })
    orchestrator.optimizer = Mock()
    orchestrator.optimizer.apply_optimization = AsyncMock(return_value=True)
    return orchestrator

@pytest.fixture
def mock_benchmark_service():
    service = Mock()
    service.run_suite = AsyncMock(return_value={
        "status": "success",
        "overall_score": 90.0
    })
    return service

@pytest.fixture
def mock_scoring_engine():
    return Mock()

@pytest.fixture
def optimization_loop(mock_orchestrator, mock_benchmark_service, mock_scoring_engine, tmp_path):
    loop = OptimizationLoop(mock_orchestrator, mock_benchmark_service, mock_scoring_engine)
    # Clear any loaded real history
    loop.run_history = []
    # Redirect directories to tmp_path for safe testing
    loop.prompts_dir = tmp_path / "prompts"
    loop.agents_dir = tmp_path / "agents"
    loop.versions_dir = tmp_path / "versions"
    loop._history_file = tmp_path / "data" / "history.json"
    
    loop.prompts_dir.mkdir(parents=True, exist_ok=True)
    loop.agents_dir.mkdir(parents=True, exist_ok=True)
    loop.versions_dir.mkdir(parents=True, exist_ok=True)
    
    # Create a dummy file to snapshot
    (loop.prompts_dir / "dummy.md").write_text("Hello")
    (loop.agents_dir / "dummy_agent.py").write_text("print('hello')")
    
    return loop

@pytest.mark.asyncio
async def test_snapshot_and_restore_state(optimization_loop):
    # Snapshot
    version_dir = optimization_loop._snapshot_state("test_v1")
    assert version_dir.exists()
    assert (version_dir / "dummy.md").exists()
    assert (version_dir / "agents" / "dummy_agent.py").exists()
    
    # Modify original
    (optimization_loop.prompts_dir / "dummy.md").write_text("Modified")
    
    # Restore
    assert optimization_loop._restore_state("test_v1") == True
    assert (optimization_loop.prompts_dir / "dummy.md").read_text() == "Hello"

@pytest.mark.asyncio
async def test_early_convergence(optimization_loop):
    scores = [80.0, 81.0, 81.5]
    # Delta < 2.0 for window of 2
    assert optimization_loop._detect_convergence(scores, threshold=2.0, window=2) == True
    
@pytest.mark.asyncio
async def test_run_reaches_target_score(optimization_loop, mock_benchmark_service):
    # Target score is 85, benchmark returns 90
    result = await optimization_loop.run(suite_id="test_suite", target_score=85.0, auto_apply=True)
    
    assert result["status"] == "converged"
    assert result["best_score"] == 90.0
    assert result["current_iteration"] == 1
    # Check that tests were not triggered because it converged before optimizing
    assert len(optimization_loop.run_history) == 1

@pytest.mark.asyncio
async def test_run_applies_changes_and_fails_tests_revert(optimization_loop, mock_orchestrator, mock_benchmark_service):
    # Benchmark returns 70, Target is 85
    mock_benchmark_service.run_suite.return_value = {"status": "success", "overall_score": 70.0}
    
    with patch.object(optimization_loop, '_run_tests', new_callable=AsyncMock) as mock_run_tests:
        # Mock that the test suite fails
        mock_run_tests.return_value = False
        
        # Max iteration 1
        result = await optimization_loop.run(suite_id="test_suite", max_iterations=1, target_score=85.0, auto_apply=True)
        
        # Verify run_tests was called since auto_apply is True
        mock_run_tests.assert_called_once()
        
        # Iteration should indicate applied=False because it reverted
        iteration_data = result["iterations"][0]
        assert iteration_data["applied"] == False
        assert "failed tests. Reverted." in iteration_data["note"]

@pytest.mark.asyncio
async def test_approval_flow_reject(optimization_loop, mock_benchmark_service):
    mock_benchmark_service.run_suite.return_value = {"status": "success", "overall_score": 50.0}
    
    # Run in background
    task = asyncio.create_task(optimization_loop.run(suite_id="test", max_iterations=1, auto_apply=False))
    
    # Wait for loop to reach approval block
    await asyncio.sleep(0.1)
    
    assert optimization_loop._waiting_for_approval == True
    assert optimization_loop.current_run["status"].startswith("waiting_approval")
    
    # User rejects
    optimization_loop.reject_iteration()
    
    result = await task
    # Should say changes rejected
    assert result["iterations"][0]["applied"] == False
    assert result["iterations"][0]["note"] == "Changes rejected by user"
