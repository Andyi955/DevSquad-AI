import React, { useState, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
    TrendingUp, AlertCircle, CheckCheck, Check, X, ArrowRight, Brain, Activity, MessageSquare, Zap
} from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

const Dashboard = () => {
    const [data, setData] = useState({ reviews: [], stats: { history: [] } });
    const [loading, setLoading] = useState(true);
    const [selectedImprovement, setSelectedImprovement] = useState(null);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 3000); // Poll every 3s
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

    if (loading) return (
        <div className="h-full flex items-center justify-center bg-[#0a0a0a] text-white">
            <div className="flex flex-col items-center gap-4">
                <Brain className="animate-bounce text-pink-500" size={48} />
                <p className="text-gray-400 font-mono animate-pulse">Initializing Review Neural Net...</p>
            </div>
        </div>
    );

    // Flatten all reviews for the feed
    const allCritiques = data.reviews.flatMap(r =>
        (r.reviews || []).map(c => ({ ...c, timestamp: r.timestamp }))
    ).reverse();

    const latestReview = data.reviews?.[data.reviews.length - 1] || {};
    const improvements = latestReview.prompt_improvements || [];
    const historyData = data.stats?.history || [];

    // Calculate aggregate score
    const avgScore = historyData.length > 0
        ? Math.round(historyData.reduce((acc, curr) => acc + curr.score, 0) / historyData.length * 10) / 10
        : 0;

    return (
        <div className="h-full flex flex-col bg-[#0a0a0a] text-white font-sans overflow-hidden">
            {/* Header / Stats Bar */}
            <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-[#111] backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-500/10 rounded-lg">
                        <Brain className="text-pink-500" size={20} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight">Review Agent</h1>
                        <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            LIVE MONITORING
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <StatBadge
                        label="Overall Score"
                        value={avgScore || "N/A"}
                        icon={<Activity size={14} />}
                        trend={avgScore > 8 ? "up" : "down"}
                    />
                    <StatBadge
                        label="Total Critiques"
                        value={allCritiques.length}
                        icon={<MessageSquare size={14} />}
                    />
                    <StatBadge
                        label="Pending Improvements"
                        value={improvements.length}
                        icon={<Zap size={14} />}
                        highlight={improvements.length > 0}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-12 gap-0">

                {/* LEFT: Activity Feed (Critiques) */}
                <div className="col-span-12 md:col-span-7 lg:col-span-8 flex flex-col border-r border-white/10 bg-[#0a0a0a]">
                    {/* Chart Section */}
                    <div className="h-64 border-b border-white/10 p-6 bg-[#0f0f0f]">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Performance Trend</h2>
                            <div className="px-2 py-1 bg-white/5 rounded text-xs text-gray-500">Last {historyData.length} turns</div>
                        </div>
                        <div className="h-full w-full -ml-2">
                            <ResponsiveContainer width="100%" height="85%">
                                <AreaChart data={historyData}>
                                    <defs>
                                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                    <XAxis dataKey="timestamp" hide />
                                    <YAxis hide domain={[0, 10]} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px' }}
                                        itemStyle={{ color: '#ec4899' }}
                                        formatter={(val) => [`${val}/10`, 'Score']}
                                        labelFormatter={() => ''}
                                    />
                                    <Area type="monotone" dataKey="score" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Feed Section */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-800">
                        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Live Critique Feed</h2>

                        {allCritiques.length === 0 && (
                            <div className="text-center py-10 text-gray-600 italic">
                                Waiting for agent activity...
                            </div>
                        )}

                        {allCritiques.map((critique, idx) => (
                            <CritiqueCard key={idx} data={critique} />
                        ))}
                    </div>
                </div>

                {/* RIGHT: Improvements Panel */}
                <div className="col-span-12 md:col-span-5 lg:col-span-4 bg-[#111] border-l border-white/5 flex flex-col">
                    <div className="p-6 border-b border-white/10">
                        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Zap size={16} className="text-yellow-500" />
                            Suggested Improvements
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {improvements.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
                                <CheckCheck size={32} className="opacity-20" />
                                <p className="text-sm">All systems nominal. No improvements needed.</p>
                            </div>
                        ) : (
                            improvements.map((imp, idx) => (
                                <ImprovementCard
                                    key={idx}
                                    data={imp}
                                    onApply={() => applySuggestion(imp)}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Sub Components ---

const StatBadge = ({ label, value, icon, trend, highlight }) => (
    <div className={`flex flex-col ${highlight ? 'text-yellow-400' : 'text-gray-300'}`}>
        <span className="text-[10px] uppercase tracking-wider opacity-60 flex items-center gap-1">
            {icon} {label}
        </span>
        <span className={`text-xl font-mono font-bold ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : ''}`}>
            {value}
        </span>
    </div>
);

const CritiqueCard = ({ data }) => {
    const scoreColor = data.score >= 8 ? 'text-green-400 border-green-500/30 bg-green-500/10' :
        data.score >= 5 ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
            'text-red-400 border-red-500/30 bg-red-500/10';

    return (
        <div className="group relative pl-8 pb-8 border-l border-white/10 last:pb-0 last:border-0">
            {/* Timeline dot */}
            <div className={`absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full ${data.score >= 7 ? 'bg-green-500' : 'bg-pink-500'} ring-4 ring-[#0a0a0a]`}></div>

            <div className="bg-[#161616] rounded-xl p-5 border border-white/5 hover:border-white/10 transition-all shadow-lg">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-xs font-bold border border-white/10">
                            {(data.agent_name || 'SYS').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-200 text-sm">{data.agent_name || 'Unknown Agent'}</h3>
                            <span className="text-xs text-gray-500">{new Date(data.timestamp).toLocaleTimeString()} • Turn #{data.turn_id || '?'}</span>
                        </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full border text-xs font-bold font-mono ${scoreColor}`}>
                        {data.score}/100
                    </div>
                </div>

                <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                    {data.summary}
                </p>

                {/* Critique Points */}
                <div className="space-y-2 bg-[#0a0a0a] rounded-lg p-3 border border-white/5">
                    {(data.critique || []).map((point, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                            <span className="mt-0.5 opacity-80">
                                {point.includes('✅') ? '✅' : point.includes('⚠️') ? '⚠️' : point.includes('❌') ? '❌' : '•'}
                            </span>
                            <span className="text-gray-400">{point.replace(/^[✅⚠️❌]\s*/, '')}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ImprovementCard = ({ data, onApply }) => (
    <div className="bg-[#161616] rounded-xl border border-white/5 overflow-hidden hover:border-pink-500/30 transition-all group">
        <div className="p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-pink-500 bg-pink-500/10 px-2 py-1 rounded">
                    {data.target_file}
                </span>
            </div>
            <p className="text-sm text-gray-300 mb-4">{data.description}</p>

            <div className="bg-[#0a0a0a] rounded p-3 text-xs font-mono text-gray-500 mb-4 border border-white/5 overflow-x-auto">
                <div className="text-green-400/80 line-clamp-4">
                    {data.proposed_content}
                </div>
            </div>

            <button
                onClick={onApply}
                className="w-full py-2 bg-white/5 hover:bg-green-600 hover:text-white text-gray-400 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2"
            >
                <Check size={14} /> Apply Fix
            </button>
        </div>
    </div>
);

export default Dashboard;
