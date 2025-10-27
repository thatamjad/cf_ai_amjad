'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Menu, Settings, Trash2, MessageSquare, AlertCircle } from 'lucide-react';
import { useAgent } from '@/hooks/useAgent';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { ChatInput } from '@/components/chat/ChatInput';

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentIdParam = searchParams?.get('id');

  const [isInitializing, setIsInitializing] = useState(true);

  const {
    agentId,
    messages,
    isLoading,
    error,
    isConnected,
    streamingMessageId,
    streamingContent,
    metadata,
    createAgent,
    sendMessage,
    loadHistory,
    clearHistory,
    connect,
  } = useAgent({
    agentId: agentIdParam || undefined,
    autoConnect: false,
  });

  // Initialize agent
  useEffect(() => {
    const initializeAgent = async () => {
      try {
        setIsInitializing(true);

        if (agentIdParam) {
          // Load existing agent
          await loadHistory();
          await connect();
        } else {
          // Create new agent
          const newAgentId = await createAgent({
            name: 'AI Assistant',
            systemPrompt:
              'You are a helpful, intelligent AI assistant. Provide clear, accurate, and thoughtful responses. Use markdown formatting when appropriate.',
            temperature: 0.7,
          });

          // Update URL with agent ID
          if (newAgentId) {
            router.replace(`/chat?id=${newAgentId}`);
            await connect();
          }
        }
      } catch (err) {
        console.error('Failed to initialize agent:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAgent();
  }, [agentIdParam]);

  const handleSendMessage = (content: string) => {
    sendMessage(content);
  };

  const handleClearHistory = async () => {
    if (confirm('Are you sure you want to clear the conversation history?')) {
      await clearHistory();
    }
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Initializing agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <button
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              {metadata?.name || 'AI Agent'}
            </h1>
            {metadata && (
              <p className="text-xs text-muted-foreground">
                {metadata.messageCount} messages • {metadata.memoryCount} memories
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection Status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
              isConnected
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-red-500/10 text-red-600 dark:text-red-400'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-600 dark:bg-green-400' : 'bg-red-600 dark:bg-red-400'
              }`}
            />
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>

          <button
            onClick={handleClearHistory}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
            aria-label="Clear history"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-destructive/10 border border-destructive/50 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-destructive">Error</p>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
        </div>
      )}

      {/* Chat Container */}
      <ChatContainer
        messages={messages}
        isLoading={isLoading}
        streamingMessageId={streamingMessageId}
        streamingContent={streamingContent}
      />

      {/* Input */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={!isConnected || isLoading}
        placeholder={
          isConnected
            ? 'Type your message...'
            : 'Connecting to agent...'
        }
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
