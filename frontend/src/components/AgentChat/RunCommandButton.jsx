import React, { useState } from 'react';

const RunCommandButton = ({ command, onRun }) => {
    const [status, setStatus] = useState('idle'); // idle, running, done, error

    const handleRun = async () => {
        setStatus('running');
        try {
            await onRun(command);
            setStatus('done');
            // Reset to idle after 2 seconds so it can be run again if needed
            setTimeout(() => setStatus('idle'), 2000);
        } catch (err) {
            console.error(err);
            setStatus('error');
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: '8px 0',
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)'
        }}>
            <div style={{
                fontFamily: 'monospace',
                fontSize: '0.85em',
                color: '#a4ffff',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
            }}>
                $ {command}
            </div>
            <button
                className="btn btn-sm btn-primary"
                onClick={handleRun}
                disabled={status === 'running'}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    minWidth: '80px',
                    justifyContent: 'center'
                }}
            >
                {status === 'idle' && <>▶️ Run</>}
                {status === 'running' && <>⏳ Running</>}
                {status === 'done' && <>✅ Sent</>}
                {status === 'error' && <>❌ Error</>}
            </button>
        </div>
    );
};

export default RunCommandButton;
