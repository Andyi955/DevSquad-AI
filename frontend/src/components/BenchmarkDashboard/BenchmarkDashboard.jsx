import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './BenchmarkDashboard.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

/* ─── Sparkline SVG ─── */
function Sparkline({ data, color = '#9333ea', height = 32 }) {
    if (!data || data.length < 2) return null;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const w = 100;

    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="sparkline-container">
            <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
                <defs>
                    <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                {/* Area fill */}
                <polygon
                    points={`0,${height} ${points} ${w},${height}`}
                    fill={`url(#grad-${color.replace('#', '')})`}
                />
                {/* Line */}
                <polyline
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* Last point dot */}
                {(() => {
                    const last = data[data.length - 1];
                    const x = w;
                    const y = height - ((last - min) / range) * (height - 4) - 2;
                    return <circle cx={x} cy={y} r="3" fill={color} />;
                })()}
            </svg>
        </div>
    );
}

/* ─── Score Chart (canvas-based) ─── */
function ScoreChart({ chartData }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || !chartData || !chartData.runs || chartData.runs.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = rect.height;
        const padding = { top: 20, right: 20, bottom: 30, left: 40 };
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;

        // Clear
        ctx.clearRect(0, 0, w, h);

        const runs = chartData.runs;
        const scores = runs.map(r => r.overall_raw_score || 0);
        const maxScore = Math.max(...scores, 100);
        const minScore = Math.min(...scores, 0);
        const scoreRange = maxScore - minScore || 1;

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (plotH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            // Y labels
            const val = Math.round(maxScore - (scoreRange / 4) * i);
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(val, padding.left - 6, y + 4);
        }

        // Plot line
        if (runs.length > 1) {
            // Area gradient
            const grad = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
            grad.addColorStop(0, 'rgba(147, 51, 234, 0.25)');
            grad.addColorStop(1, 'rgba(147, 51, 234, 0.02)');

            ctx.beginPath();
            runs.forEach((run, i) => {
                const x = padding.left + (i / (runs.length - 1)) * plotW;
                const y = padding.top + (1 - (run.overall_raw_score - minScore) / scoreRange) * plotH;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            // Close area
            const pathEnd = { ...ctx };
            ctx.lineTo(padding.left + plotW, padding.top + plotH);
            ctx.lineTo(padding.left, padding.top + plotH);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();

            // Line
            ctx.beginPath();
            runs.forEach((run, i) => {
                const x = padding.left + (i / (runs.length - 1)) * plotW;
                const y = padding.top + (1 - (run.overall_raw_score - minScore) / scoreRange) * plotH;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.strokeStyle = '#9333ea';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Points
            runs.forEach((run, i) => {
                const x = padding.left + (i / (runs.length - 1)) * plotW;
                const y = padding.top + (1 - (run.overall_raw_score - minScore) / scoreRange) * plotH;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#9333ea';
                ctx.fill();
                ctx.strokeStyle = '#1a1a2e';
                ctx.lineWidth = 2;
                ctx.stroke();
            });

            // X labels (run indices)
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'center';
            runs.forEach((run, i) => {
                if (runs.length <= 10 || i % Math.ceil(runs.length / 10) === 0) {
                    const x = padding.left + (i / (runs.length - 1)) * plotW;
                    ctx.fillText(`#${i + 1}`, x, h - padding.bottom + 16);
                }
            });
        } else if (runs.length === 1) {
            // Single point
            const x = padding.left + plotW / 2;
            const y = padding.top + plotH / 2;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#9333ea';
            ctx.fill();

            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(scores[0].toFixed(1), x, y - 14);
        }
    }, [chartData]);

    return (
        <div className="chart-container">
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
}

/* ─── Main Dashboard Component ─── */
export default function BenchmarkDashboard() {
    const [suites, setSuites] = useState(null);
    const [results, setResults] = useState(null);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showRunModal, setShowRunModal] = useState(false);
    const [selectedSuite, setSelectedSuite] = useState('');
    const [autoMode, setAutoMode] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const pollRef = useRef(null);

    // Optimization loop state
    const [loopStatus, setLoopStatus] = useState({ active: false, status: 'idle' });
    const [loopHistory, setLoopHistory] = useState([]);
    const [showLoopModal, setShowLoopModal] = useState(false);
    const [loopSuite, setLoopSuite] = useState('');
    const [loopMaxIter, setLoopMaxIter] = useState(5);
    const [loopTarget, setLoopTarget] = useState(85);
    const [loopAutoApply, setLoopAutoApply] = useState(false);
    const [isStoppingLoop, setIsStoppingLoop] = useState(false);

    // Pagination & Filters
    const [historyPage, setHistoryPage] = useState(0);
    const [loopHistoryPage, setLoopHistoryPage] = useState(0);
    const [historyItemsPerPage, setHistoryItemsPerPage] = useState(10);
    const [historySortOrder, setHistorySortOrder] = useState('newest'); // 'newest', 'oldest', 'highest_score', 'lowest_score'
    const [historyFilterCategory, setHistoryFilterCategory] = useState('all');
    const LOOP_HISTORY_ITEMS_PER_PAGE = 6;

    // Set default loop suite once suites are loaded
    useEffect(() => {
        if (suites?.suites) {
            const suiteNames = Object.keys(suites.suites);
            if (suiteNames.length > 0 && !suiteNames.includes(loopSuite)) {
                setLoopSuite(suiteNames[0]);
            }
        }
    }, [suites]);

    // Fetch all data
    const fetchAll = useCallback(async () => {
        try {
            const [suitesRes, resultsRes, statusRes, loopRes] = await Promise.all([
                fetch(`${API_BASE}/api/benchmarks/suites`).then(r => r.json()),
                fetch(`${API_BASE}/api/benchmarks/results`).then(r => r.json()),
                fetch(`${API_BASE}/api/benchmarks/status`).then(r => r.json()),
                fetch(`${API_BASE}/api/optimize/loop/status`).then(r => r.json()).catch(() => ({ active: false, status: 'idle' }))
            ]);
            setSuites(suitesRes);
            setResults(resultsRes);
            setStatus(statusRes);
            setIsRunning(statusRes?.status === 'running' || statusRes?.status === 'paused');
            setLoopStatus(loopRes);
            if (!loopRes.active) setIsStoppingLoop(false);
            setError(null);

            // Fetch loop history less frequently (only on first load or when loop finishes)
            if (!loopHistory.length || !loopRes.active) {
                fetch(`${API_BASE}/api/optimize/loop/history`)
                    .then(r => r.json())
                    .then(h => setLoopHistory(Array.isArray(h) ? h : []))
                    .catch(() => { });
            }
        } catch (err) {
            setError('Failed to connect to benchmark API');
            console.error('[Benchmark] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
        pollRef.current = setInterval(fetchAll, 5000);
        return () => clearInterval(pollRef.current);
    }, [fetchAll]);

    // Start a run
    const startRun = async () => {
        if (!selectedSuite) return;
        try {
            setIsRunning(true);
            setShowRunModal(false);
            await fetch(`${API_BASE}/api/benchmarks/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suite: selectedSuite, auto_mode: autoMode })
            });
            fetchAll();
        } catch (err) {
            console.error('[Benchmark] Run error:', err);
            setIsRunning(false);
        }
    };

    // Resume a paused run
    const resumeRun = async () => {
        try {
            await fetch(`${API_BASE}/api/benchmarks/resume`, { method: 'POST' });
            fetchAll();
        } catch (err) {
            console.error('[Benchmark] Resume error:', err);
        }
    };

    // Stop a running suite
    const stopSuite = async () => {
        try {
            await fetch(`${API_BASE}/api/benchmarks/stop`, { method: 'POST' });
            setIsRunning(false);
            fetchAll();
        } catch (err) {
            console.error('[Benchmark] Stop error:', err);
        }
    };

    // Optimization loop controls
    const startLoop = async () => {
        try {
            setShowLoopModal(false);
            await fetch(`${API_BASE}/api/optimize/loop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    suite_id: loopSuite,
                    max_iterations: loopMaxIter,
                    target_score: loopTarget,
                    auto_apply: loopAutoApply
                })
            });
            fetchAll();
        } catch (err) {
            console.error('[OptLoop] Start error:', err);
        }
    };

    const approveLoop = async () => {
        await fetch(`${API_BASE}/api/optimize/loop/approve`, { method: 'POST' });
        fetchAll();
    };

    const rejectLoop = async () => {
        await fetch(`${API_BASE}/api/optimize/loop/reject`, { method: 'POST' });
        fetchAll();
    };

    const stopLoop = async () => {
        try {
            setIsStoppingLoop(true);
            await fetch(`${API_BASE}/api/optimize/loop/stop`, { method: 'POST' });
            fetchAll();
        } catch (err) {
            console.error('[OptLoop] Stop error:', err);
            setIsStoppingLoop(false);
        }
    };

    const deleteLoopRun = async (runId) => {
        if (!confirm('Are you sure you want to delete this optimization run?')) return;
        try {
            await fetch(`${API_BASE}/api/optimize/loop/history/${runId}`, { method: 'DELETE' });
            setLoopHistory(prev => prev.filter(r => r.run_id !== runId));
        } catch (err) {
            console.error('[OptLoop] Delete error:', err);
        }
    };

    // ─── Derived Data ───
    const history = results?.history || [];
    const chartData = results?.chart_data || { runs: [] };
    const trend = results?.trend || {};
    const agentSummary = results?.agent_summary || {};
    const totalRuns = history.length;
    const latestScore = history.length > 0 ? history[history.length - 1]?.overall_raw_score : null;
    const avgScore = history.length > 0
        ? (history.reduce((s, r) => s + (r.overall_raw_score || 0), 0) / history.length).toFixed(1)
        : '—';
    const trendDirection = trend?.direction || 'stable';

    const suitesList = suites?.suites || {};
    const totalBenchmarks = suites?.total_benchmarks || 0;

    const langIcons = { python: '🐍', javascript: '📦', go: '🐹', typescript: '🔷' };
    const getScoreClass = (score) => score >= 80 ? 'high' : score >= 50 ? 'mid' : 'low';

    // ─── Filter & Sort Run History ───
    const historyCategories = useMemo(() => {
        const cats = new Set(history.map(r => r.category || 'misc'));
        return Array.from(cats).sort();
    }, [history]);

    const processedHistory = useMemo(() => {
        let filtered = [...history];

        // Filter
        if (historyFilterCategory && historyFilterCategory !== 'all') {
            filtered = filtered.filter(run => (run.category || 'misc') === historyFilterCategory);
        }

        // Sort
        filtered.sort((rawA, rawB) => {
            // Assign fallback dates for invalid cases
            const aDate = rawA.timestamp ? new Date(rawA.timestamp).getTime() : 0;
            const bDate = rawB.timestamp ? new Date(rawB.timestamp).getTime() : 0;

            if (historySortOrder === 'newest') return bDate - aDate;
            if (historySortOrder === 'oldest') return aDate - bDate;

            const aScore = rawA.overall_raw_score || 0;
            const bScore = rawB.overall_raw_score || 0;
            if (historySortOrder === 'highest_score') return bScore - aScore;
            if (historySortOrder === 'lowest_score') return aScore - bScore;

            return 0; // fallback
        });

        return filtered;
    }, [history, historyFilterCategory, historySortOrder]);

    // Reset pagination when history alters dramatically
    useEffect(() => {
        setHistoryPage(0);
    }, [historyFilterCategory, historySortOrder, historyItemsPerPage]);

    // ─── Render ───
    if (loading) {
        return (
            <div className="benchmark-dashboard">
                <div className="bench-loading">
                    <div className="spinner" />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Loading benchmark data…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="benchmark-dashboard">
                <div className="bench-empty">
                    <div className="empty-icon">⚠️</div>
                    <div className="empty-text">{error}</div>
                    <button className="bench-btn primary" onClick={fetchAll}>🔄 Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="benchmark-dashboard">
            {/* Header */}
            <div className="bench-header">
                <div className="bench-title">
                    <span className="bench-icon">📊</span>
                    <div>
                        <h2>Agent Benchmarks</h2>
                        <p className="bench-subtitle">Run once to evaluate agent performance</p>
                    </div>
                </div>
                <div className="bench-actions">
                    <button className="bench-btn" onClick={fetchAll}>🔄 Refresh</button>
                    {status?.status === 'paused' && (
                        <button className="bench-btn primary" onClick={resumeRun}>▶️ Resume</button>
                    )}
                    {isRunning && (
                        <button className="bench-btn danger" onClick={stopSuite}>⏹ Stop Suite</button>
                    )}
                    <button
                        className="bench-btn primary"
                        onClick={() => setShowRunModal(true)}
                        disabled={isRunning}
                    >
                        🚀 Run Suite
                    </button>
                </div>
            </div>

            {/* Active Run Status */}
            {isRunning && status && (
                <div className="bench-status-banner">
                    <div className="status-info">
                        <div className="status-dot" />
                        <div>
                            <div className="status-text">
                                {status.status === 'paused' ? '⏸ Paused — Awaiting Approval' : '🏃 Running Benchmark Suite'}
                            </div>
                            <div className="status-sub">
                                {status.current_benchmark || 'Initializing...'} • {status.completed || 0}/{status.total || '?'} completed
                            </div>
                        </div>
                    </div>
                    {status.total > 0 && (
                        <div className="bench-progress-bar">
                            <div
                                className="bench-progress-fill"
                                style={{ width: `${((status.completed || 0) / status.total) * 100}%` }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Quick Stats */}
            <div className="bench-stats-row">
                <div className="bench-stat-card purple">
                    <div className="stat-label">Total Runs</div>
                    <div className="stat-value">{totalRuns}</div>
                    <div className="stat-detail">benchmark executions</div>
                </div>
                <div className="bench-stat-card cyan">
                    <div className="stat-label">Latest Score</div>
                    <div className="stat-value">{latestScore !== null ? latestScore.toFixed(1) : '—'}</div>
                    <div className="stat-detail">last run score</div>
                </div>
                <div className="bench-stat-card green">
                    <div className="stat-label">Average Score</div>
                    <div className="stat-value">{avgScore}</div>
                    <div className="stat-detail">across all runs</div>
                </div>
                <div className="bench-stat-card orange">
                    <div className="stat-label">Trend</div>
                    <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                        {trendDirection === 'improving' ? '📈 Improving' :
                            trendDirection === 'degrading' ? '📉 Degrading' : '➡️ Stable'}
                    </div>
                    <div className="stat-detail">
                        {trend.slope !== undefined ? `slope: ${trend.slope.toFixed(3)}` : 'insufficient data'}
                    </div>
                </div>
            </div>

            {/* Score Chart */}
            {chartData.runs && chartData.runs.length > 0 && (
                <div className="bench-chart-section">
                    <h3>📈 Score Over Time</h3>
                    <ScoreChart chartData={chartData} />
                </div>
            )}

            {/* Agent Performance Cards */}
            {Object.keys(agentSummary).length > 0 && (
                <>
                    <div className="bench-chart-section" style={{ padding: '16px 16px 4px' }}>
                        <h3>🤖 Agent Performance</h3>
                    </div>
                    <div className="bench-agent-grid">
                        {Object.entries(agentSummary).map(([agent, data]) => (
                            <div className="agent-perf-card" key={agent}>
                                <div className="agent-card-header">
                                    <span className="agent-name">{agent}</span>
                                    <span className={`trend-badge ${data.trend}`}>
                                        {data.trend === 'improving' ? '↗ Improving' :
                                            data.trend === 'degrading' ? '↘ Degrading' :
                                                data.trend === 'insufficient_data' ? '⏳ New' : '→ Stable'}
                                    </span>
                                </div>
                                <div className="agent-score">{data.avg_score?.toFixed(1) || '—'}</div>
                                <Sparkline
                                    data={data.last_5_scores}
                                    color={data.trend === 'improving' ? '#00ff88' : data.trend === 'degrading' ? '#ff5555' : '#9333ea'}
                                />
                                <div className="agent-meta">
                                    <span>{data.run_count} runs</span>
                                    <span>slope: {data.slope?.toFixed(3) || '0'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Available Suites */}
            <div className="bench-suites-section">
                <h3>📦 Available Suites ({totalBenchmarks} benchmarks)</h3>
                <div className="suite-grid">
                    {Object.entries(suitesList).map(([name, suite]) => (
                        <div
                            key={name}
                            className="suite-card"
                            onClick={() => { setSelectedSuite(name); setShowRunModal(true); }}
                        >
                            <div className="suite-lang-icon">{langIcons[name] || '📋'}</div>
                            <div className="suite-name">{name}</div>
                            <div className="suite-count">{suite.count} benchmarks</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Run History Table */}
            {
                history.length > 0 && (
                    <div className="bench-history-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h3 style={{ margin: 0 }}>🕓 Run History</h3>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <select
                                        className="bench-btn"
                                        style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                                        value={historyFilterCategory}
                                        onChange={e => setHistoryFilterCategory(e.target.value)}
                                    >
                                        <option value="all">All Categories</option>
                                        {historyCategories.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="bench-btn"
                                        style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                                        value={historySortOrder}
                                        onChange={e => setHistorySortOrder(e.target.value)}
                                    >
                                        <option value="newest">Newest First</option>
                                        <option value="oldest">Oldest First</option>
                                        <option value="highest_score">Highest Score</option>
                                        <option value="lowest_score">Lowest Score</option>
                                    </select>
                                </div>
                            </div>
                            <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center' }}>
                                <select
                                    className="bench-btn"
                                    style={{ padding: '2px 6px', fontSize: '0.65rem', marginRight: '8px' }}
                                    value={historyItemsPerPage}
                                    onChange={e => setHistoryItemsPerPage(Number(e.target.value))}
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <button
                                    className="bench-btn"
                                    disabled={historyPage === 0}
                                    onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                                    style={{ padding: '2px 8px', fontSize: '10px' }}
                                >
                                    ◀ Prev
                                </button>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 8px' }}>
                                    Page {historyPage + 1} of {Math.max(1, Math.ceil(processedHistory.length / historyItemsPerPage))}
                                </span>
                                <button
                                    className="bench-btn"
                                    disabled={historyPage >= Math.ceil(processedHistory.length / historyItemsPerPage) - 1}
                                    onClick={() => setHistoryPage(p => p + 1)}
                                    style={{ padding: '2px 8px', fontSize: '10px' }}
                                >
                                    Next ▶
                                </button>
                            </div>
                        </div>
                        <table className="history-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Benchmark</th>
                                    <th>Category</th>
                                    <th>Difficulty</th>
                                    <th>Score</th>
                                    <th>Weighted</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedHistory.slice(historyPage * historyItemsPerPage, (historyPage + 1) * historyItemsPerPage).map((run, i) => {
                                    const originalIndex = history.findIndex(r => r === run);
                                    return (
                                        <tr key={run.run_id || i}>
                                            <td style={{ color: 'var(--text-muted)' }}>{history.length - originalIndex}</td>
                                            <td>{run.benchmark_id || '—'}</td>
                                            <td>{run.category || '—'}</td>
                                            <td>{run.difficulty || '—'}</td>
                                            <td>
                                                <span className={`score-pill ${getScoreClass(run.overall_raw_score)}`}>
                                                    {run.overall_raw_score?.toFixed(1) || '—'}
                                                </span>
                                            </td>
                                            <td>{run.overall_weighted_score?.toFixed(1) || '—'}</td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                                                {run.timestamp ? new Date(run.timestamp).toLocaleString() : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            }

            {/* Empty state */}
            {
                history.length === 0 && Object.keys(agentSummary).length === 0 && (
                    <div className="bench-empty">
                        <div className="empty-icon">🧪</div>
                        <div className="empty-text">
                            No benchmark runs yet. Click <strong>Run Suite</strong> to evaluate your agents across coding challenges.
                        </div>
                    </div>
                )
            }

            {/* ═══════ Optimization Loop Section ═══════ */}
            <div className="bench-opt-section">
                <div className="bench-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div className="bench-title">
                        <span className="bench-icon">🔄</span>
                        <div>
                            <h2>Self-Optimization Loop</h2>
                            <p className="bench-subtitle">Iteratively benchmark → review → optimize prompts → repeat</p>
                        </div>
                    </div>
                    <div className="bench-actions">
                        {loopStatus.active && (
                            <button
                                className="bench-btn danger"
                                onClick={stopLoop}
                                disabled={isStoppingLoop || loopStatus.stop_requested}
                            >
                                {isStoppingLoop || loopStatus.stop_requested ? '⏳ Stopping...' : '⏹ Stop'}
                            </button>
                        )}
                        <button
                            className="bench-btn primary"
                            onClick={() => setShowLoopModal(true)}
                            disabled={loopStatus.active}
                        >
                            ⚡ Start Loop
                        </button>
                    </div>
                </div>

                {/* Live status when loop is active */}
                {loopStatus.active && (
                    <div className="loop-live-status">
                        <div className="loop-status-header">
                            <div className="status-dot" style={{ background: loopStatus.waiting_for_approval ? '#f59e0b' : '#00ff88' }} />
                            <span className="loop-phase">
                                {loopStatus.waiting_for_approval
                                    ? '⏸ Awaiting Approval'
                                    : loopStatus.status?.includes('optimizing')
                                        ? '⚡ Optimizing Prompts'
                                        : '🏃 Running Benchmark'}
                            </span>
                            <span className="loop-iter">
                                Iteration {loopStatus.current_iteration}/{loopStatus.max_iterations}
                            </span>
                        </div>

                        {/* Score progress sparkline */}
                        {loopStatus.scores?.length > 0 && (
                            <div className="loop-scores">
                                <Sparkline data={loopStatus.scores} color="#00ff88" height={36} />
                                <div className="loop-scores-meta">
                                    <span>Best: <strong>{loopStatus.best_score?.toFixed(1)}</strong></span>
                                    <span>Target: {loopStatus.target_score}</span>
                                    <span>Mode: {loopStatus.auto_apply ? '🤖 Auto' : '👤 Manual'}</span>
                                </div>
                            </div>
                        )}

                        {/* Recent Iterations Log */}
                        {loopStatus.iterations?.length > 0 && (
                            <div className="loop-iterations-log" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <h4 style={{ fontSize: '0.7rem', margin: '0 0 8px 0', color: 'var(--text-main)' }}>Progress Log</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                                    {loopStatus.iterations.map((iter, i) => (
                                        <div key={i} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ fontWeight: 'bold' }}>Iter {i + 1}</span>
                                            <span style={{ color: 'var(--neon-green)', fontWeight: 'bold' }}>Score: {iter.score.toFixed(1)}</span>
                                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-muted)' }}>
                                                {iter.note || (iter.applied ? 'Proposed ' + (iter.changes?.length || 0) + ' Changes (Applied)' : (iter.changes?.length > 0 ? 'Proposed changes (Rejected)' : 'No Changes'))}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Pending changes for approval */}
                        {loopStatus.waiting_for_approval && loopStatus.pending_changes?.length > 0 && (
                            <div className="loop-pending">
                                <h4>Proposed Prompt Changes ({loopStatus.pending_changes.length})</h4>
                                <div className="pending-changes-list">
                                    {loopStatus.pending_changes.map((change, i) => (
                                        <div className="pending-change" key={i}>
                                            <span className="change-file">{change.file}</span>
                                            <span className="change-action">{change.action}</span>
                                            <span className="change-reason">{change.reason}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="loop-approval-actions">
                                    <button className="bench-btn primary" onClick={approveLoop}>✅ Approve & Apply</button>
                                    <button className="bench-btn" onClick={rejectLoop}>❌ Reject</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Loop history */}
                {loopHistory.length > 0 && (
                    <div className="loop-history">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <h4 style={{ margin: 0 }}>Past Optimization Runs</h4>
                            <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center' }}>
                                <button
                                    className="bench-btn"
                                    disabled={loopHistoryPage === 0}
                                    onClick={() => setLoopHistoryPage(p => Math.max(0, p - 1))}
                                    style={{ padding: '2px 8px', fontSize: '10px' }}
                                >
                                    ◀ Prev
                                </button>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 8px' }}>
                                    Page {loopHistoryPage + 1} of {Math.ceil(loopHistory.length / LOOP_HISTORY_ITEMS_PER_PAGE)}
                                </span>
                                <button
                                    className="bench-btn"
                                    disabled={loopHistoryPage >= Math.ceil(loopHistory.length / LOOP_HISTORY_ITEMS_PER_PAGE) - 1}
                                    onClick={() => setLoopHistoryPage(p => p + 1)}
                                    style={{ padding: '2px 8px', fontSize: '10px' }}
                                >
                                    Next ▶
                                </button>
                            </div>
                        </div>
                        <div className="loop-history-grid">
                            {[...loopHistory].reverse().slice(loopHistoryPage * LOOP_HISTORY_ITEMS_PER_PAGE, (loopHistoryPage + 1) * LOOP_HISTORY_ITEMS_PER_PAGE).map((run, i) => {
                                let badgeClass = run.status || 'default';
                                if (badgeClass.startsWith('waiting_approval_iteration')) badgeClass = 'waiting_approval_iteration';

                                let formattedStatus = run.status || '—';
                                if (formattedStatus.startsWith('waiting_approval_iteration')) formattedStatus = 'Awaiting Approval';
                                else if (formattedStatus === 'max_iterations') formattedStatus = 'Max Iterations';
                                else if (formattedStatus === 'no_improvement') formattedStatus = 'No Improvement';
                                else formattedStatus = formattedStatus.charAt(0).toUpperCase() + formattedStatus.slice(1);

                                return (
                                    <div className="loop-run-card" key={run.run_id || i}>
                                        <div className="loop-run-header">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                <span className={`loop-status-badge ${badgeClass}`} style={{
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px'
                                                }} title={formattedStatus}>{formattedStatus}</span>
                                                <span className="loop-run-id">#{run.run_id}</span>
                                            </div>
                                            <button
                                                className="run-delete-btn"
                                                onClick={(e) => { e.stopPropagation(); deleteLoopRun(run.run_id); }}
                                                title="Delete Run"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                        <div style={{ padding: '0 4px', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                            {run.iterations?.length > 0 && (
                                                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    ℹ️ {run.iterations[run.iterations.length - 1].note || `Finished after ${run.iterations.length} iterations`}
                                                </div>
                                            )}
                                        </div>
                                        <div className="loop-run-scores">
                                            <span>Best: <strong className="score-val">{run.best_score?.toFixed(1)}</strong></span>
                                            <span>Final: {run.final_score?.toFixed(1)}</span>
                                        </div>
                                        <div className="loop-run-meta">
                                            <span>{run.iterations?.length || 0} iterations</span>
                                            <span>{run.suite_id}</span>
                                        </div>
                                        {run.iterations?.length > 0 && (
                                            <Sparkline
                                                data={run.iterations.map(it => it.score)}
                                                color={run.status === 'converged' ? '#00ff88' : '#9333ea'}
                                                height={24}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Empty loop state */}
                {!loopStatus.active && loopHistory.length === 0 && (
                    <div className="bench-empty" style={{ marginTop: '8px' }}>
                        <div className="empty-icon">🔄</div>
                        <div className="empty-text">
                            The optimization loop iterates: <strong>benchmark → review → optimize prompts → repeat</strong>.
                            Click <strong>Start Loop</strong> to begin self-improvement.
                        </div>
                    </div>
                )}
            </div>

            {/* Run Modal */}
            {
                showRunModal && (
                    <div className="bench-modal-overlay" onClick={() => setShowRunModal(false)}>
                        <div className="bench-modal" onClick={e => e.stopPropagation()}>
                            <h3>🚀 Start Benchmark Run</h3>

                            <div className="modal-field">
                                <label>Suite</label>
                                <select value={selectedSuite} onChange={e => setSelectedSuite(e.target.value)}>
                                    <option value="">Select a suite…</option>
                                    {Object.entries(suitesList).map(([name, suite]) => (
                                        <option key={name} value={name}>
                                            {name} ({suite.count} benchmarks)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="modal-checkbox">
                                <input
                                    type="checkbox"
                                    id="auto-mode"
                                    checked={autoMode}
                                    onChange={e => setAutoMode(e.target.checked)}
                                />
                                <label htmlFor="auto-mode">Auto mode (skip approval gate between benchmarks)</label>
                            </div>

                            <div className="modal-actions">
                                <button className="bench-btn" onClick={() => setShowRunModal(false)}>Cancel</button>
                                <button
                                    className="bench-btn primary"
                                    onClick={startRun}
                                    disabled={!selectedSuite}
                                >
                                    ▶️ Start
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Optimization Loop Modal */}
            {
                showLoopModal && (
                    <div className="bench-modal-overlay" onClick={() => setShowLoopModal(false)}>
                        <div className="bench-modal" onClick={e => e.stopPropagation()}>
                            <h3>⚡ Start Optimization Loop</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '12px' }}>
                                Iterates: benchmark → review → optimize prompts → repeat until convergence.
                            </p>

                            <div className="modal-field">
                                <label>Suite</label>
                                <select value={loopSuite} onChange={e => setLoopSuite(e.target.value)}>
                                    {Object.entries(suitesList).map(([name, suite]) => (
                                        <option key={name} value={name}>{name} ({suite.count} benchmarks)</option>
                                    ))}
                                </select>
                            </div>

                            <div className="modal-field">
                                <label>Max Iterations</label>
                                <input
                                    type="number" min="1" max="20"
                                    value={loopMaxIter}
                                    onChange={e => setLoopMaxIter(parseInt(e.target.value) || 5)}
                                />
                            </div>

                            <div className="modal-field">
                                <label>Target Score</label>
                                <input
                                    type="number" min="0" max="100" step="5"
                                    value={loopTarget}
                                    onChange={e => setLoopTarget(parseFloat(e.target.value) || 85)}
                                />
                            </div>

                            <div className="modal-checkbox">
                                <input
                                    type="checkbox"
                                    id="loop-auto"
                                    checked={loopAutoApply}
                                    onChange={e => setLoopAutoApply(e.target.checked)}
                                />
                                <label htmlFor="loop-auto">Auto-apply prompt changes (skip approval each iteration)</label>
                            </div>

                            <div className="modal-actions">
                                <button className="bench-btn" onClick={() => setShowLoopModal(false)}>Cancel</button>
                                <button className="bench-btn primary" onClick={startLoop}>⚡ Start Loop</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
