import { useEffect, useRef } from 'react';

export const useFilePoller = (fetchFileTree, isConnected) => {
    const intervalRef = useRef(null);

    useEffect(() => {
        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Determine if we are in "Cloud Mode" (Production or non-localhost)
        // In a real scenario, this might also check an env var like VITE_IS_CLOUD
        const isCloudMode = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

        // Polling Strategy:
        // 1. If we are in Cloud Mode, we ALWAYS poll because WebSockets might be flaky or nonexistent for file events.
        // 2. If we are Local, we only poll if WebSocket is disconnected.

        const shouldPoll = isCloudMode || !isConnected;

        if (shouldPoll) {
            console.log(`📡 [useFilePoller] Polling enabled (Cloud: ${isCloudMode}, WS Disconnected: ${!isConnected})`);

            // Poll every 3 seconds
            intervalRef.current = setInterval(() => {
                fetchFileTree();
            }, 3000);
        } else {
            console.log('⚡ [useFilePoller] Polling disabled (Local + WS Connected)');
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [fetchFileTree, isConnected]);
};
