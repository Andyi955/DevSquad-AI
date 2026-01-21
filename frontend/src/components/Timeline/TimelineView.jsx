import React from 'react';
import './TimelineView.css';

const AGENT_META = {
    'Senior Dev': { emoji: '🧙', color: 'var(--neon-purple)' },
    'Junior Dev': { emoji: '🐣', color: 'var(--neon-green)' },
    'Unit Tester': { emoji: '🧪', color: 'var(--neon-amber)' },
    'Researcher': { emoji: '🔍', color: 'var(--neon-cyan)' },
    'Research Lead': { emoji: '🏗️', color: '#ec4899' },
    'System': { emoji: '⚙️', color: 'var(--text-muted)' }
};

// Normalize names for mapping (case-insensitive and partial match)
const getAgentMeta = (name) => {
    if (!name) return AGENT_META['System'];
    const normalized = name.toLowerCase();
    if (normalized.includes('senior')) return AGENT_META['Senior Dev'];
    if (normalized.includes('junior')) return AGENT_META['Junior Dev'];
    if (normalized.includes('tester')) return AGENT_META['Unit Tester'];
    if (normalized.includes('researcher')) return AGENT_META['Researcher'];
    if (normalized.includes('research lead')) return AGENT_META['Research Lead'];
    return AGENT_META['System'];
};

const TYPE_ICONS = {
    'agent_start': '🚀',
    'handoff': '🤝',
    'edit': '📝',
    'research': '🔍',
    'status': '📡',
    'complete': '✅'
}

export default function TimelineView({ timeline }) {
    if (!timeline || timeline.length === 0) {
        return (
            <div className="timeline-empty">
                <div className="empty-icon">⏳</div>
                <p>Waiting for mission activity...</p>
                <small>The timeline will track background events as the agents work.</small>
            </div>
        );
    }

    return (
        <div className="timeline-container">
            <div className="timeline-header">
                <h3>Mission Timeline</h3>
                <span className="event-count">{timeline.length} events</span>
            </div>

            <div className="timeline-list">
                {timeline.map((event, i) => {
                    const agent = getAgentMeta(event.agent);
                    const typeIcon = TYPE_ICONS[event.type] || '🔹';
                    const time = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                    return (
                        <div key={event.id || i} className={`timeline-item ${event.type}`}>
                            <div className="timeline-line"></div>
                            <div className="timeline-dot" style={{ background: agent.color }}>
                                {typeIcon}
                            </div>

                            <div className="timeline-content">
                                <div className="timeline-meta">
                                    <span className="timeline-agent" style={{ color: agent.color }}>
                                        {agent.emoji} {event.agent}
                                    </span>
                                    <span className="timeline-time">{time}</span>
                                </div>
                                <div className="timeline-message">
                                    {event.message}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
