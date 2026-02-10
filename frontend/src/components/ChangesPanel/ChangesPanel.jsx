import React, { useState } from 'react';
import './ChangesPanel.css';
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
        const agentColor = change.agent === 'Senior Dev' ? '#818cf8' :
            change.agent === 'Junior Dev' ? '#34d399' :
                change.agent === 'Unit Tester' ? '#f59e0b' : '#94a3b8';

        return (
            <div key={changeId} className="card" style={{
                border: isApproved ? '1px solid rgba(34, 197, 94, 0.1)' : '1px solid rgba(255,255,255,0.05)',
                background: isApproved ? 'rgba(34, 197, 94, 0.02)' : 'rgba(255,255,255,0.02)',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease',
                opacity: isApproved ? 0.7 : 1,
            }}>
                <div className="change-header" style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    gap: '10px'
                }} onClick={() => toggleCollapse(changeId)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            background: 'rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            flexShrink: 0
                        }}>
                            {change.action === 'create' ? '➕' : change.action === 'delete' ? '🗑️' : '✏️'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                    fontWeight: 600,
                                    fontSize: '13px',
                                    color: '#eee',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {change.path.split('/').pop()}
                                </span>
                                {isApproved && (
                                    <span style={{
                                        fontSize: '9px',
                                        color: '#22c55e',
                                        background: 'rgba(34, 197, 94, 0.1)',
                                        padding: '1px 5px',
                                        borderRadius: '3px',
                                        fontWeight: '700',
                                        textTransform: 'uppercase'
                                    }}>
                                        Approved
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#666' }}>
                                <span style={{ color: agentColor, fontWeight: 500 }}>{change.agent}</span>
                                <span>•</span>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                    {change.path}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{
                            fontSize: '10px',
                            transform: collapsed[changeId] ? 'rotate(-90deg)' : 'none',
                            transition: 'transform 0.2s',
                            opacity: 0.5
                        }}>
                            ▼
                        </span>
                    </div>
                </div>

                {!collapsed[changeId] && (
                    <div className="change-body" style={{ display: 'flex', flexDirection: 'column' }}>
                        {isFullScreen ? (
                            <div className="diff-view-container" style={{
                                maxHeight: isFullScreen ? 'calc(100vh - 140px)' : '400px',
                                overflow: 'auto',
                                background: '#1e1e1e',
                                fontSize: '0.875rem',
                                minWidth: 0
                            }}>
                                <ReactDiffViewer
                                    oldValue={change.action === 'create' ? '' : (change.old_content || '')}
                                    newValue={change.action === 'delete' ? '' : (change.new_content || '')}
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
                                            fontSize: isFullScreen ? '0.875rem' : '0.8rem',
                                            lineHeight: '1.6',
                                            paddingLeft: '12px',
                                            textAlign: 'left',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-all'
                                        }
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="change-stats" style={{
                                padding: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '24px',
                                background: 'rgba(0,0,0,0.15)',
                                borderTop: '1px solid rgba(255,255,255,0.03)'
                            }}>
                                {(() => {
                                    const stats = calculateStats(change.old_content || '', change.new_content || '');
                                    return (
                                        <>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <span style={{ fontSize: '1rem', color: '#22c55e', fontWeight: 'bold' }}>+{stats.added}</span>
                                                <span style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase' }}>Added</span>
                                            </div>
                                            <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.05)' }}></div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <span style={{ fontSize: '1rem', color: '#ef4444', fontWeight: 'bold' }}>-{stats.removed}</span>
                                                <span style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase' }}>Removed</span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {!isApproved && (
                            <div className="change-actions" style={{
                                display: 'flex',
                                gap: '8px',
                                padding: '10px 12px',
                                borderTop: '1px solid rgba(255,255,255,0.03)',
                                background: 'rgba(255,255,255,0.01)'
                            }}>
                                <button
                                    className="btn btn-success compact"
                                    style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: '600' }}
                                    onClick={() => onApprove(changeId)}
                                >
                                    Approve
                                </button>
                                <button
                                    className="btn btn-danger compact"
                                    style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: '600', opacity: 0.6 }}
                                    onClick={() => onReject(changeId)}
                                >
                                    Reject
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
            <div className="research-panel" style={{ height: '100%' }}>
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
                    <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>No Pending Changes</h3>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>Agent edits will appear here for your review.</p>
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



    const combinedContainerStyle = {
        ...containerStyle,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
    };

    return (
        <div className="research-panel" style={combinedContainerStyle} onClick={handleContainerClick}>
            <div className="panel-header" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '12px',
                borderBottom: '1px solid var(--border-color)',
                background: isFullScreen ? 'var(--bg-secondary)' : 'transparent',
                padding: isFullScreen ? '12px 16px' : '8px 12px',
                borderRadius: '0',
                flexShrink: 0
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
                gap: '8px',
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingRight: '2px'
            }}>
                {pendingChanges.length === 0 && (!approvedChanges || approvedChanges.length === 0) && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        height: '100%',
                        padding: '40px 20px',
                    }}>
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✨</div>
                        <p>No changes to review</p>
                    </div>
                )}

                {pendingChanges.map((change) => renderChangeCard(change, false))}

                {approvedChanges && approvedChanges.length > 0 && (
                    <div className="approved-changes-section" style={{ marginTop: '16px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '10px',
                            color: '#22c55e',
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            opacity: 0.6
                        }}>
                            <span>Recently Approved</span>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }}></div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {approvedChanges.map((change) => renderChangeCard(change, true))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChangesPanel;
