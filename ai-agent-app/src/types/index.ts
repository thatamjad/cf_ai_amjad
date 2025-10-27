/**
 * Environment bindings for Cloudflare Workers
 */
export interface Env {
  // AI binding for Workers AI
  AI: any; // Will be typed by @cloudflare/workers-types

  // Vectorize binding for embeddings and memory
  VECTORIZE: any; // Will be typed by @cloudflare/workers-types

  // R2 binding for file storage
  FILES: any; // Will be typed by @cloudflare/workers-types

  // KV binding for configuration
  CONFIG: any; // Will be typed by @cloudflare/workers-types

  // Durable Object binding for AI Agent
  AI_AGENT: any; // Will be typed by @cloudflare/workers-types

  // Environment variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;
}

/**
 * Message interface for chat
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * User context for personalization
 */
export interface UserContext {
  userId: string;
  preferences?: Record<string, unknown>;
  conversationId?: string;
  sessionId?: string;
}

/**
 * Agent message interface
 */
export interface AgentMessage {
  type: 'message' | 'command' | 'event';
  content: string;
  metadata?: Record<string, unknown>;
  userId?: string;
}

/**
 * AI options for model inference
 */
export interface AIOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

/**
 * Memory entry for Vectorize
 */
export interface Memory {
  id: string;
  type: 'conversation' | 'fact' | 'preference' | 'task';
  content: string;
  embedding: number[];
  metadata: {
    timestamp: number;
    userId: string;
    importance: number;
    tags: string[];
  };
}

/**
 * Conversation history entry
 */
export interface ConversationHistory {
  id: string;
  userId: string;
  messages: Message[];
  summary?: string;
  startTime: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  params?: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt?: number;
  completedAt?: number;
}

/**
 * Agent state interface
 */
export interface AgentState {
  conversationHistory: Message[];
  userContext: UserContext;
  activeWorkflows: WorkflowDefinition[];
  lastActivity: number;
}

/**
 * WebSocket message types
 */
export type WebSocketMessage =
  | { type: 'message'; content: string; userId: string }
  | { type: 'typing'; userId: string }
  | { type: 'stop'; userId: string }
  | { type: 'error'; error: string }
  | { type: 'connected'; sessionId: string };
