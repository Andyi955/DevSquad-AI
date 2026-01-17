import React, { useState } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import Prism from 'prismjs';

// Import Prism themes and languages
import { diffLines } from 'diff';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';

// Helper to calculate added/removed lines
const calculateStats = (oldText, newText) => {
    // If either is null/undefined, handle gracefully
    if (oldText == null) oldText = '';
    if (newText == null) newText = '';

    const changes = diffLines(oldText, newText);
    let added = 0;
    let removed = 0;
    changes.forEach(part => {
        if (part.added) added += part.count;
        if (part.removed) removed += part.count;
    });
    return { added, removed };
};

function ChangesPanel({ pendingChanges, onApprove, onReject, onApproveAll, isFullScreen, onToggleFullScreen, approvedChanges }) {
    const [collapsed, setCollapsed] = useState({});


    // Handle Escape key to close full screen
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (isFullScreen && e.key === 'Escape' && onToggleFullScreen) {
                onToggleFullScreen();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullScreen, onToggleFullScreen]);

    const toggleCollapse = (id) => {
        setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Detect language from file extension
    const getLanguage = (filePath) => {
        if (!filePath) return 'text';
        const ext = filePath.split('.').pop().toLowerCase();
        const languageMap = {
            'js': 'javascript',
            'jsx': 'jsx',
            'ts': 'typescript',
            'tsx': 'tsx',
            'py': 'python',
            'css': 'css',
            'json': 'json',
            'sh': 'bash',
            'md': 'markdown',
            'html': 'markup',
            'xml': 'markup'
        };
        return languageMap[ext] || 'text';
    };

    // Custom syntax highlighter using Prism
    const highlightSyntax = (str) => {
        return (
            <span
                dangerouslySetInnerHTML={{
                    __html: str
                }}
            />
        );
    };

    const renderChangeCard = (change, isApproved = false) => {
        const changeId = change.id || change.change_id;
        const language = getLanguage(change.path);

        return (
            <div key={changeId} className="card" style={{
                border: isApproved ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-color)',
                background: isApproved ? 'rgba(34, 197, 94, 0.05)' : 'var(--bg-elevated)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                opacity: isApproved ? 0.8 : 1,
                position: 'relative' // Added for absolute positioning of badge
            }}>
                {isApproved && (
                    <span style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        fontSize: '0.6rem',
                        color: '#4ade80',
                        fontWeight: 'bold',
                        background: 'rgba(34, 197, 94, 0.15)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid rgba(34, 197, 94, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        zIndex: 10,
                        pointerEvents: 'none',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                        <span>✅</span> APPROVED
                    </span>
                )}
                <div className="change-header" style={{
                    padding: '12px',
                    background: isApproved ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                }} onClick={() => toggleCollapse(changeId)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>
                            {change.action === 'create' ? '🆕' : change.action === 'delete' ? '🗑️' : '📝'}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                            <span style={{
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }} title={change.path.split('/').pop()}>
                                {change.path.split('/').pop()}
                            </span>
                            <span style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }} title={change.path}>
                                {change.path}
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                        <span style={{ transform: collapsed[changeId] ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}>
                            ▼
                        </span>
                    </div>
                </div>

                {!collapsed[changeId] && (
                    <div className="change-body" style={{ display: 'flex', flexDirection: 'column' }}>
                        {isFullScreen ? (
                            <div className="diff-view-container" style={{
                                maxHeight: 'calc(100vh - 140px)',
                                overflow: 'auto',
                                background: '#1e1e1e',
                                fontSize: '0.875rem'
                            }}>
                                <ReactDiffViewer
                                    oldValue={change.action === 'create' ? change.new_content : (change.old_content || '')}
                                    newValue={change.action === 'create' ? '' : (change.new_content || '')}
                                    splitView={true}
                                    compareMethod="diffWords"
                                    useDarkTheme={true}
                                    showDiffOnly={false}
                                    hideLineNumbers={false}
                                    renderContent={highlightSyntax}
                                    codeFoldMessageRenderer={() => 'Expand unchanged lines'}
                                    styles={{
                                        variables: {
                                            light: {
                                                diffViewerBackground: '#1e1e1e',
                                                diffViewerColor: '#e0e0e0',
                                                addedBackground: 'rgba(34, 197, 94, 0.15)',
                                                addedColor: '#4ade80',
                                                removedBackground: 'rgba(239, 68, 68, 0.15)',
                                                removedColor: '#f87171',
                                                wordAddedBackground: 'rgba(34, 197, 94, 0.3)',
                                                wordRemovedBackground: 'rgba(239, 68, 68, 0.3)',
                                                addedGutterBackground: 'rgba(34, 197, 94, 0.1)',
                                                removedGutterBackground: 'rgba(239, 68, 68, 0.1)',
                                                gutterBackground: '#0a0a0f',
                                                gutterBackgroundDark: '#0a0a0f',
                                                highlightBackground: 'rgba(147, 51, 234, 0.1)',
                                                highlightGutterBackground: 'rgba(147, 51, 234, 0.15)',
                                            },
                                            dark: {
                                                diffViewerBackground: '#1e1e1e',
                                                diffViewerColor: '#e0e0e0',
                                                addedBackground: 'rgba(34, 197, 94, 0.15)',
                                                addedColor: '#4ade80',
                                                removedBackground: 'rgba(239, 68, 68, 0.15)',
                                                removedColor: '#f87171',
                                                wordAddedBackground: 'rgba(34, 197, 94, 0.3)',
                                                wordRemovedBackground: 'rgba(239, 68, 68, 0.3)',
                                                addedGutterBackground: 'rgba(34, 197, 94, 0.1)',
                                                removedGutterBackground: 'rgba(239, 68, 68, 0.1)',
                                                gutterBackground: '#0a0a0f',
                                                gutterBackgroundDark: '#0a0a0f',
                                                highlightBackground: 'rgba(147, 51, 234, 0.1)',
                                                highlightGutterBackground: 'rgba(147, 51, 234, 0.15)',
                                            }
                                        },
                                        diffContainer: {
                                            width: '100%',
                                        },
                                        diffTable: {
                                            width: '100%',
                                            tableLayout: 'fixed',
                                        },
                                        line: {
                                            fontSize: '0.75rem',
                                            fontFamily: 'var(--font-mono)',
                                            padding: '0 4px',
                                        },
                                        gutter: {
                                            minWidth: '40px',
                                            padding: '0 8px',
                                        },
                                        marker: {
                                            padding: '0 8px',
                                        },
                                        content: {
                                            width: '100%',
                                        },
                                        contentText: {
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: isFullScreen ? '0.875rem' : '0.75rem',
                                            lineHeight: '1.5',
                                            paddingLeft: '8px',
                                            textAlign: 'left',
                                            wordBreak: 'break-all',
                                            whiteSpace: 'pre-wrap'
                                        }
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="change-stats" style={{
                                padding: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '24px',
                                background: '#1e1e1e'
                            }}>
                                {(() => {
                                    const stats = calculateStats(change.old_content || '', change.new_content || '');
                                    return (
                                        <>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <span style={{ fontSize: '1.5rem', color: '#4ade80', fontWeight: 'bold' }}>+{stats.added}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lines Added</span>
                                            </div>
                                            <div style={{ width: '1px', height: '40px', background: 'var(--border-color)' }}></div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <span style={{ fontSize: '1.5rem', color: '#f87171', fontWeight: 'bold' }}>-{stats.removed}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lines Removed</span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {!isApproved && (
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
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (pendingChanges.length === 0 && (!approvedChanges || approvedChanges.length === 0)) {
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

    const containerStyle = isFullScreen ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.95)',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    } : {};

    // Handle click outside to close (only applies in full screen)
    const handleContainerClick = (e) => {
        if (isFullScreen && e.target === e.currentTarget && onToggleFullScreen) {
            onToggleFullScreen();
        }
    };



    return (
        <div className="research-panel" style={containerStyle} onClick={handleContainerClick}>
            <div className="panel-header" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '12px',
                borderBottom: '1px solid var(--border-color)',
                background: isFullScreen ? 'var(--bg-secondary)' : 'transparent',
                padding: isFullScreen ? '12px 16px' : '8px 12px',
                borderRadius: '0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'nowrap' }}>
                    <h3 style={{
                        color: 'var(--neon-purple)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        margin: 0,
                        fontSize: '0.95rem',
                        whiteSpace: 'nowrap'
                    }}>
                        ⚡ Review Changes
                    </h3>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>


                    {pendingChanges.length > 0 && (
                        <span className="badge" style={{
                            background: 'rgba(147, 51, 234, 0.1)',
                            border: '1px solid rgba(147, 51, 234, 0.3)',
                            fontSize: '0.75rem',
                            padding: '2px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            borderRadius: '12px',
                            color: 'var(--neon-purple)',
                            whiteSpace: 'nowrap',
                            fontWeight: 500
                        }}>
                            ⏳ {pendingChanges.length} Pending
                        </span>
                    )}

                    <div style={{ flex: 1 }}></div>

                    {onToggleFullScreen && (
                        <button
                            className="btn"
                            style={{
                                padding: '4px 10px',
                                fontSize: '0.75rem',
                                color: 'white',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                            onClick={onToggleFullScreen}
                            title={isFullScreen ? "Close Full View" : "View Changes Full Screen"}
                        >
                            {isFullScreen ? '✕ Close' : '🔍 View Changes'}
                        </button>
                    )}
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
            </div>

            <div className="changes-list" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                flex: isFullScreen ? 1 : 'unset',
                overflow: isFullScreen ? 'auto' : 'visible'
            }}>
                {pendingChanges.length === 0 && (!approvedChanges || approvedChanges.length === 0) && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        padding: '40px 20px',
                        border: '1px dashed var(--border-color)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✨</div>
                        <p>No changes to review</p>
                    </div>
                )}

                {pendingChanges.map((change) => renderChangeCard(change, false))}

                {approvedChanges && approvedChanges.length > 0 && (
                    <div className="approved-changes-section" style={{ marginTop: '24px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '12px',
                            color: '#4ade80',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            <span>✓ Recently Approved</span>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {approvedChanges.map((change) => renderChangeCard(change, true))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChangesPanel;
