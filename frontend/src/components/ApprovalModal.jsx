/**
 * ApprovalModal Component
 * Shows proposed file changes for approval
 */

import { useState } from 'react'

function ApprovalModal({ change, onApprove, onReject, onClose }) {
    const [feedback, setFeedback] = useState('')

    if (!change) return null

    // Simple diff view
    const renderDiff = () => {
        const oldLines = (change.old_content || '').split('\n')
        const newLines = (change.new_content || '').split('\n')

        return (
            <div className="diff-view">
                <div className="diff-header">
                    {change.action === 'create' ? '➕ New File' : '✏️ Edit'}: {change.path}
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {change.action === 'create' ? (
                        // New file - show all as added
                        newLines.map((line, i) => (
                            <div key={i} className="diff-line added">
                                + {line}
                            </div>
                        ))
                    ) : (
                        // Edit - show simple comparison
                        // In a real app, use a proper diff library
                        <>
                            {oldLines.length > 0 && (
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{
                                        padding: '4px 16px',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)'
                                    }}>
                                        Old Content
                                    </div>
                                    {oldLines.slice(0, 10).map((line, i) => (
                                        <div key={`old-${i}`} className="diff-line removed">
                                            - {line}
                                        </div>
                                    ))}
                                    {oldLines.length > 10 && <div style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>...</div>}
                                </div>
                            )}
                            <div>
                                <div style={{
                                    padding: '4px 16px',
                                    background: 'rgba(34, 197, 94, 0.1)',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    New Content
                                </div>
                                {newLines.slice(0, 10).map((line, i) => (
                                    <div key={`new-${i}`} className="diff-line added">
                                        + {line}
                                    </div>
                                ))}
                                {newLines.length > 10 && <div style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>...</div>}
                            </div>
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">
                        ⚡ Review Change
                    </h3>
                    <button className="modal-close" onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className="modal-body">
                    {/* Agent Info */}
                    {change.agent && (
                        <div style={{ marginBottom: '12px', fontSize: '0.875rem' }}>
                            Proposed by: <strong>{change.agent}</strong>
                        </div>
                    )}

                    {/* Diff View */}
                    {renderDiff()}

                    <div style={{ marginTop: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Feedback / Instructions (Optional)
                        </label>
                        <textarea
                            className="chat-input"
                            style={{ width: '100%', minHeight: '60px', borderRadius: 'var(--radius-md)', padding: '8px' }}
                            placeholder="e.g. Looks good, now please add tests."
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => onReject(feedback)}>
                        ❌ Reject
                    </button>
                    <button className="btn btn-success" onClick={() => onApprove(feedback)}>
                        ✅ Approve
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ApprovalModal
