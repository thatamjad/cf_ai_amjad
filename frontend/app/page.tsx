'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Zap, Shield, Brain } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleStartChat = async () => {
    setIsLoading(true);
    // Navigate to chat page (we'll create agent on demand)
    router.push('/chat');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl space-y-8 text-center">
        {/* Hero Section */}
        <div className="space-y-4 animate-in">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full">
              <Brain className="w-16 h-16 text-primary" />
            </div>
          </div>
          
          <h1 className="text-5xl font-bold tracking-tight text-balance">
            AI Agent Assistant
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
            Experience the next generation of conversational AI powered by{' '}
            <span className="text-primary font-semibold">Cloudflare Workers AI</span>.
            Advanced memory, real-time streaming, and intelligent reasoning.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <FeatureCard
            icon={<Sparkles className="w-6 h-6" />}
            title="Advanced AI"
            description="Powered by Llama 3.3 70B with sophisticated reasoning capabilities"
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6" />}
            title="Real-time Streaming"
            description="Instant responses with token-by-token streaming for natural conversations"
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6" />}
            title="Semantic Memory"
            description="Remembers context and learns from conversations using vector embeddings"
          />
        </div>

        {/* CTA Button */}
        <div className="pt-8">
          <button
            onClick={handleStartChat}
            disabled={isLoading}
            className="px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold text-lg hover:bg-primary/90 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⚙️</span>
                Starting...
              </span>
            ) : (
              'Start Conversation'
            )}
          </button>
        </div>

        {/* Footer Info */}
        <div className="pt-12 text-sm text-muted-foreground">
          <p>
            Built with Next.js • Cloudflare Pages • Workers AI • Durable Objects
          </p>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors group">
      <div className="flex flex-col items-center space-y-3 text-center">
        <div className="p-3 bg-primary/10 rounded-lg text-primary group-hover:bg-primary/20 transition-colors">
          {icon}
        </div>
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
