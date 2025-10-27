import { useEffect, useRef, useCallback } from 'react';
import { WebSocketClient } from '@/lib/websocket';
import type { WSMessage } from '@/types';

export interface UseWebSocketOptions {
  url: string;
  autoConnect?: boolean;
  reconnect?: boolean;
  onMessage?: (message: WSMessage) => void;
  onConnected?: () => void;
  onError?: (error: string) => void;
  onDisconnected?: () => void;
}

export function useWebSocket({
  url,
  autoConnect = true,
  reconnect = true,
  onMessage,
  onConnected,
  onError,
  onDisconnected,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocketClient | null>(null);
  const handlersRef = useRef({ onMessage, onConnected, onError, onDisconnected });

  // Update handlers ref without triggering reconnection
  useEffect(() => {
    handlersRef.current = { onMessage, onConnected, onError, onDisconnected };
  }, [onMessage, onConnected, onError, onDisconnected]);

  const connect = useCallback(async () => {
    if (wsRef.current?.isConnected) {
      console.log('[useWebSocket] Already connected');
      return;
    }

    try {
      const ws = new WebSocketClient(url, { reconnect });
      wsRef.current = ws;

      // Set up event handlers
      ws.on('connected', () => {
        handlersRef.current.onConnected?.();
      });

      ws.on('message', (msg) => {
        handlersRef.current.onMessage?.(msg);
      });

      ws.on('token', (msg) => {
        handlersRef.current.onMessage?.(msg);
      });

      ws.on('complete', (msg) => {
        handlersRef.current.onMessage?.(msg);
      });

      ws.on('error', (msg) => {
        handlersRef.current.onError?.(msg.error || 'Unknown error');
      });

      ws.on('memory_stored', (msg) => {
        handlersRef.current.onMessage?.(msg);
      });

      ws.on('workflow_triggered', (msg) => {
        handlersRef.current.onMessage?.(msg);
      });

      await ws.connect();
    } catch (error) {
      console.error('[useWebSocket] Connection failed:', error);
      handlersRef.current.onError?.(
        error instanceof Error ? error.message : 'Connection failed'
      );
    }
  }, [url, reconnect]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
      handlersRef.current.onDisconnected?.();
    }
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (!wsRef.current?.isConnected) {
      console.warn('[useWebSocket] Cannot send: not connected');
      return false;
    }
    wsRef.current.send(message);
    return true;
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connect,
    disconnect,
    sendMessage,
    isConnected: wsRef.current?.isConnected ?? false,
  };
}
