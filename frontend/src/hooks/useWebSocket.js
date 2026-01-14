/**
 * WebSocket Hook for real-time agent communication
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export function useWebSocket(url, options = {}) {
    const [isConnected, setIsConnected] = useState(false)
    const [lastMessage, setLastMessage] = useState(null)
    const wsRef = useRef(null)
    const reconnectTimeoutRef = useRef(null)
    const reconnectAttemptsRef = useRef(0)
    const MAX_RECONNECT_ATTEMPTS = 5

    // Use a ref for the handler so we don't reconnect when handler changes
    const onMessageRef = useRef(options.onMessage)
    useEffect(() => {
        onMessageRef.current = options.onMessage
    }, [options.onMessage])

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return

        try {
            wsRef.current = new WebSocket(url)

            wsRef.current.onopen = () => {
                console.log('🔌 WebSocket connected')
                setIsConnected(true)
                reconnectAttemptsRef.current = 0
            }

            wsRef.current.onclose = () => {
                console.log('🔌 WebSocket disconnected')
                setIsConnected(false)

                // Attempt reconnection
                if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttemptsRef.current++
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000)
                    console.log(`Reconnecting in ${delay}ms...`)
                    reconnectTimeoutRef.current = setTimeout(connect, delay)
                }
            }

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error)
            }

            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    setLastMessage(data)

                    // Direct callback to avoid React batching issues with high-frequency streams
                    if (onMessageRef.current) {
                        onMessageRef.current(data)
                    }
                } catch (err) {
                    console.error('Failed to parse message:', err)
                }
            }
        } catch (err) {
            console.error('Failed to connect:', err)
        }
    }, [url])

    useEffect(() => {
        connect()

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }
            if (wsRef.current) {
                wsRef.current.close()
            }
        }
    }, [connect])

    const sendMessage = useCallback((message) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message))
        } else {
            console.warn('WebSocket not connected')
        }
    }, [])

    const stopAgent = useCallback(() => {
        sendMessage({ type: 'stop' })
    }, [sendMessage])

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
        }
        reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS // Stop reconnection attempt
        if (wsRef.current) {
            wsRef.current.close()
        }
    }, [])

    return {
        isConnected,
        lastMessage,
        sendMessage,
        reconnect: connect,
        stopAgent,
        disconnect
    }
}
