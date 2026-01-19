/**
 * ResearchPanel Component
 * Shows web research results
 */

import { useState } from 'react'
import './ResearchPanel.css'

function ResearchPanel({ results, onSearch }) {
    const [query, setQuery] = useState('')
    const [isSearching, setIsSearching] = useState(false)

    const handleSearch = async (e) => {
        e.preventDefault()
        if (!query.trim()) return

        setIsSearching(true)
        await onSearch(query.trim())
        setIsSearching(false)
    }

    return (
        <aside className="research-panel">
            <h3 style={{ marginBottom: 'var(--space-md)' }}>🔍 Research</h3>

            {/* Search Form */}
            <form onSubmit={handleSearch} style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search the web..."
                        className="chat-input"
                        style={{
                            padding: '8px 12px',
                            minHeight: 'auto'
                        }}
                    />
                    <button
                        type="submit"
                        className="btn btn-secondary"
                        disabled={isSearching}
                    >
                        {isSearching ? '...' : '🔎'}
                    </button>
                </div>
            </form>

            {/* Results */}
            {results.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    padding: 'var(--space-lg)'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📚</div>
                    <p style={{ fontSize: '0.875rem' }}>
                        Search for documentation, Stack Overflow answers, or latest news.
                    </p>
                </div>
            ) : (
                <div>
                    {results.map((result, i) => (
                        <div key={i} className="research-result">
                            <div className="research-result-title">
                                {result.title}
                            </div>
                            <div className="research-result-snippet">
                                {result.snippet}
                            </div>
                            {result.url && (
                                <a
                                    href={result.url.startsWith('http') ? result.url : `https://${result.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="research-result-url"
                                    title={result.url}
                                >
                                    {result.url}
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Quick Links */}
            <div style={{
                marginTop: 'var(--space-lg)',
                paddingTop: 'var(--space-lg)',
                borderTop: '1px solid var(--border-color)'
            }}>
                <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginBottom: '8px'
                }}>
                    Quick Links
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <QuickLink href="https://docs.python.org/3/" icon="🐍">
                        Python Docs
                    </QuickLink>
                    <QuickLink href="https://react.dev/" icon="⚛️">
                        React Docs
                    </QuickLink>
                    <QuickLink href="https://stackoverflow.com/" icon="📚">
                        Stack Overflow
                    </QuickLink>
                    <QuickLink href="https://github.com/" icon="🐙">
                        GitHub
                    </QuickLink>
                </div>
            </div>
        </aside>
    )
}

function QuickLink({ href, icon, children }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                fontSize: '0.8125rem',
                transition: 'all var(--transition-fast)'
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--glass-bg)'
                e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-secondary)'
            }}
        >
            <span>{icon}</span>
            <span>{children}</span>
        </a>
    )
}

export default ResearchPanel
