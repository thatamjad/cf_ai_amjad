import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { apiClient } from '@/lib/api';
import type { Message, AgentConfig, AgentMetadata, WSMessage } from '@/types';

export interface UseAgentOptions {
  agentId?: string;
  autoConnect?: boolean;
}

export function useAgent({ agentId: initialAgentId, autoConnect = false }: UseAgentOptions = {}) {
  const [agentId, setAgentId] = useState<string | null>(initialAgentId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [metadata, setMetadata] = useState<AgentMetadata | null>(null);
  
  const wsUrlRef = useRef<string | null>(null);

  // Update WebSocket URL when agentId changes
  useEffect(() => {
    if (agentId) {
      wsUrlRef.current = apiClient.getWebSocketUrl(agentId);
    }
  }, [agentId]);

  // WebSocket message handler
  const handleWSMessage = useCallback((wsMessage: WSMessage) => {
    switch (wsMessage.type) {
      case 'message':
        // Complete message received
        setMessages((prev) => [
          ...prev,
          {
            id: wsMessage.data.id,
            role: wsMessage.data.role,
            content: wsMessage.data.content,
            timestamp: wsMessage.data.timestamp,
          },
        ]);
        setIsLoading(false);
        break;

      case 'token':
        // Streaming token received
        if (!streamingMessageId) {
          const newId = wsMessage.data.messageId;
          setStreamingMessageId(newId);
          setStreamingContent(wsMessage.data.token);
        } else {
          setStreamingContent((prev) => prev + wsMessage.data.token);
        }
        break;

      case 'complete':
        // Streaming complete
        if (streamingMessageId) {
          setMessages((prev) => [
            ...prev,
            {
              id: streamingMessageId,
              role: 'assistant',
              content: wsMessage.data.fullContent,
              timestamp: new Date().toISOString(),
              metadata: wsMessage.data.metadata,
            },
          ]);
          setStreamingMessageId(null);
          setStreamingContent('');
        }
        setIsLoading(false);
        break;

      case 'error':
        setError(wsMessage.error || 'An error occurred');
        setIsLoading(false);
        setStreamingMessageId(null);
        setStreamingContent('');
        break;

      case 'memory_stored':
        console.log('[Agent] Memory stored:', wsMessage.data);
        break;

      case 'workflow_triggered':
        console.log('[Agent] Workflow triggered:', wsMessage.data);
        break;
    }
  }, [streamingMessageId]);

  const handleConnected = useCallback(() => {
    console.log('[Agent] Connected to agent:', agentId);
    setError(null);
  }, [agentId]);

  const handleError = useCallback((err: string) => {
    console.error('[Agent] WebSocket error:', err);
    setError(err);
    setIsLoading(false);
  }, []);

  const { connect, disconnect, sendMessage: wsSendMessage, isConnected } = useWebSocket({
    url: wsUrlRef.current || '',
    autoConnect: autoConnect && !!agentId,
    reconnect: true,
    onMessage: handleWSMessage,
    onConnected: handleConnected,
    onError: handleError,
  });

  // Create new agent
  const createAgent = useCallback(async (config: AgentConfig) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.createAgent(config);
      setAgentId(response.agentId);
      
      // Fetch agent metadata
      const agentData = await apiClient.getAgent(response.agentId);
      setMetadata(agentData);
      
      return response.agentId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create agent';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Send message via WebSocket
  const sendMessage = useCallback(async (content: string) => {
    if (!agentId || !isConnected) {
      setError('Not connected to agent');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Add user message immediately
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Send via WebSocket
    const success = wsSendMessage(content);
    if (!success) {
      setError('Failed to send message');
      setIsLoading(false);
    }
  }, [agentId, isConnected, wsSendMessage]);

  // Load conversation history
  const loadHistory = useCallback(async (limit: number = 50) => {
    if (!agentId) return;

    setIsLoading(true);
    setError(null);
    try {
      const history = await apiClient.getHistory(agentId, limit);
      setMessages(history.messages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load history';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  // Clear conversation history
  const clearHistory = useCallback(async () => {
    if (!agentId) return;

    setIsLoading(true);
    setError(null);
    try {
      await apiClient.clearHistory(agentId);
      setMessages([]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear history';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  // Load agent metadata
  const loadMetadata = useCallback(async () => {
    if (!agentId) return;

    try {
      const data = await apiClient.getAgent(agentId);
      setMetadata(data);
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  }, [agentId]);

  return {
    // State
    agentId,
    messages,
    isLoading,
    error,
    isConnected,
    streamingMessageId,
    streamingContent,
    metadata,

    // Actions
    createAgent,
    sendMessage,
    loadHistory,
    clearHistory,
    loadMetadata,
    connect,
    disconnect,
  };
}
