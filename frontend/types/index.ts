// API Types
export interface AgentConfig {
  name: string;
  systemPrompt: string;
  maxMemories?: number;
  temperature?: number;
  modelName?: string;
}

export interface AgentMetadata {
  id: string;
  name: string;
  systemPrompt: string;
  createdAt: string;
  messageCount: number;
  memoryCount: number;
  modelName: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    tokenCount?: number;
    processingTime?: number;
    memoryUsed?: boolean;
    workflowTriggered?: string;
  };
}

export interface Memory {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    messageId: string;
    timestamp: string;
    importance: number;
  };
  createdAt: string;
}

export interface ConversationHistory {
  agentId: string;
  messages: Message[];
  totalMessages: number;
  oldestMessage: string;
  newestMessage: string;
}

export interface ContextInfo {
  agentId: string;
  totalMessages: number;
  contextWindow: number;
  messagesInContext: number;
  relevantMemories: number;
  contextSummary: string;
}

// WebSocket Message Types
export interface WSMessage {
  type: 'connected' | 'message' | 'token' | 'complete' | 'error' | 'memory_stored' | 'workflow_triggered';
  data?: any;
  error?: string;
}

export interface WSConnectedData {
  agentId: string;
  timestamp: string;
}

export interface WSMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface WSTokenData {
  messageId: string;
  token: string;
  timestamp: string;
}

export interface WSCompleteData {
  messageId: string;
  fullContent: string;
  metadata: {
    tokenCount: number;
    processingTime: number;
  };
}

export interface WSErrorData {
  code: string;
  message: string;
  timestamp: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface CreateAgentResponse {
  agentId: string;
  name: string;
  systemPrompt: string;
  createdAt: string;
}

export interface SendMessageResponse {
  messageId: string;
  response: string;
  metadata: {
    tokenCount: number;
    processingTime: number;
    memoryStored: boolean;
  };
}

// UI State Types
export interface ChatState {
  agentId: string | null;
  messages: Message[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  streamingMessageId: string | null;
  streamingContent: string;
}

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
}

// Error Types
export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number
  ) {
    super(message);
    this.name = 'AgentError';
  }
}
