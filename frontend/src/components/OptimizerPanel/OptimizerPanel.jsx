import React, { useState, useEffect, useCallback } from 'react';
import './OptimizerPanel.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export default function OptimizerPanel() {
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizationResult, setOptimizationResult] = useState(null);
    const [supervisorLearnings, setSupervisorLearnings] = useState([]);
    const [pendingChanges, setPendingChanges] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

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
                setPendingChanges(data.changes.map((c, i) => ({ ...c, index: i })));
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

    const handleApprove = async (index) => {
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_BASE}/optimize/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index })
            });
            const data = await res.json();
            if (data.status === 'success') {
                const approved = pendingChanges.find(c => c.index === index);
                setPendingChanges(prev => prev.filter(c => c.index !== index));
                setChangesHistory(prev => [...prev, { ...approved, status: 'applied' }]);
            }
        } catch (e) {
            setError('Failed to approve: ' + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async (index) => {
        setIsProcessing(true);
        try {
            const res = await fetch(`${API_BASE}/optimize/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index })
            });
            const data = await res.json();
            if (data.status === 'success') {
                const rejected = pendingChanges.find(c => c.index === index);
                setPendingChanges(prev => prev.filter(c => c.index !== index));
                setChangesHistory(prev => [...prev, { ...rejected, status: 'rejected' }]);
            }
        } catch (e) {
            setError('Failed to reject: ' + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const [expandedItems, setExpandedItems] = useState(new Set());
    const [changesHistory, setChangesHistory] = useState([]); // Assuming this was defined somewhere or needed
    const [error, setError] = useState(null);

    const toggleExpand = (id) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
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
                    {isOptimizing ? 'Analyzing...' : 'Run Analysis'}
                </button>
            </div>

            {error && (
                <div className="optimizer-error">
                    <span>⚠️</span> {error}
                </div>
            )}

            {optimizationResult && (
                <div className="optimization-result">
                    <div className="res-header">
                        <h4>Analysis Result</h4>
                        <span className="badge">{optimizationResult.summary}</span>
                    </div>
                    <p className="analysis-text">{optimizationResult.analysis}</p>
                </div>
            )}

            {pendingChanges.length > 0 && (
                <div className="optimizer-section">
                    <h4>🚀 Proposed Optimizations</h4>
                    <div className="changes-list">
                        {pendingChanges.map((change) => {
                            const isExpanded = expandedItems.has(`pending-${change.index}`);
                            return (
                                <div key={change.index} className={`change-item proposed ${isExpanded ? 'expanded' : ''}`}>
                                    <div className="change-header" onClick={() => toggleExpand(`pending-${change.index}`)}>
                                        <div className="change-file" title={change.file}>
                                            <span className="collapse-icon">
                                                {isExpanded ? '▼' : '▶'}
                                            </span>
                                            <span className={`action-badge action-${change.action}`}>
                                                {change.action?.toUpperCase()}
                                            </span>
                                            <span className="file-name-text">{change.file}</span>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <>
                                            <div className="change-reason">{change.reason}</div>
                                            <div className="change-actions">
                                                <button
                                                    className="btn-reject"
                                                    onClick={(e) => { e.stopPropagation(); handleReject(change.index); }}
                                                    disabled={isProcessing}
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    className="btn-approve"
                                                    onClick={(e) => { e.stopPropagation(); handleApprove(change.index); }}
                                                    disabled={isProcessing}
                                                >
                                                    Approve
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="optimizer-section">
                <h4>📋 History</h4>
                {changesHistory.length === 0 ? (
                    <p className="empty-state">No history yet.</p>
                ) : (
                    <div className="changes-list">
                        {changesHistory.map((change, idx) => {
                            const isExpanded = expandedItems.has(`history-${idx}`);
                            return (
                                <div key={idx} className={`change-item history status-${change.status} ${isExpanded ? 'expanded' : ''}`}>
                                    <div className="change-header" onClick={() => toggleExpand(`history-${idx}`)}>
                                        <div className="change-file" title={change.file}>
                                            <span className="collapse-icon">
                                                {isExpanded ? '▼' : '▶'}
                                            </span>
                                            <span className={`status-icon`}>
                                                {change.status === 'applied' ? '✅' : '❌'}
                                            </span>
                                            <span className="file-name-text">{change.file}</span>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="change-reason">{change.reason}</div>
                                    )}
                                </div>
                            );
                        })}
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
