/**
 * Tool/Function Calling Types for Phase 4
 * Comprehensive type definitions for the tool registry and execution system
 */

// JSON Schema type for tool parameters
export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  description?: string;
  enum?: any[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

// Tool execution result
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
  metadata?: Record<string, any>;
}

// Tool execution context
export interface ToolContext {
  userId?: string;
  agentId: string;
  conversationId?: string;
  timestamp: number;
  env: any; // Cloudflare Worker env
}

// Tool definition
export interface Tool {
  name: string;
  description: string;
  category: 'search' | 'compute' | 'data' | 'file' | 'image' | 'communication' | 'utility';
  parameters: JSONSchema;
  execute: (params: any, context: ToolContext) => Promise<ToolResult>;
  requiresAuth?: boolean;
  rateLimit?: {
    calls: number;
    period: number; // in seconds
  };
  cost?: number; // estimated cost in credits
}

// Tool call from LLM
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

// Tool execution log
export interface ToolExecutionLog {
  id: string;
  toolName: string;
  agentId: string;
  userId?: string;
  parameters: any;
  result: ToolResult;
  timestamp: number;
  duration: number;
}

// Built-in tool categories
export enum ToolCategory {
  SEARCH = 'search',
  COMPUTE = 'compute',
  DATA = 'data',
  FILE = 'file',
  IMAGE = 'image',
  COMMUNICATION = 'communication',
  UTILITY = 'utility',
}

// Tool permission levels
export enum ToolPermission {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
  ADMIN = 'admin',
}

// Extended tool metadata
export interface ToolMetadata {
  version: string;
  author?: string;
  documentation?: string;
  examples?: Array<{
    description: string;
    parameters: any;
    expectedResult?: any;
  }>;
  tags?: string[];
  permission: ToolPermission;
}
