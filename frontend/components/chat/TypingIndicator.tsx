export function TypingIndicator() {
  return (
    <div className="flex gap-3 p-4 bg-muted/30">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
        <span className="text-xs">🤖</span>
      </div>
      <div className="flex items-center gap-1 h-8">
        <div className="typing-dot w-2 h-2 bg-muted-foreground rounded-full" />
        <div className="typing-dot w-2 h-2 bg-muted-foreground rounded-full" />
        <div className="typing-dot w-2 h-2 bg-muted-foreground rounded-full" />
      </div>
    </div>
  );
}
