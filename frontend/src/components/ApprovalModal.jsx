/**
 * ApprovalModal Component
 * Shows proposed file changes for approval
 */

function ApprovalModal({ change, onApprove, onReject, onClose }) {
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
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
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
                                    {oldLines.slice(0, 20).map((line, i) => (
                                        <div key={`old-${i}`} className="diff-line removed">
                                            - {line}
                                        </div>
                                    ))}
                                    {oldLines.length > 20 && (
                                        <div style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>
                                            ... and {oldLines.length - 20} more lines
                                        </div>
                                    )}
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
                                {newLines.slice(0, 20).map((line, i) => (
                                    <div key={`new-${i}`} className="diff-line added">
                                        + {line}
                                    </div>
                                ))}
                                {newLines.length > 20 && (
                                    <div style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>
                                        ... and {newLines.length - 20} more lines
                                    </div>
                                )}
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
                        ⚡ Approve File Change?
                    </h3>
                    <button className="modal-close" onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className="modal-body">
                    {/* Agent Info */}
                    {change.agent && (
                        <div style={{
                            marginBottom: '16px',
                            padding: '8px 12px',
                            background: 'var(--glass-bg)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                        }}>
                            Proposed by: <strong>{change.agent}</strong>
                        </div>
                    )}

                    {/* Diff View */}
                    {renderDiff()}

                    {/* Warning */}
                    <div style={{
                        marginTop: '16px',
                        padding: '12px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid var(--neon-amber)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem'
                    }}>
                        ⚠️ This will modify files in your workspace. Review carefully before approving.
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onReject}>
                        ❌ Reject
                    </button>
                    <button className="btn btn-success" onClick={onApprove}>
                        ✅ Approve
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ApprovalModal
