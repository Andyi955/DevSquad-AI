import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import './DeepResearchView.css'

/**
 * DeepResearchView - A premium visualization for tandem researcher agents
 */
function DeepResearchView({ results, isResearching, currentStatus, report, onSearch }) {
    const [phase, setPhase] = useState('idle') // idle, planning, searching, reading, synthesizing, complete
    const [viewMode, setViewMode] = useState('report') // report, sources
    const [localQuery, setLocalQuery] = useState('')
    const [cyclingMessage, setCyclingMessage] = useState('Agents working tirelessly for you...')

    const synthesisMessages = [
        "Analyzing research data...",
        "Identifying high-value targets...",
        "Simulating specialized read process...",
        "Synthesizing authoritative sources...",
        "This may take a couple of minutes...",
        "Almost there, formatting the report...",
        "DeepSeek is thinking tirelessly...",
        "Removing redundant noise...",
        "Finalizing Executive Summary..."
    ];

    useEffect(() => {
        if (phase === 'synthesizing' && isResearching) {
            let i = 0;
            const interval = setInterval(() => {
                i = (i + 1) % synthesisMessages.length;
                setCyclingMessage(synthesisMessages[i]);
            }, 3500);
            return () => clearInterval(interval);
        }
    }, [phase, isResearching]);

    const handleLocalSearch = (e) => {
        e.preventDefault()
        if (localQuery.trim() && onSearch) {
            onSearch(localQuery.trim())
            setLocalQuery('')
        }
    }

    const [isWorkflowCollapsed, setIsWorkflowCollapsed] = useState(false)

    useEffect(() => {
        if (isResearching) {
            const status = currentStatus?.toLowerCase() || '';

            // Priority: Synthesizing
            if (status.includes('synthesis') || status.includes('🧠') || status.includes('analyzing')) {
                setPhase('synthesizing');
            }
            // Searching/Reading pattern: "[1/3]" or "reading" or "fetching" or "🌐"
            else if (status.includes('reading') || status.includes('🌐') || status.includes('fetching') || /\[\d+\/\d+\]/.test(status)) {
                setPhase('searching');
            }
            // Planning/Initializing
            else if (status.includes('initializing') || status.includes('🔬') || status.includes('plan')) {
                setPhase('planning');
            }
            else {
                // Default to planning if we just started, or searching if we have results but no report yet
                setPhase(results.length > 0 ? 'searching' : 'planning');
            }
            setIsWorkflowCollapsed(false); // Always expand when researching
        } else if (results.length > 0 || report) {
            setPhase('complete')
            if (report && viewMode !== 'report') setViewMode('report')

            // Auto-collapse when report is done
            if (report) {
                setIsWorkflowCollapsed(true)
            }
        }
    }, [isResearching, currentStatus, results, report, viewMode])

    return (
        <div className="deep-research-container glass-card">
            <div className={`research-top-section ${isWorkflowCollapsed ? 'collapsed' : ''}`}>
                <header className="deep-research-header">
                    <div className="header-top-row">
                        <div className="research-title">
                            <h3>DEEP RESEARCH</h3>
                        </div>
                        <div className="research-status-pill">
                            <span className={`pulse-dot ${isResearching ? 'active' : ''}`}></span>
                            {isResearching ? phase.toUpperCase() : 'ARCHIVE'}
                        </div>
                    </div>

                    <div className="header-main-row">
                        <form onSubmit={handleLocalSearch} className="deep-research-input-wrapper">
                            <input
                                type="text"
                                className="deep-search-bar"
                                placeholder="Ask for a deep dive research mission..."
                                value={localQuery}
                                onChange={(e) => setLocalQuery(e.target.value)}
                                disabled={isResearching}
                            />
                            <button type="submit" className="deep-search-btn" disabled={isResearching}>
                                {isResearching ? '...' : '🔍 Initiate'}
                            </button>
                        </form>
                    </div>

                    <div className="header-bottom-row">
                        {!isResearching && report && (
                            <div className="report-actions">
                                <div className="report-badge">
                                    ✨ FINAL REPORT READY
                                </div>
                                <button
                                    className="download-btn"
                                    onClick={() => {
                                        const blob = new Blob([report], { type: 'text/markdown' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `Deep_Research_Report_${new Date().getTime()}.md`;
                                        a.click();
                                    }}
                                >
                                    📥 Download .md
                                </button>
                            </div>
                        )}
                        {!isResearching && results.length > 0 && !report && (
                            <div className="view-toggle">
                                <button className="active">
                                    🔍 Raw Sources ({results.length})
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                <div className="research-workflow">
                    <WorkflowStep
                        title="Strategic Planning"
                        status={phase === 'planning' ? 'active' : (['searching', 'synthesizing', 'complete'].includes(phase) ? 'done' : 'pending')}
                        icon="🎯"
                    />
                    <WorkflowStep
                        title="Tandem Search"
                        status={phase === 'searching' ? 'active' : (['synthesizing', 'complete'].includes(phase) ? 'done' : 'pending')}
                        icon="🕵️‍♂️"
                    />
                    <WorkflowStep
                        title="Intelligent Synthesis"
                        status={phase === 'synthesizing' ? 'active' : (phase === 'complete' ? 'done' : 'pending')}
                        icon="🧠"
                    />
                </div>
            </div>

            {(results.length > 0 || report) && (
                <div
                    className={`workflow-expander ${isWorkflowCollapsed ? 'collapsed' : ''}`}
                    onClick={() => setIsWorkflowCollapsed(!isWorkflowCollapsed)}
                    title={isWorkflowCollapsed ? "Show Research Steps" : "Hide Research Steps"}
                >
                    <div className="expander-arrow"></div>
                </div>
            )}

            <div className="research-content-area">
                {isResearching && (
                    <div className="current-action-display">
                        <div className="loader-ring"></div>
                        <p>{phase === 'synthesizing' ? cyclingMessage : (currentStatus || 'Orchestrating agents...')}</p>
                    </div>
                )}

                {!isResearching && !results.length && !report && (
                    <div className="empty-research-state">
                        <div className="empty-icon">🌐</div>
                        <h3>No Active Research</h3>
                        <p>Initiate deep research by asking for analysis or a thorough report.</p>
                    </div>
                )}

                {!isResearching && viewMode === 'report' && report && (
                    <div className="synthetic-report-view glass-card fade-in">
                        <div className="report-markdown">
                            <ReactMarkdown>
                                {report.split('### 🔗 Source Verification')[0]}
                            </ReactMarkdown>

                            {report.includes('### 🔗 Source Verification') && (
                                <div className="report-sources-section">
                                    <div className="sources-header">
                                        <span className="sources-icon">🔗</span>
                                        <span className="sources-title">Research Sources</span>
                                        <span className="sources-dots">...</span>
                                    </div>
                                    <div className="sources-content">
                                        <ReactMarkdown>
                                            {report.split('### 🔗 Source Verification')[1]}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!isResearching && !report && results.length > 0 && (
                    <div className="research-results-grid fade-in">
                        {results.map((res, i) => (
                            <div key={i} className="research-card glass-card">
                                <h3>{res.title}</h3>
                                <p className="snippet">{res.snippet}</p>
                                <a href={res.url} target="_blank" rel="noreferrer" className="source-link">
                                    Visit Source ↗
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function WorkflowStep({ title, status, icon }) {
    return (
        <div className={`workflow-step ${status}`}>
            <div className="step-icon">{icon}</div>
            <div className="step-info">
                <span className="step-label">{title}</span>
                <span className="step-status-text">{status.toUpperCase()}</span>
            </div>
            <div className="step-line"></div>
        </div>
    )
}

export default DeepResearchView
