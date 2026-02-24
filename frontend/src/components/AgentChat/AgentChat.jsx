/**
 * AgentChat Component
 * Real-time chat with AI agents
 */

import React, { useState, useRef, useEffect } from 'react'
import './AgentChat.css'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import RunCommandButton from './RunCommandButton'


// Agent metadata
const AGENTS = {
    'Senior Dev': { emoji: '🧙', color: 'var(--neon-purple)', class: 'senior' },
    'Junior Dev': { emoji: '🐣', color: 'var(--neon-green)', class: 'junior' },
    'Unit Tester': { emoji: '🧪', color: 'var(--neon-amber)', class: 'tester' },
    'Researcher': { emoji: '🔍', color: 'var(--neon-cyan)', class: 'researcher' },
    'Research Lead': { emoji: '🏗️', color: '#ec4899', class: 'lead' },
    'User': { emoji: '👤', color: 'var(--text-primary)', class: 'user' }
}

function AgentChat({
    messages,
    isTyping,
    currentAgent,
    onSendMessage,
    isConnected,
    onStop,
    isStopped,
    attachedFiles = [],
    onAttachFiles,
    onRemoveFile,
    onShowChanges,
    onRunCommand,
    onRate
}) {
    const [input, setInput] = useState('')
    const [showContinuePrompt, setShowContinuePrompt] = useState(false)
    const [isDraggingFile, setIsDraggingFile] = useState(false)
    const [agentStatus, setAgentStatus] = useState('')
    const [ratedMessages, setRatedMessages] = useState({}) // { messageId: rating }

    const getFileIcon = (ext) => {
        const icons = {
            '.py': '🐍',
            '.js': '📜',
            '.jsx': '⚛️',
            '.ts': '📘',
            '.tsx': '⚛️',
            '.html': '🌐',
            '.css': '🎨',
            '.json': '📋',
            '.md': '📝',
            '.txt': '📄'
        }
        return icons[ext] || '📄'
    }

    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)

    // Handle agent status updates from messages and timeouts
    useEffect(() => {
        const lastMsg = messages[messages.length - 1];

        if (lastMsg) {
            if (lastMsg.type === 'agent_status') {
                setAgentStatus(lastMsg.status);
            }
            if (lastMsg.isTimeout) {
                setShowContinuePrompt(true);
            }
        }

        // If typing stopped or message is complete, clear status after a delay
        if (!isTyping || (lastMsg && (lastMsg.type === 'agent_done' || lastMsg.complete))) {
            const timer = setTimeout(() => {
                setAgentStatus('');
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [messages, isTyping]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    }, [messages.length, isTyping, agentStatus]) // Scroll on new message count, typing change, or status change

    const handleSubmit = (e) => {
        e.preventDefault()
        if (input.trim() && isConnected) {
            onSendMessage(input.trim())
            setInput('')
            setShowContinuePrompt(false)
        }
    }

    const handleContinue = () => {
        onSendMessage("Please continue")
        setShowContinuePrompt(false)
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
        }
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        if (e.dataTransfer.types.includes('application/json')) {
            setIsDraggingFile(true)
        }
    }

    const handleDragLeave = () => {
        setIsDraggingFile(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDraggingFile(false)
        const data = e.dataTransfer.getData('application/json')
        if (data) {
            try {
                const parsed = JSON.parse(data)
                onAttachFiles(parsed)
            } catch (err) {
                console.error('Failed to parse dropped data:', err)
            }
        }
    }

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const renderMessage = (msg) => {
        if (msg.type === 'handoff') {
            const fromAgent = AGENTS[msg.from] || {}
            const toAgent = AGENTS[msg.to] || {}

            return (
                <div key={msg.id} className="handoff-animation">
                    <span style={{ fontSize: '1.5rem' }}>{fromAgent.emoji}</span>
                    <span className="handoff-arrow">➡️</span>
                    <span style={{ fontSize: '1.5rem' }}>{toAgent.emoji}</span>
                    <span style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        marginLeft: '8px'
                    }}>
                        Passing to {msg.to}
                    </span>
                </div>
            )
        }

        if (msg.type === 'mission_complete') {
            return (
                <div key={msg.id} className="mission-complete-card">
                    <div className="mission-complete-badge">
                        <span className="check">⭐</span>
                        <span className="text">PROJECT COMPLETED</span>
                    </div>
                </div>
            )
        }

        const agent = AGENTS[msg.agent] || AGENTS['User']
        const isUser = msg.isUser

        // Check for file change metadata to show diff summary
        let diffSummary = null;
        if (msg.type === 'file_change' || msg.file_change) {
            const change = msg.file_change || msg;
            const addedLines = (change.new_content?.split('\n').length || 0);
            const removedLines = (change.old_content?.split('\n').length || 0);

            diffSummary = (
                <div
                    className="diff-summary-chip clickable"
                    onClick={() => onShowChanges && onShowChanges()}
                    style={{ cursor: 'pointer' }}
                    title="Click to view details in Review Panel"
                >
                    <span className="add">+{addedLines}</span>
                    <span className="remove">-{removedLines}</span>
                    <span className="file-path">{change.path}</span>
                </div>
            );
        }

        const rawContent = msg.concise_message || msg.content || '';

        // Clean up technical cues for display
        let content = rawContent;
        const mentionMap = {
            'SENIOR': '@Senior Dev',
            'JUNIOR': '@Junior Dev',
            'TESTER': '@Unit Tester',
            'RESEARCH': '@Researcher'
        };

        if (!msg.concise_message) {
            // Hide fully formed technical tags
            content = rawContent
                .replace(/\[(EDIT_FILE|CREATE_FILE|DELETE_FILE|READ_FILE|SEARCH|FILE_SEARCH):[^\]]+\]/g, '')
                .replace(/\[→.*?\]/g, (match) => {
                    // Match the agent name within the handoff tag [→Agent Name]
                    const agentName = match.slice(2, -1).trim().toUpperCase();
                    for (const cue in mentionMap) {
                        if (agentName.includes(cue)) return mentionMap[cue];
                    }
                    return ''; // Hide it if it doesn't match a known agent
                })
                .replace(/\[File (Edit|Create|Delete): [^\]]+\]/g, '')
                .replace(/✅?(\[)?MISSION ACCOMPLISHED(\])?/g, '')
                .replace(/\[DONE\]/g, '');

            // Clean up ghost punctuation left by tag removal
            // Remove trailing colons and extra dots at ends of lines/messages
            content = content.replace(/[:\s]+(\n|$)/g, '$1');

            // Consolidate newlines
            content = content.replace(/\n{3,}/g, '\n\n');

            // Fix punctuation starting on a new line (common after tag removal)
            // This turns:
            // "Something
            // . Next" -> "Something. Next"
            content = content.replace(/\n\s*([.,!?;])/g, '$1');

            // FIRST: Clean up spaces between closing backticks and punctuation
            content = content.replace(/`\s+([.,!?;])/g, '`$1');

            // THEN: Fix remaining spaces before punctuation (for normal text)
            content = content.replace(/(?<!`)\s+([.,!?;])(?![`])/g, '$1');

            // Avoid hanging prepositions if they were followed by a tag
            content = content.replace(/\b(for|to|at|in|about|of|with|and|the)\s*\n/g, '\n');

            // Hide PARTIAL technical tags at the end of the stream (to prevent flashing)
            // We only hide if the tag is NOT yet complete (doesn't have a closing ']')
            const partialPatterns = ['EDIT_FILE', 'CREATE_FILE', 'DELETE_FILE', 'READ_FILE', 'SEARCH', 'FILE_SEARCH', '→SENIOR', '→JUNIOR', '→TESTER', '→RESEARCH', 'DONE'];
            const lastOpenBracket = content.lastIndexOf('[');
            const lastCloseBracket = content.lastIndexOf(']');

            if (lastOpenBracket !== -1 && lastOpenBracket > lastCloseBracket) {
                const afterBracket = content.slice(lastOpenBracket + 1);
                // If the text after '[' looks like one of our tags (but isn't finished), hide it
                if (partialPatterns.some(p => p.startsWith(afterBracket))) {
                    content = content.slice(0, lastOpenBracket);
                }
            }

            // Final cleanup
            content = content.trim();
        } else {
            // Already concise from backend, use it directly
            content = rawContent.replace(/\[→(SENIOR|JUNIOR|TESTER|RESEARCH)\]/g, (match, p1) => mentionMap[p1] || match);
        }

        // Extract RUN_COMMAND match before rendering markdown
        // We will render these as separate elements after the paragraph
        const commandMatches = [];
        content = content.replace(/\[RUN_COMMAND:(.+?)\]/g, (match, cmd) => {
            commandMatches.push(cmd.trim());
            return ''; // Remove from text flow
        });

        // --- MENTION STYLING ---
        // Dynamically wrap @mentions in styled spans
        const renderStyledContent = (node) => {
            if (typeof node !== 'string') return node;

            const parts = node.split(/(@Senior Dev|@Junior Dev|@Unit Tester|@Researcher)/g);
            return parts.map((part, i) => {
                const agentKey = Object.keys(AGENTS).find(k => `@${k}` === part);
                if (agentKey) {
                    const agentMeta = AGENTS[agentKey];
                    return (
                        <span key={i} className={`mention-badge ${agentMeta.class}`} style={{
                            color: agentMeta.color,
                            background: `rgba(0,0,0,0.4)`,
                            padding: '2px 8px',
                            margin: '0 2px',
                            borderRadius: '4px',
                            fontSize: '0.85em',
                            fontWeight: 'bold',
                            border: `1px solid ${agentMeta.color}66`,
                            boxShadow: `0 0 10px ${agentMeta.color}22`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            verticalAlign: 'middle'
                        }}>
                            {part}
                        </span>
                    );
                }
                return part;
            });
        };

        // Safety check: Don't render functionally empty messages unless they are error messages or special markers
        if (!content?.trim() && !msg.thoughts?.trim() && !msg.type && !msg.isError) {
            // If completely empty, we might want to hide it OR show a 'broken' state if it's old
            if (msg.complete) {
                return (
                    <div key={msg.id} className="message system-message" style={{ opacity: 0.5 }}>
                        <span style={{ fontSize: '0.8rem' }}>⚠️ Empty response from {msg.agent}</span>
                    </div>
                );
            }
            return null;
        }

        return (
            <div key={msg.id} className={`${msg.type === 'agent_status' ? 'status-message' : 'message'}`}>
                {msg.type !== 'agent_status' && (
                    <div
                        className={`message-avatar ${agent.class}`}
                        style={{ background: agent.color }}
                    >
                        {agent.emoji}
                    </div>
                )}

                <div className="message-content">
                    <div className="message-header">
                        <span
                            className={`message-name ${agent.class}`}
                            style={{ color: agent.color }}
                        >
                            {msg.agent || "System"}
                        </span>
                        <span className="message-time" style={{ marginLeft: '12px', opacity: 0.6 }}>
                            {formatTime(msg.timestamp)}
                        </span>
                    </div>

                    {/* Native Collapsible Thoughts - Moved BEFORE content as requested */}
                    {msg.thoughts && (
                        <details
                            className="thought-details"
                            open={!msg.content} // Keep open while ONLY thinking, close when content starts
                            style={{
                                marginBottom: '8px', // Added margin bottom since it's now first
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '12px',
                                background: 'rgba(0,0,0,0.3)',
                                backdropFilter: 'blur(10px)',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <summary style={{
                                padding: '10px 14px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                userSelect: 'none',
                                outline: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'rgba(255,255,255,0.02)'
                            }}>
                                <span className="thought-icon" style={{ opacity: 0.7 }}>🧠</span>
                                <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                    {msg.content ? 'Reasoning Process' : 'DeepThink Reasoning...'}
                                </span>
                            </summary>
                            <div className="thought-content" style={{
                                padding: '14px',
                                borderTop: '1px solid rgba(255,255,255,0.05)',
                                fontSize: '0.8125rem',
                                lineHeight: '1.6',
                                color: 'rgba(255,255,255,0.7)',
                                background: 'rgba(0,0,0,0.1)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                overflowX: 'auto',
                                fontFamily: 'var(--font-mono)'
                            }}>
                                {msg.thoughts.trim()}
                            </div>
                        </details>
                    )}

                    {msg.is_technical ? (
                        <div className="task-complete-indicator" style={{
                            margin: 0,
                            borderTop: 'none',
                            paddingTop: 0,
                            justifyContent: 'flex-start'
                        }}>
                            <span className="status-spinner" style={{ fontSize: '0.9em', filter: 'grayscale(1)' }}>⚙️</span>
                            <span style={{ fontStyle: 'italic', opacity: 0.7 }}>
                                {msg.concise_message ? msg.concise_message.replace(/_/g, '') : "Processing..."}
                            </span>
                        </div>
                    ) : (
                        <div
                            className={msg.type === 'agent_status' ? 'status-body' : 'message-body'}
                            style={isUser ? {
                                background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-blue))',
                                color: 'white'
                            } : {}}
                        >
                            {msg.type === 'agent_status' && <span className="status-spinner">⚙️</span>}
                            <ReactMarkdown
                                rehypePlugins={[rehypeHighlight]}
                                components={{
                                    p: ({ children }) => {
                                        // Process children to hide mission tags and style mentions
                                        const processedChildren = React.Children.map(children, (child) => {
                                            if (typeof child === 'string') {
                                                const cleaned = child.replace(/✅?(\[)?MISSION ACCOMPLISHED(\])?/g, '');
                                                return cleaned ? renderStyledContent(cleaned) : null;
                                            }
                                            return child;
                                        }).filter(Boolean);

                                        if (processedChildren.length === 0) return null;

                                        return (
                                            <p>
                                                {processedChildren}
                                            </p>
                                        );
                                    },
                                    code({ node, inline, className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || '')
                                        const content = String(children).replace(/\n$/, '')
                                        // Heuristic: if code is short (buffer < 60 chars) and single line, force inline style
                                        // even if markdown parser thought it was a block (e.g. from triple backticks)
                                        const isShortSingleLine = content.length < 60 && !content.includes('\n')
                                        const shouldRenderInline = inline || isShortSingleLine

                                        return !shouldRenderInline ? (
                                            <code className={className} {...props} style={{
                                                display: 'block',
                                                padding: '1em',
                                                borderRadius: '6px',
                                                background: '#1a1a1a', // Darker background
                                                border: '1px solid #333',
                                                margin: '8px 0',
                                                overflowX: 'auto'
                                            }}>
                                                {children}
                                            </code>
                                        ) : (
                                            <code className={className} {...props} style={{
                                                background: 'rgba(147, 51, 234, 0.1)', // Matches CSS var(--neon-purple) with opacity
                                                color: 'var(--neon-purple)',
                                                padding: '2px 5px',
                                                borderRadius: '4px',
                                                fontSize: '0.9em',
                                                fontWeight: '500',
                                                border: '1px solid rgba(147, 51, 234, 0.15)',
                                                verticalAlign: 'baseline',
                                                fontFamily: 'var(--font-mono)'
                                            }}>
                                                {children}
                                            </code>
                                        )
                                    }
                                }}
                            >
                                {content}
                            </ReactMarkdown>
                            {diffSummary}

                            {commandMatches.length > 0 && (
                                <div className="command-buttons-container" style={{ marginTop: '8px' }}>
                                    {commandMatches.map((cmd, idx) => (
                                        <RunCommandButton
                                            key={idx}
                                            command={cmd}
                                            onRun={() => onRunCommand && onRunCommand(cmd)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Rating UI */}
                            {!isUser && msg.complete && (
                                <div className="message-rating" style={{
                                    display: 'flex',
                                    gap: '8px',
                                    marginTop: '12px',
                                    paddingTop: '8px',
                                    borderTop: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <button
                                        onClick={() => {
                                            const newRated = { ...ratedMessages, [msg.id]: 1 };
                                            setRatedMessages(newRated);
                                            onRate && onRate(msg, 1);
                                        }}
                                        disabled={ratedMessages[msg.id]}
                                        style={{
                                            background: ratedMessages[msg.id] === 1 ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                                            border: 'none',
                                            cursor: ratedMessages[msg.id] ? 'default' : 'pointer',
                                            fontSize: '0.8rem',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            color: ratedMessages[msg.id] === 1 ? '#4ade80' : 'rgba(255,255,255,0.4)',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        👍 Helpful
                                    </button>
                                    <button
                                        onClick={() => {
                                            const newRated = { ...ratedMessages, [msg.id]: -1 };
                                            setRatedMessages(newRated);
                                            onRate && onRate(msg, -1);
                                        }}
                                        disabled={ratedMessages[msg.id]}
                                        style={{
                                            background: ratedMessages[msg.id] === -1 ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                            border: 'none',
                                            cursor: ratedMessages[msg.id] ? 'default' : 'pointer',
                                            fontSize: '0.8rem',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            color: ratedMessages[msg.id] === -1 ? '#f87171' : 'rgba(255,255,255,0.4)',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        👎 Unhelpful
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )
    }



    return (
        <div className="chat-container">
            {/* Messages */}
            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: 'var(--space-xl)',
                        color: 'var(--text-muted)'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>
                            🤖 💬 🧙
                        </div>
                        <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>
                            Welcome to AutoAgents!
                        </h3>
                        <p>
                            Upload some code files and ask the agents to review, improve, or test them.
                        </p>
                        <div style={{
                            marginTop: '24px',
                            display: 'flex',
                            gap: '16px',
                            justifyContent: 'center',
                            flexWrap: 'wrap'
                        }}>
                            <SuggestionChip onClick={() => onSendMessage("Review my code for best practices")}>
                                🔍 Review my code
                            </SuggestionChip>
                            <SuggestionChip onClick={() => onSendMessage("Write unit tests for my code")}>
                                🧪 Write tests
                            </SuggestionChip>
                            <SuggestionChip onClick={() => onSendMessage("What are the latest Python best practices?")}>
                                📚 Research best practices
                            </SuggestionChip>
                        </div>
                    </div>
                ) : (
                    messages.filter(m => m.type !== 'agent_status').map(renderMessage)
                )}

                {/* Typing Indicator */}
                {isTyping && currentAgent && (
                    <div className="typing-indicator active">
                        <span style={{
                            fontSize: '1.25rem',
                            marginRight: '8px'
                        }}>
                            {AGENTS[currentAgent.name]?.emoji || '🤖'}
                        </span>
                        <div className="typing-text-container">
                            <span className="typing-name">{currentAgent.name}</span>
                            <span className="typing-status">
                                {agentStatus ? agentStatus.replace('...', '') : 'is currently working'}...
                            </span>
                        </div>
                        <div className="typing-dots">
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Container */}
            <div
                className={`chat-input-container ${isDraggingFile ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Attached Files Bar */}
                {attachedFiles.length > 0 && (
                    <div className="attached-files-bar">
                        {attachedFiles.map(file => (
                            <div key={file.path} className="attached-file-chip">
                                <span className="chip-icon">{getFileIcon(file.extension)}</span>
                                <span className="chip-name">{file.path}</span>
                                <button
                                    className="chip-remove"
                                    onClick={() => onRemoveFile(file.path)}
                                    title="Remove attachment"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {showContinuePrompt && (
                    <div className="continue-prompt-banner">
                        <div className="continue-prompt-content">
                            <span className="continue-prompt-text">Conversation was stopped. Would you like to continue?</span>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={handleContinue}
                                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            >
                                🔄 Continue
                            </button>
                        </div>
                        <button
                            type="button"
                            className="btn-continue-dismiss"
                            onClick={() => setShowContinuePrompt(false)}
                            title="Dismiss"
                        >
                            ✕
                        </button>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="chat-input-wrapper">
                    <textarea
                        ref={inputRef}
                        className="chat-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isConnected ? "Ask the agents something..." : "Connecting..."}
                        disabled={!isConnected || isTyping}
                        rows={1}
                    />
                    {isTyping ? (
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => {
                                onStop();
                                setShowContinuePrompt(false);
                            }}
                            title="Stop generating"
                        >
                            🛑 Stop
                        </button>
                    ) : (
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!isConnected || !input.trim()}
                        >
                            Send ➤
                        </button>
                    )}
                </form>
            </div>
        </div>
    )
}

function SuggestionChip({ children, onClick }) {
    return (
        <button
            className="btn btn-secondary"
            onClick={onClick}
            style={{ fontSize: '0.8125rem' }}
        >
            {children}
        </button>
    )
}

export default AgentChat
