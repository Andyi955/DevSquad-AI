import React, { useState, useEffect, useCallback } from 'react';
import './OptimizerPanel.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export default function OptimizerPanel() {
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizationResult, setOptimizationResult] = useState(null);
    const [supervisorLearnings, setSupervisorLearnings] = useState([]);
    const [changesHistory, setChangesHistory] = useState([]);
    const [error, setError] = useState(null);

    // Fetch supervisor learnings on mount
    useEffect(() => {
        fetchLearnings();
    }, []);

    const fetchLearnings = async () => {
        try {
            const res = await fetch(`${API_BASE}/supervisor-learnings`);
            const data = await res.json();
            setSupervisorLearnings(data.learnings || []);
        } catch (e) {
            console.error('Failed to fetch learnings:', e);
        }
    };

    const runOptimization = async () => {
        setIsOptimizing(true);
        setError(null);
        setOptimizationResult(null);

        try {
            const res = await fetch(`${API_BASE}/optimize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();

            if (data.status === 'success') {
                setOptimizationResult(data);
                setChangesHistory(prev => [...prev, ...data.changes]);
            } else if (data.status === 'skipped') {
                setError(data.message);
            } else {
                setError(data.message || 'Optimization failed');
            }
        } catch (e) {
            setError('Failed to run optimization: ' + e.message);
        } finally {
            setIsOptimizing(false);
            fetchLearnings(); // Refresh learnings
        }
    };

    return (
        <div className="optimizer-panel">
            <div className="optimizer-header">
                <h3>⚡ Agent Optimizer</h3>
                <button
                    className={`optimize-btn ${isOptimizing ? 'optimizing' : ''}`}
                    onClick={runOptimization}
                    disabled={isOptimizing}
                >
                    {isOptimizing ? 'Analyzing...' : 'Run Optimization'}
                </button>
            </div>

            {error && (
                <div className="optimizer-error">
                    <span>⚠️</span> {error}
                </div>
            )}

            {optimizationResult && (
                <div className="optimization-result">
                    <h4>Latest Optimization</h4>
                    <p className="analysis-text">{optimizationResult.analysis}</p>
                    <p className="summary-text">{optimizationResult.summary}</p>
                </div>
            )}

            <div className="optimizer-section">
                <h4>📋 Changes Made to Codebase</h4>
                {changesHistory.length === 0 ? (
                    <p className="empty-state">No changes made yet. Run optimization after agents complete tasks.</p>
                ) : (
                    <div className="changes-list">
                        {changesHistory.map((change, idx) => (
                            <div key={idx} className="change-item">
                                <div className="change-file">
                                    <span className={`action-badge action-${change.action}`}>
                                        {change.action?.toUpperCase()}
                                    </span>
                                    {change.file}
                                </div>
                                <div className="change-reason">{change.reason}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="optimizer-section">
                <h4>👁️ Supervisor Learnings</h4>
                {supervisorLearnings.length === 0 ? (
                    <p className="empty-state">No patterns learned yet. Supervisor learns as agents work.</p>
                ) : (
                    <ul className="learnings-list">
                        {supervisorLearnings.map((learning, idx) => (
                            <li key={idx} className="learning-item">
                                <span className="learning-icon">📚</span>
                                {learning}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
