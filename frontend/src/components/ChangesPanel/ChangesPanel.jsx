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
    const [expanded, setExpanded] = useState({});


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

    const toggleExpand = (id) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
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
        const agentColor = change.agent === 'Senior Dev' ? '#818cf8' :
            change.agent === 'Junior Dev' ? '#34d399' :
                change.agent === 'Unit Tester' ? '#f59e0b' : '#94a3b8';

        const stats = calculateStats(change.old_content || '', change.new_content || '');

        return (
            <div key={changeId} className={`change-item-inline ${isApproved ? 'approved' : ''}`}>
                <div className="change-header-compact" onClick={() => toggleExpand(changeId)}>
                    <div className="change-info-main">
                        <span className="collapse-toggle">
                            {expanded[changeId] ? '▼' : '▶'}
                        </span>
                        <span className="path-text" title={change.path}>
                            {change.path.split('/').pop()}
                        </span>
                        <span className="agent-tag" style={{ color: agentColor }}>
                            {change.agent}
                        </span>
                        {isApproved && <span className="stat-add" style={{ fontSize: '10px', fontWeight: 700 }}>APPROVED</span>}
                    </div>

                    <div className="mini-stats">
                        <span className="stat-add">+{stats.added}</span>
                        <span className="stat-rem">-{stats.removed}</span>
                    </div>
                </div>

                {expanded[changeId] && (
                    <div className="change-body-compact">
                        <div className="diff-view-container" style={{
                            maxHeight: isFullScreen ? 'calc(100vh - 180px)' : '350px',
                            borderTop: '1px solid rgba(255,255,255,0.03)'
                        }}>
                            <ReactDiffViewer
                                oldValue={change.action === 'create' ? '' : (change.old_content || '')}
                                newValue={change.action === 'delete' ? '' : (change.new_content || '')}
                                splitView={isFullScreen}
                                compareMethod="diffWords"
                                useDarkTheme={true}
                                showDiffOnly={false}
                                hideLineNumbers={false}
                                renderContent={highlightSyntax}
                                styles={{
                                    variables: {
                                        dark: {
                                            diffViewerBackground: 'transparent',
                                            addedBackground: 'rgba(34, 197, 94, 0.1)',
                                            addedColor: '#4ade80',
                                            removedBackground: 'rgba(239, 68, 68, 0.1)',
                                            removedColor: '#f87171',
                                            wordAddedBackground: 'rgba(34, 197, 94, 0.25)',
                                            wordRemovedBackground: 'rgba(239, 68, 68, 0.25)',
                                            gutterBackground: '#0a0a0f',
                                        }
                                    },
                                    contentText: {
                                        fontSize: '0.8rem',
                                        lineHeight: '1.4'
                                    }
                                }}
                            />
                        </div>

                        {!isApproved && (
                            <div className="change-footer-compact">
                                <span style={{ fontSize: '10px', color: '#666', fontFamily: 'var(--font-mono)' }}>
                                    {change.path}
                                </span>
                                <div className="mini-actions">
                                    <button className="btn-mini reject" onClick={(e) => { e.stopPropagation(); onReject(changeId); }}>
                                        Reject
                                    </button>
                                    <button className="btn-mini approve" onClick={(e) => { e.stopPropagation(); onApprove(changeId); }}>
                                        Approve
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (pendingChanges.length === 0 && (!approvedChanges || approvedChanges.length === 0)) {
        return (
            <div className="empty-state-compact">
                <div className="icon">✨</div>
                <h3>No Pending Changes</h3>
                <p>Agent edits will appear here for your review.</p>
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
