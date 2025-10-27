import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { User, Bot, Clock } from 'lucide-react';
import type { Message as MessageType } from '@/types';
import { cn } from '@/lib/utils';

interface MessageProps {
  message: MessageType;
  isStreaming?: boolean;
  streamingContent?: string;
}

export function Message({ message, isStreaming = false, streamingContent }: MessageProps) {
  const isUser = message.role === 'user';
  const displayContent = isStreaming ? streamingContent : message.content;

  const formattedTime = useMemo(() => {
    try {
      const date = new Date(message.timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [message.timestamp]);

  return (
    <div
      className={cn(
        'flex gap-3 p-4 message-enter',
        isUser ? 'bg-transparent' : 'bg-muted/30'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground'
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">
            {isUser ? 'You' : 'AI Agent'}
          </span>
          {formattedTime && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formattedTime}
            </span>
          )}
        </div>

        {isUser ? (
          <p className="text-sm whitespace-pre-wrap break-words">{displayContent}</p>
        ) : (
          <div className="markdown text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {displayContent || ''}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />
            )}
          </div>
        )}

        {/* Metadata */}
        {message.metadata && !isStreaming && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            {message.metadata.tokenCount && (
              <span>Tokens: {message.metadata.tokenCount}</span>
            )}
            {message.metadata.processingTime && (
              <span>Time: {message.metadata.processingTime}ms</span>
            )}
            {message.metadata.memoryUsed && (
              <span className="text-primary">• Memory used</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
