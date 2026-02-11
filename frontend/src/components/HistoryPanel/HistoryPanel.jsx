import React, { useEffect, useState } from 'react';
import './HistoryPanel.css';

const HistoryPanel = ({ onSessionLoad }) => {
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:8000/api/history');
            const data = await res.json();
            setSessions(data);
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const formatTime = (isoString) => {
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (isoString) => {
        const d = new Date(isoString);
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    if (isLoading) {
        return (
            <div className="history-empty">
                <div className="loading-spinner">⌛</div>
                <p>Loading sessions...</p>
            </div>
        );
    }

    if (!sessions || sessions.length === 0) {
        return (
            <div className="history-empty">
                <div className="empty-icon">📂</div>
                <p>No past sessions found</p>
                <small>Your conversations are saved here</small>
                <div className="refresh-btn" onClick={fetchSessions} style={{ marginTop: '20px' }}>
                    🔄 Check Again
                </div>
            </div>
        );
    }

    return (
        <div className="history-panel">
            <div className="history-list">
                {sessions.map((session) => (
                    <div
                        key={session.id}
                        className="history-item"
                        onClick={() => onSessionLoad(session)}
                        title={session.title}
                    >
                        <div className="history-item-header">
                            <span className="session-icon">📂</span>
                            <span className="agent-name">ID: {session.id.split('_')[1] || session.id}</span>
                            <span className="message-time">
                                {formatTime(session.timestamp)}
                            </span>
                        </div>
                        <div className="history-item-preview">
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {session.title}
                            </span>
                            <span className="meta-date">
                                {formatDate(session.timestamp)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="refresh-btn" onClick={fetchSessions}>
                🔄 Refresh List
            </div>
        </div>
    );
};

export default HistoryPanel;
