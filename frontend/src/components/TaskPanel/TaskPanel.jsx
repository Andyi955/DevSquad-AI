import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Circle, AlertCircle, Play, X, Edit2, Plus, Trash2, ChevronDown } from 'lucide-react';
import './TaskPanel.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export default function TaskPanel({ onPlanApproved, onSendFeedback }) {
    const [plan, setPlan] = useState(null);
    const [isApproved, setIsApproved] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [showAddTask, setShowAddTask] = useState(false);
    const [showScrollArrow, setShowScrollArrow] = useState(false);
    const panelRef = useRef(null);

    // Fetch current plan on mount and periodically
    useEffect(() => {
        fetchCurrentPlan();
        const interval = setInterval(fetchCurrentPlan, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleScroll = () => {
        if (!panelRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = panelRef.current;
        // Show arrow if we are more than 100px away from bottom
        setShowScrollArrow(scrollHeight - scrollTop - clientHeight > 100);
    };

    const scrollToBottom = () => {
        panelRef.current?.scrollTo({
            top: panelRef.current.scrollHeight,
            behavior: 'smooth'
        });
    };

    const fetchCurrentPlan = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/plan/current`);
            const data = await res.json();
            setPlan(data.plan);
            setIsApproved(data.approved);
        } catch (e) {
            console.error('Failed to fetch plan:', e);
        }
    };

    const handleApprove = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/plan/approve`, { method: 'POST' });
            const data = await res.json();
            if (data.status === 'success') {
                setPlan(data.plan);
                setIsApproved(true);
                onPlanApproved?.(data.plan);
            }
        } catch (e) {
            console.error('Failed to approve plan:', e);
        }
        setLoading(false);
    };

    const handleReject = async () => {
        setLoading(true);
        try {
            await fetch(`${API_BASE}/api/plan/reject`, { method: 'POST' });
            setPlan(null);
            setIsApproved(false);
        } catch (e) {
            console.error('Failed to reject plan:', e);
        }
        setLoading(false);
    };

    const handleRemoveTask = async (taskId) => {
        try {
            const res = await fetch(`${API_BASE}/api/plan/modify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ remove_task: taskId })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setPlan(data.plan);
            }
        } catch (e) {
            console.error('Failed to remove task:', e);
        }
    };

    const handleAddTask = async () => {
        if (!newTaskDesc.trim()) return;
        try {
            const res = await fetch(`${API_BASE}/api/plan/modify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    add_task: {
                        description: newTaskDesc,
                        owner: 'JUNIOR'
                    }
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setPlan(data.plan);
                setNewTaskDesc('');
                setShowAddTask(false);
            }
        } catch (e) {
            console.error('Failed to add task:', e);
        }
    };

    const getOwnerColor = (owner) => {
        switch (owner) {
            case 'JUNIOR': return '#22c55e';
            case 'SENIOR': return '#a855f7';
            case 'TESTER': return '#f97316';
            case 'RESEARCHER': return '#06b6d4';
            default: return '#6b7280';
        }
    };

    const completedCount = plan?.tasks?.filter(t => t.status === 'completed').length || 0;
    const totalCount = plan?.tasks?.length || 0;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    if (!plan) {
        return (
            <div className="task-panel">
                <div className="task-panel-empty">
                    <Circle size={48} className="empty-icon" />
                    <h3>No Active Plan</h3>
                    <p>Send a message to generate a task plan</p>
                </div>
            </div>
        );
    }

    return (
        <div className="task-panel-container">
            <div className="task-panel-scroll" ref={panelRef} onScroll={handleScroll}>
                <div className="task-header">
                    <div className="task-title-section">
                        <h3>{plan.title}</h3>
                        <span className={`task-status ${plan.status}`}>
                            {plan.status === 'pending_approval' ? '⏳ Awaiting Approval' :
                                plan.status === 'approved' ? '✅ In Progress' : plan.status}
                        </span>
                    </div>

                    {/* Progress Bar */}
                    {isApproved && (
                        <div className="progress-section">
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="progress-text">{completedCount}/{totalCount} completed</span>
                        </div>
                    )}
                </div>

                {/* Task List */}
                <div className="task-list">
                    {plan.tasks?.map((task) => (
                        <div key={task.id} className={`task-item ${task.status}`}>
                            <div className="task-checkbox">
                                {task.status === 'completed' ? (
                                    <CheckCircle size={20} className="completed" />
                                ) : (
                                    <Circle size={20} />
                                )}
                            </div>
                            <div className="task-content">
                                <span className="task-description">{task.description}</span>
                                <span
                                    className="task-owner"
                                    style={{
                                        backgroundColor: getOwnerColor(task.owner) + '20',
                                        color: getOwnerColor(task.owner)
                                    }}
                                >
                                    →{task.owner}
                                </span>
                            </div>
                            {!isApproved && (
                                <button
                                    className="task-remove-btn"
                                    onClick={() => handleRemoveTask(task.id)}
                                    title="Remove task"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Add Task (only when not approved) */}
                {!isApproved && (
                    <div className="add-task-section">
                        {showAddTask ? (
                            <div className="add-task-form">
                                <input
                                    type="text"
                                    value={newTaskDesc}
                                    onChange={(e) => setNewTaskDesc(e.target.value)}
                                    placeholder="New task description..."
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                                />
                                <button onClick={handleAddTask} className="btn-confirm">
                                    <Plus size={14} /> Add
                                </button>
                                <button onClick={() => setShowAddTask(false)} className="btn-cancel">
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <button
                                className="add-task-btn"
                                onClick={() => setShowAddTask(true)}
                            >
                                <Plus size={14} /> Add Task
                            </button>
                        )}
                    </div>
                )}

                {/* Notes */}
                {plan.notes && (
                    <div className="task-notes">
                        <AlertCircle size={14} />
                        <span>{plan.notes}</span>
                    </div>
                )}

                {/* Feedback Input (only when not approved) */}
                {!isApproved && (
                    <div className="task-feedback-section">
                        <div className="feedback-header">
                            <AlertCircle size={14} />
                            <span>Refine Plan with AI</span>
                        </div>
                        <div className="feedback-input-wrapper">
                            <input
                                type="text"
                                placeholder="Refine plan... (e.g. 'Add a venv step')"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                        if (onSendFeedback) {
                                            onSendFeedback(e.target.value);
                                            e.target.value = '';
                                        }
                                    }
                                }}
                            />
                            <span className="input-hint">Press Enter to refine plan</span>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                {!isApproved && (
                    <div className="task-actions">
                        <button
                            className="btn-approve"
                            onClick={handleApprove}
                            disabled={loading}
                        >
                            <Play size={16} />
                            {loading ? 'Processing...' : 'Approve & Start'}
                        </button>
                        <button
                            className="btn-reject"
                            onClick={handleReject}
                            disabled={loading}
                        >
                            <X size={16} /> Reject
                        </button>
                    </div>
                )}
            </div>

            {/* Scroll Jump Arrow */}
            {showScrollArrow && !isApproved && (
                <button
                    className="jump-to-bottom-btn"
                    onClick={scrollToBottom}
                    title="Jump to approval"
                >
                    <ChevronDown size={20} />
                    <span className="jump-text">Approval</span>
                </button>
            )}
        </div>
    );
}
