/**
 * Header Component
 * App header with logo, connection status, and usage stats
 */

import { useState } from 'react'
import './Header.css'

function Header({ isConnected, usage, onNewChat, activeTab, onTabChange, hasPendingPlan }) {
    return (
        <header className="header">
            <div className="logo">
                <span className="logo-icon">🤖</span>
                <span>AutoAgents</span>
                <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginLeft: '8px'
                }}>
                    Multi-Agent Code Assistant
                </span>
            </div>

            <div className="header-actions">
                {/* View Toggles */}
                <div style={{ display: 'flex', gap: '8px', marginRight: '16px' }}>
                    <button
                        className={`btn ${activeTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => onTabChange('chat')}
                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                    >
                        💬 Chat
                    </button>
                    <button
                        className={`btn ${activeTab === 'tasks' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => onTabChange('tasks')}
                        style={{ fontSize: '0.75rem', padding: '6px 12px', position: 'relative' }}
                    >
                        📋 Tasks
                        {hasPendingPlan && (
                            <span style={{
                                position: 'absolute',
                                top: '-4px',
                                right: '-4px',
                                width: '12px',
                                height: '12px',
                                background: '#ef4444',
                                borderRadius: '50%',
                                fontSize: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                animation: 'pulse 2s infinite'
                            }}>!</span>
                        )}
                    </button>
                    <button
                        className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => onTabChange('dashboard')}
                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                    >
                        📊 Dashboard
                    </button>
                </div>

                <button
                    className="btn btn-secondary glass-card"
                    onClick={onNewChat}
                    style={{
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: 'var(--neon-cyan)',
                        border: '1px solid var(--neon-cyan)',
                        boxShadow: 'var(--glow-cyan)'
                    }}
                >
                    + New Chat
                </button>
                {/* Connection Status */}
                <div className="glass-card" style={{
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isConnected ? 'var(--neon-green)' : '#ef4444',
                        boxShadow: isConnected ? 'var(--glow-green)' : '0 0 10px #ef4444'
                    }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>

                {/* Usage Stats */}
                {usage?.today && (
                    <div className="usage-card" style={{
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <div>
                            <div className="usage-label" style={{ fontSize: '0.625rem' }}>API Calls</div>
                            <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                                {usage.today.today_calls} / {usage.today.daily_limit}
                            </div>
                        </div>
                        <div style={{
                            width: '60px',
                            height: '4px',
                            background: 'var(--bg-primary)',
                            borderRadius: '2px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${(usage.today.today_calls / usage.today.daily_limit) * 100}%`,
                                background: 'linear-gradient(90deg, var(--neon-green), var(--neon-cyan))',
                                borderRadius: '2px'
                            }} />
                        </div>
                    </div>
                )}

                {/* Agent Status Dots */}
                <div style={{ display: 'flex', gap: '4px' }}>
                    <span title="Senior Dev" style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--neon-purple)',
                        borderRadius: '50%',
                        fontSize: '0.75rem'
                    }}>🧙</span>
                    <span title="Junior Dev" style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--neon-green)',
                        borderRadius: '50%',
                        fontSize: '0.75rem'
                    }}>🐣</span>
                    <span title="Unit Tester" style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--neon-amber)',
                        borderRadius: '50%',
                        fontSize: '0.75rem'
                    }}>🧪</span>
                    <span title="Researcher" style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--neon-cyan)',
                        borderRadius: '50%',
                        fontSize: '0.75rem'
                    }}>🔍</span>
                </div>
            </div>
        </header>
    )
}

export default Header
