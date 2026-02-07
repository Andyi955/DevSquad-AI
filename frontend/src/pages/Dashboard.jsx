import React, { useState, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
    TrendingUp, AlertCircle, CheckCheck, Check, X, ArrowRight, Brain, Activity, MessageSquare, Zap, ChevronDown, ChevronUp, Clock, Target, History, Plus, Archive
} from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

const Dashboard = () => {
    const [data, setData] = useState({ reviews: [], stats: { history: [] } });
    const [historyList, setHistoryList] = useState({ archived_sessions: [] });
    const [loading, setLoading] = useState(true);
    const [expandedCards, setExpandedCards] = useState({});
    const [activeTab, setActiveTab] = useState('current');
    const [selectedSession, setSelectedSession] = useState(null);

    useEffect(() => {
        fetchData();
        fetchHistory();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch(`${API_URL}/reviews`);
            const json = await res.json();
            setData(json);
            setLoading(false);
        } catch (err) {
            console.error("Failed to fetch reviews:", err);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch(`${API_URL}/reviews/history`);
            const json = await res.json();
            setHistoryList(json);
        } catch (err) {
            console.error("Failed to fetch history:", err);
        }
    };

    const startNewSession = async () => {
        if (!window.confirm('Start a new review session? Current reviews will be archived.')) return;
        try {
            const res = await fetch(`${API_URL}/reviews/new-session`, { method: 'POST' });
            await res.json();
            fetchData();
            fetchHistory();
            setActiveTab('current');
        } catch (err) {
            alert('Failed to start new session');
        }
    };

    const viewSessionDetails = async (sessionId) => {
        try {
            const res = await fetch(`${API_URL}/reviews/history/${sessionId}`);
            const session = await res.json();
            setSelectedSession(session);
        } catch (err) {
            alert('Failed to load session details');
        }
    };

    const applySuggestion = async (suggestion) => {
        try {
            const res = await fetch(`${API_URL}/reviews/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(suggestion)
            });
            const result = await res.json();
            if (result.status === 'success') {
                alert('Improvement applied! Check your file changes.');
            } else {
                alert('Failed: ' + result.message);
            }
        } catch (err) {
            alert('Error applying suggestion');
        }
    };

    const toggleCard = (id) => {
        setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.loadingContent}>
                    <Brain style={{ animation: 'bounce 1s infinite' }} color="#ec4899" size={48} />
                    <p style={styles.loadingText}>Initializing Review Neural Net...</p>
                </div>
            </div>
        );
    }

    const allCritiques = data.reviews.flatMap(r =>
        (r.reviews || []).map(c => ({ ...c, timestamp: r.timestamp }))
    ).reverse();

    const latestReview = data.reviews?.[data.reviews.length - 1] || {};
    const improvements = latestReview.prompt_improvements || [];
    const historyData = data.stats?.history || [];

    const avgScore = historyData.length > 0
        ? Math.round(historyData.reduce((acc, curr) => acc + curr.score, 0) / historyData.length * 10) / 10
        : 0;

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <div style={styles.brainIcon}>
                        <Brain color="#ec4899" size={20} />
                    </div>
                    <div>
                        <h1 style={styles.title}>Review Agent Dashboard</h1>
                        <div style={styles.liveIndicator}>
                            <span style={styles.liveDot}></span>
                            SESSION: {data.session_id || '---'}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={styles.tabsContainer}>
                    <button
                        onClick={() => { setActiveTab('current'); setSelectedSession(null); }}
                        style={{
                            ...styles.tabButton,
                            ...(activeTab === 'current' ? styles.tabButtonActive : {})
                        }}
                    >
                        <Activity size={14} /> Current
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        style={{
                            ...styles.tabButton,
                            ...(activeTab === 'history' ? styles.tabButtonActive : {})
                        }}
                    >
                        <Archive size={14} /> History ({historyList.archived_sessions?.length || 0})
                    </button>
                    <button
                        onClick={startNewSession}
                        style={styles.newSessionButton}
                        title="Start new review session"
                    >
                        <Plus size={14} /> New Session
                    </button>
                </div>

                <div style={styles.statsRow}>
                    <StatBadge
                        label="Score"
                        value={avgScore || "N/A"}
                        icon={<Target size={14} />}
                        color={avgScore >= 7 ? "#22c55e" : avgScore >= 4 ? "#eab308" : "#ef4444"}
                    />
                    <StatBadge
                        label="Reviews"
                        value={allCritiques.length}
                        icon={<MessageSquare size={14} />}
                        color="#8b5cf6"
                    />
                    <StatBadge
                        label="Pending"
                        value={improvements.length}
                        icon={<Zap size={14} />}
                        color={improvements.length > 0 ? "#f59e0b" : "#6b7280"}
                    />
                </div>
            </div>

            {/* Main Content */}
            {activeTab === 'current' ? (
                <div style={styles.mainContent}>
                    {/* Left Panel - Critiques */}
                    <div style={styles.leftPanel}>
                        {/* Mini Chart */}
                        <div style={styles.chartSection}>
                            <div style={styles.sectionHeader}>
                                <h2 style={styles.sectionTitle}>Performance Trend</h2>
                                <span style={styles.badge}>{historyData.length} turns</span>
                            </div>
                            <div style={styles.chartContainer}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={historyData}>
                                        <defs>
                                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                                        <XAxis dataKey="timestamp" hide />
                                        <YAxis hide domain={[0, 10]} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                            itemStyle={{ color: '#ec4899' }}
                                            formatter={(val) => [`${val}/10`, 'Score']}
                                            labelFormatter={() => ''}
                                        />
                                        <Area type="monotone" dataKey="score" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Critiques Feed */}
                        <div style={styles.critiquesFeed}>
                            <div style={styles.sectionHeader}>
                                <h2 style={styles.sectionTitle}>Live Critique Feed</h2>
                                <span style={styles.badge}>{allCritiques.length} items</span>
                            </div>
                            <div style={styles.scrollableContent}>
                                {allCritiques.length === 0 ? (
                                    <div style={styles.emptyState}>
                                        <Clock size={32} style={{ opacity: 0.3 }} />
                                        <p>Waiting for agent activity...</p>
                                    </div>
                                ) : (
                                    allCritiques.map((critique, idx) => (
                                        <CritiqueCard
                                            key={idx}
                                            data={critique}
                                            isExpanded={expandedCards[`critique-${idx}`]}
                                            onToggle={() => toggleCard(`critique-${idx}`)}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Improvements */}
                    <div style={styles.rightPanel}>
                        <div style={styles.sectionHeader}>
                            <h2 style={styles.sectionTitle}>
                                <Zap size={16} color="#f59e0b" /> Improvements
                            </h2>
                            <span style={{ ...styles.badge, background: improvements.length > 0 ? 'rgba(245, 158, 11, 0.2)' : undefined }}>
                                {improvements.length}
                            </span>
                        </div>
                        <div style={styles.scrollableContent}>
                            {improvements.length === 0 ? (
                                <div style={styles.emptyState}>
                                    <CheckCheck size={32} style={{ opacity: 0.3, color: '#22c55e' }} />
                                    <p>All systems nominal</p>
                                    <span style={{ fontSize: '12px', color: '#666' }}>No improvements needed</span>
                                </div>
                            ) : (
                                improvements.map((imp, idx) => (
                                    <ImprovementCard
                                        key={idx}
                                        data={imp}
                                        onApply={() => applySuggestion(imp)}
                                        isExpanded={expandedCards[`imp-${idx}`]}
                                        onToggle={() => toggleCard(`imp-${idx}`)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* History Panel */
                <div style={styles.historyPanel}>
                    {selectedSession ? (
                        <div style={styles.sessionDetails}>
                            <div style={styles.sessionDetailsHeader}>
                                <button onClick={() => setSelectedSession(null)} style={styles.backButton}>
                                    ← Back to History
                                </button>
                                <h2 style={styles.sessionTitle}>Session: {selectedSession.session_id}</h2>
                                <span style={styles.sessionMeta}>
                                    {new Date(selectedSession.started_at).toLocaleString()} - {new Date(selectedSession.ended_at).toLocaleString()}
                                </span>
                            </div>
                            <div style={styles.sessionStats}>
                                <div style={styles.sessionStatItem}>
                                    <span style={styles.sessionStatLabel}>Reviews</span>
                                    <span style={styles.sessionStatValue}>{selectedSession.review_count}</span>
                                </div>
                                <div style={styles.sessionStatItem}>
                                    <span style={styles.sessionStatLabel}>Avg Score</span>
                                    <span style={{
                                        ...styles.sessionStatValue,
                                        color: selectedSession.average_score >= 70 ? '#22c55e' : selectedSession.average_score >= 40 ? '#eab308' : '#ef4444'
                                    }}>{selectedSession.average_score}</span>
                                </div>
                            </div>
                            <div style={styles.scrollableContent}>
                                {(selectedSession.reviews || []).flatMap(r =>
                                    (r.reviews || []).map(c => ({ ...c, timestamp: r.timestamp }))
                                ).map((critique, idx) => (
                                    <CritiqueCard
                                        key={idx}
                                        data={critique}
                                        isExpanded={expandedCards[`hist-${idx}`]}
                                        onToggle={() => toggleCard(`hist-${idx}`)}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={styles.sessionList}>
                            <div style={styles.sectionHeader}>
                                <h2 style={styles.sectionTitle}>
                                    <Archive size={16} /> Archived Sessions
                                </h2>
                                <span style={styles.badge}>{historyList.archived_sessions?.length || 0} sessions</span>
                            </div>
                            <div style={styles.scrollableContent}>
                                {(!historyList.archived_sessions || historyList.archived_sessions.length === 0) ? (
                                    <div style={styles.emptyState}>
                                        <History size={32} style={{ opacity: 0.3 }} />
                                        <p>No archived sessions yet</p>
                                        <span style={{ fontSize: '12px', color: '#666' }}>
                                            Sessions are archived when you start a new chat
                                        </span>
                                    </div>
                                ) : (
                                    historyList.archived_sessions.map((session) => (
                                        <div
                                            key={session.session_id}
                                            onClick={() => viewSessionDetails(session.session_id)}
                                            style={styles.sessionCard}
                                        >
                                            <div style={styles.sessionCardHeader}>
                                                <span style={styles.sessionId}>#{session.session_id}</span>
                                                <span style={{
                                                    ...styles.sessionScore,
                                                    color: session.average_score >= 70 ? '#22c55e' : session.average_score >= 40 ? '#eab308' : '#ef4444'
                                                }}>
                                                    {session.average_score}/100
                                                </span>
                                            </div>
                                            <div style={styles.sessionCardMeta}>
                                                <span>{new Date(session.started_at).toLocaleDateString()}</span>
                                                <span>{session.review_count} reviews</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// --- Styles ---
const styles = {
    container: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #0a0a0a 0%, #111 100%)',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden'
    },
    loadingContainer: {
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: '#fff'
    },
    loadingContent: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
    },
    loadingText: {
        color: '#888',
        fontFamily: 'monospace',
        animation: 'pulse 2s infinite'
    },
    header: {
        height: '70px',
        padding: '0 24px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(17, 17, 17, 0.8)',
        backdropFilter: 'blur(12px)',
        flexShrink: 0
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    brainIcon: {
        padding: '10px',
        background: 'rgba(236, 72, 153, 0.15)',
        borderRadius: '12px'
    },
    title: {
        fontSize: '18px',
        fontWeight: '700',
        margin: 0
    },
    liveIndicator: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '10px',
        color: '#666',
        fontFamily: 'monospace',
        textTransform: 'uppercase',
        letterSpacing: '1px'
    },
    liveDot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: '#22c55e',
        animation: 'pulse 2s infinite'
    },
    tabsContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    tabButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#888',
        fontSize: '12px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    },
    tabButtonActive: {
        background: 'rgba(236, 72, 153, 0.15)',
        borderColor: 'rgba(236, 72, 153, 0.3)',
        color: '#ec4899'
    },
    newSessionButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        background: 'rgba(34, 197, 94, 0.15)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: '8px',
        color: '#22c55e',
        fontSize: '12px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    },
    statsRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '24px'
    },
    mainContent: {
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        overflow: 'hidden',
        gap: '1px',
        background: 'rgba(255,255,255,0.05)'
    },
    leftPanel: {
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a0a',
        overflow: 'hidden'
    },
    chartSection: {
        height: '200px',
        padding: '20px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(15, 15, 15, 0.5)',
        flexShrink: 0
    },
    chartContainer: {
        height: 'calc(100% - 40px)'
    },
    critiquesFeed: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '20px'
    },
    rightPanel: {
        display: 'flex',
        flexDirection: 'column',
        background: '#111',
        overflow: 'hidden',
        padding: '20px'
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        flexShrink: 0
    },
    sectionTitle: {
        fontSize: '12px',
        fontWeight: '600',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    badge: {
        padding: '4px 10px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '20px',
        fontSize: '11px',
        color: '#888',
        fontFamily: 'monospace'
    },
    scrollableContent: {
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        paddingRight: '8px',
        scrollbarWidth: 'thin',
        scrollbarColor: '#333 transparent'
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '150px',
        color: '#555',
        gap: '8px',
        textAlign: 'center'
    },
    historyPanel: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a0a',
        overflow: 'hidden',
        padding: '20px'
    },
    sessionList: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    },
    sessionCard: {
        background: 'linear-gradient(135deg, rgba(22, 22, 22, 0.8) 0%, rgba(18, 18, 18, 0.9) 100%)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    },
    sessionCardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
    },
    sessionId: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#ec4899',
        fontFamily: 'monospace'
    },
    sessionScore: {
        fontSize: '14px',
        fontWeight: '700',
        fontFamily: 'monospace'
    },
    sessionCardMeta: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '11px',
        color: '#666'
    },
    sessionDetails: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    },
    sessionDetailsHeader: {
        marginBottom: '20px'
    },
    backButton: {
        background: 'transparent',
        border: 'none',
        color: '#888',
        fontSize: '12px',
        cursor: 'pointer',
        padding: '8px 0',
        marginBottom: '8px'
    },
    sessionTitle: {
        fontSize: '18px',
        fontWeight: '700',
        margin: '0 0 4px 0',
        color: '#fff'
    },
    sessionMeta: {
        fontSize: '11px',
        color: '#666'
    },
    sessionStats: {
        display: 'flex',
        gap: '24px',
        marginBottom: '20px',
        padding: '16px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px'
    },
    sessionStatItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    },
    sessionStatLabel: {
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: '#666'
    },
    sessionStatValue: {
        fontSize: '24px',
        fontWeight: '700',
        fontFamily: 'monospace'
    }
};

// --- Sub Components ---

const StatBadge = ({ label, value, icon, color }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <span style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
        }}>
            {icon} {label}
        </span>
        <span style={{
            fontSize: '22px',
            fontWeight: '700',
            fontFamily: 'monospace',
            color: color
        }}>
            {value}
        </span>
    </div>
);

const CritiqueCard = ({ data, isExpanded, onToggle }) => {
    const getScoreColor = (score) => {
        if (score >= 80) return { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)', text: '#22c55e' };
        if (score >= 50) return { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308' };
        return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' };
    };

    const colors = getScoreColor(data.score);
    const critiques = data.critique || [];

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(22, 22, 22, 0.8) 0%, rgba(18, 18, 18, 0.9) 100%)',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
            transition: 'all 0.2s ease',
            flexShrink: 0
        }}>
            <div
                onClick={onToggle}
                style={{
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #333 0%, #222 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: '700',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        {(data.agent_name || 'SYS').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#eee' }}>
                            {data.agent_name || 'Unknown Agent'}
                        </h3>
                        <span style={{ fontSize: '11px', color: '#666' }}>
                            {data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'Just now'}
                            {data.turn_id && ` • Turn #${data.turn_id}`}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        background: colors.bg,
                        border: `1px solid ${colors.border}`,
                        color: colors.text,
                        fontSize: '13px',
                        fontWeight: '700',
                        fontFamily: 'monospace'
                    }}>
                        {data.score}/100
                    </div>
                    {isExpanded ? <ChevronUp size={16} color="#666" /> : <ChevronDown size={16} color="#666" />}
                </div>
            </div>
            {isExpanded && (
                <div style={{ padding: '16px', paddingTop: '0' }}>
                    {data.summary && (
                        <p style={{ margin: '12px 0 16px 0', fontSize: '13px', color: '#bbb', lineHeight: '1.6' }}>
                            {data.summary}
                        </p>
                    )}
                    {critiques.length > 0 && (
                        <div style={{
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: '10px',
                            padding: '12px',
                            border: '1px solid rgba(255,255,255,0.03)'
                        }}>
                            {critiques.map((point, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    padding: '8px 0',
                                    borderBottom: i < critiques.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none'
                                }}>
                                    <span style={{ flexShrink: 0 }}>
                                        {point.includes('✅') ? '✅' : point.includes('⚠️') ? '⚠️' : point.includes('❌') ? '❌' : '•'}
                                    </span>
                                    <span style={{ fontSize: '12px', color: '#999', lineHeight: '1.5' }}>
                                        {point.replace(/^[✅⚠️❌]\s*/, '')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ImprovementCard = ({ data, onApply, isExpanded, onToggle }) => (
    <div style={{
        background: 'linear-gradient(135deg, rgba(22, 22, 22, 0.9) 0%, rgba(18, 18, 18, 0.95) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(245, 158, 11, 0.15)',
        overflow: 'hidden',
        flexShrink: 0
    }}>
        <div
            onClick={onToggle}
            style={{
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.05)' : 'none'
            }}
        >
            <div>
                <span style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    background: 'rgba(236, 72, 153, 0.15)',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#ec4899',
                    marginBottom: '6px'
                }}>
                    {data.target_file}
                </span>
                <p style={{ margin: 0, fontSize: '13px', color: '#ccc', lineHeight: '1.4' }}>
                    {data.description}
                </p>
            </div>
            {isExpanded ? <ChevronUp size={16} color="#666" /> : <ChevronDown size={16} color="#666" />}
        </div>
        {isExpanded && (
            <div style={{ padding: '16px', paddingTop: '0' }}>
                <div style={{
                    background: 'rgba(0,0,0,0.4)',
                    borderRadius: '10px',
                    padding: '12px',
                    marginTop: '12px',
                    marginBottom: '16px',
                    border: '1px solid rgba(255,255,255,0.03)',
                    maxHeight: '200px',
                    overflowY: 'auto'
                }}>
                    <pre style={{
                        margin: 0,
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#4ade80',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: '1.5'
                    }}>
                        {data.proposed_content}
                    </pre>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onApply(); }}
                    style={{
                        width: '100%',
                        padding: '12px',
                        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: '10px',
                        color: '#22c55e',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Check size={14} /> Apply Fix
                </button>
            </div>
        )}
    </div>
);

export default Dashboard;
