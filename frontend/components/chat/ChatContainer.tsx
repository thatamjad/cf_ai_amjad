import { useEffect, useRef } from 'react';
import { Message } from './Message';
import { TypingIndicator } from './TypingIndicator';
import type { Message as MessageType } from '@/types';
import { cn } from '@/lib/utils';

interface ChatContainerProps {
  messages: MessageType[];
  isLoading?: boolean;
  streamingMessageId?: string | null;
  streamingContent?: string;
  className?: string;
}

export function ChatContainer({
  messages,
  isLoading = false,
  streamingMessageId,
  streamingContent = '',
  className,
}: ChatContainerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-1 overflow-y-auto space-y-0',
        className
      )}
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-center p-8">
          <div className="space-y-3 max-w-md">
            <div className="text-6xl">👋</div>
            <h2 className="text-2xl font-bold">Welcome!</h2>
            <p className="text-muted-foreground">
              Start a conversation by typing a message below. I'm here to help with
              information, brainstorming, coding, and more.
            </p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <Message
              key={message.id}
              message={message}
              isStreaming={message.id === streamingMessageId}
              streamingContent={streamingContent}
            />
          ))}
          {isLoading && !streamingMessageId && <TypingIndicator />}
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
