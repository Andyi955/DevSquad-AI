import React, { useState } from 'react';

function ChangesPanel({ pendingChanges, onApprove, onReject, onApproveAll }) {
    const [collapsed, setCollapsed] = useState({});

    const toggleCollapse = (id) => {
        setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const renderDiff = (oldContent = '', newContent = '') => {
        if (!oldContent) {
            // New file creation - all added
            return (newContent || '').split('\n').map((line, i) => (
                <div key={i} className="diff-line added">+{line}</div>
            ));
        }

        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');

        // Very basic line-by-line diff for now
        // For a more robust solution, a real diff library would be better
        // but this provides the requested color coding
        let i = 0, j = 0;
        const diff = [];

        while (i < oldLines.length || j < newLines.length) {
            if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
                diff.push(<div key={`equal-${i}-${j}`} className="diff-line">{oldLines[i]}</div>);
                i++;
                j++;
            } else if (j < newLines.length && (i >= oldLines.length || !oldLines.slice(i).includes(newLines[j]))) {
                diff.push(<div key={`add-${j}`} className="diff-line added">+{newLines[j]}</div>);
                j++;
            } else {
                diff.push(<div key={`rem-${i}`} className="diff-line removed">-{oldLines[i]}</div>);
                i++;
            }
        }
        return diff;
    };

    if (pendingChanges.length === 0) {
        return (
            <div className="research-panel">
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    padding: '20px'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✨</div>
                    <h3>No Pending Changes</h3>
                    <p>Agent edits will appear here for your review.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="research-panel">
            <div className="panel-header" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <h3 style={{ color: 'var(--neon-purple)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⚡ Review Changes ({pendingChanges.length})
                </h3>
                {pendingChanges.length > 1 && (
                    <button
                        className="btn btn-primary"
                        style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                        onClick={onApproveAll}
                    >
                        Approve All
                    </button>
                )}
            </div>

            <div className="changes-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pendingChanges.map((change, index) => {
                    const changeId = change.id || change.change_id || `change-${index}`;
                    return (
                        <div key={changeId} className="card" style={{
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-elevated)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <div className="change-header" style={{
                                padding: '12px',
                                background: 'rgba(255,255,255,0.03)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer'
                            }} onClick={() => toggleCollapse(changeId)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '1.2rem' }}>
                                        {change.action === 'create' ? '🆕' : change.action === 'delete' ? '🗑️' : '📝'}
                                    </span>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                            {change.path.split('/').pop()}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {change.path}
                                        </span>
                                    </div>
                                </div>
                                <span style={{ transform: collapsed[changeId] ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}>
                                    ▼
                                </span>
                            </div>

                            {!collapsed[changeId] && (
                                <div className="change-body" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div className="diff-view" style={{
                                        maxHeight: '400px',
                                        overflow: 'auto',
                                        background: '#0a0a0f',
                                        fontSize: '0.75rem',
                                        padding: '0'
                                    }}>
                                        {renderDiff(change.old_content, change.new_content)}
                                    </div>

                                    <div className="change-actions" style={{
                                        display: 'flex',
                                        gap: '10px',
                                        padding: '12px',
                                        borderTop: '1px solid var(--border-color)',
                                        background: 'rgba(255,255,255,0.02)'
                                    }}>
                                        <button
                                            className="btn btn-success"
                                            style={{ flex: 1, padding: '6px' }}
                                            onClick={() => onApprove(changeId)}
                                        >
                                            ✅ Approve
                                        </button>
                                        <button
                                            className="btn btn-danger"
                                            style={{ flex: 1, padding: '6px' }}
                                            onClick={() => onReject(changeId)}
                                        >
                                            ❌ Reject
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
export default ChangesPanel;
