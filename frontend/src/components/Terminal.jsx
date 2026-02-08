import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const WS_URL = import.meta.env.VITE_WS_URL || '';

const TerminalComponent = ({ isActive, onActivity }) => {
    // shell is now hardcoded to 'powershell' in backend for stability
    const shell = 'powershell';

    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const wsRef = useRef(null);

    useEffect(() => {
        // Initialize xterm.js
        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#1e1e1e',
                foreground: '#f0f0f0',
                cursor: '#00ff88',
                selection: 'rgba(0, 255, 136, 0.3)',
                black: '#000000',
                red: '#ff5555',
                green: '#50fa7b',
                yellow: '#f1fa8c',
                blue: '#bd93f9',
                magenta: '#ff79c6',
                cyan: '#8be9fd',
                white: '#bbbbbb',
                brightBlack: '#555555',
                brightRed: '#ff6e6e',
                brightGreen: '#69ff94',
                brightYellow: '#ffffa5',
                brightBlue: '#d6acff',
                brightMagenta: '#ff92df',
                brightCyan: '#a4ffff',
                brightWhite: '#ffffff'
            },
            fontFamily: '"Fira Code", monospace',
            fontSize: 14,
            convertEol: true,
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        term.loadAddon(fitAddon);
        term.loadAddon(webLinksAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Connect to WebSocket with shell preference (only if WS_URL is configured)
        if (!WS_URL) {
            term.writeln('\x1b[1;33mTerminal unavailable in serverless mode\x1b[0m');
            term.writeln('WebSocket not configured for AWS deployment');
            return;
        }
        const wsUrl = `${WS_URL}/ws/terminal?shell=${shell}`;
        const ws = new WebSocket(wsUrl);

        wsRef.current = ws;
        window.terminalWs = ws; // Expose for App.jsx to use for RUN_COMMAND


        ws.onopen = () => {
            term.writeln(`\u001b[1;32mWelcome to DevSquad Terminal (${shell})\u001b[0m`);
            term.writeln('Connected to backend PTY session...');
            // Initial resize
            const dims = fitAddon.proposeDimensions();
            if (dims) {
                ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
                fitAddon.fit();
            }
        };

        ws.onmessage = (event) => {
            term.write(event.data);
            if (onActivity) onActivity();
        };

        ws.onclose = () => {
            term.writeln('\r\n\u001b[1;31mConnection closed.\u001b[0m');
        };

        ws.onerror = (err) => {
            term.writeln(`\r\n\u001b[1;31mWebSocket error: ${err.message}\u001b[0m`);
        };

        // Handle user input
        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'input', data }));
            }
        });

        // Handle resize
        const handleResize = () => {
            if (!fitAddonRef.current) return;
            try {
                fitAddonRef.current.fit();
                const dims = fitAddonRef.current.proposeDimensions();
                if (dims && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'resize',
                        cols: dims.cols,
                        rows: dims.rows
                    }));
                }
            } catch (e) {
                console.error('Resize error:', e);
            }
        };

        window.addEventListener('resize', handleResize);

        // Initial focus
        term.focus();

        return () => {
            window.removeEventListener('resize', handleResize);
            term.dispose();
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [shell]); // Re-run if shell changes

    // Refit when the component becomes active/visible
    useEffect(() => {
        if (isActive && fitAddonRef.current) {
            setTimeout(() => {
                try {
                    fitAddonRef.current.fit();
                    const dims = fitAddonRef.current.proposeDimensions();
                    if (dims && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({
                            type: 'resize',
                            cols: dims.cols,
                            rows: dims.rows
                        }));
                    }
                } catch (e) { console.error('Fit error on active:', e); }
            }, 50); // Small delay to allow layout to settle
        }
    }, [isActive]);

    return (
        <div
            className="terminal-wrapper"
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#1e1e1e',
                overflow: 'hidden'
            }}
        >
            <div className="terminal-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 12px',
                background: '#252526',
                borderBottom: '1px solid #333',
                fontSize: '0.75rem',
                color: '#ccc'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.9rem' }}>💻</span>
                    <span style={{ fontWeight: '600', letterSpacing: '0.05em' }}>TERMINAL</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(0, 255, 136, 0.1)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        color: 'var(--neon-green)',
                        border: '1px solid rgba(0, 255, 136, 0.2)'
                    }}>
                        <span style={{ width: '6px', height: '6px', background: 'var(--neon-green)', borderRadius: '50%' }}></span>
                        POWERSHELL
                    </div>
                </div>
            </div>

            <div
                className="terminal-container"
                style={{
                    flex: 1,
                    width: '100%',
                    padding: '8px',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                }}
            >
                <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
            </div>
        </div>
    );
};

export default TerminalComponent;
