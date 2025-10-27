/**
 * AI Agent Tests - Phase 2
 * 
 * Tests for AIAgent Durable Object functionality:
 * - State management
 * - Message processing
 * - Memory system
 * - Workflow integration
 * - WebSocket communication
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIAgent } from '../src/agents/AIAgent';
import type { Env } from '../src/types';

// Mock environment
const createMockEnv = (): Env => ({
  AI: {
    run: vi.fn().mockResolvedValue({
      response: 'Mock AI response',
      data: [[0.1, 0.2, 0.3]], // Mock embedding
    }),
  } as any,
  VECTORIZE: {
    query: vi.fn().mockResolvedValue({
      matches: [],
    }),
    upsert: vi.fn().mockResolvedValue({}),
  } as any,
  FILES: {} as any,
  CONFIG: {} as any,
  AI_AGENT: {} as any,
  ENVIRONMENT: 'test',
  LOG_LEVEL: 'debug',
});

// Mock Durable Object state
const createMockState = () => ({
  storage: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    sql: {
      exec: vi.fn().mockResolvedValue({ toArray: () => [] }),
    },
    id: {
      toString: () => 'test-agent-id',
    },
  },
});

describe('AIAgent', () => {
  let agent: AIAgent;
  let mockEnv: Env;
  let mockState: any;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockState = createMockState();
    agent = new AIAgent(mockState, mockEnv);
  });

  describe('Initialization', () => {
    it('should initialize agent with default state', () => {
      expect(agent).toBeDefined();
      expect(mockState.storage.sql.exec).toHaveBeenCalled();
    });

    it('should create SQL tables on initialization', () => {
      const calls = mockState.storage.sql.exec.mock.calls;
      const sqlStatements = calls.map((call: any[]) => call[0]);
      
      expect(sqlStatements.some((sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS messages'))).toBe(true);
      expect(sqlStatements.some((sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS user_context'))).toBe(true);
      expect(sqlStatements.some((sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS workflows'))).toBe(true);
    });
  });

  describe('HTTP Request Handling', () => {
    it('should handle health check requests', async () => {
      const request = new Request('http://test.com/health');
      const response = await agent.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.agentId).toBeDefined();
    });

    it('should return conversation history', async () => {
      const request = new Request('http://test.com/history');
      const response = await agent.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.history).toBeDefined();
      expect(Array.isArray(data.history)).toBe(true);
    });

    it('should handle message via HTTP', async () => {
      const request = new Request('http://test.com/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hello', userId: 'test-user' }),
      });

      const response = await agent.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBeDefined();
      expect(mockEnv.AI.run).toHaveBeenCalled();
    });

    it('should handle context retrieval', async () => {
      const request = new Request('http://test.com/context');
      const response = await agent.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.context).toBeDefined();
    });

    it('should clear conversation history', async () => {
      const request = new Request('http://test.com/clear', { method: 'POST' });
      const response = await agent.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('cleared');
      expect(mockState.storage.sql.exec).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM messages')
      );
    });
  });

  describe('Message Processing', () => {
    it('should process user messages', async () => {
      const message = 'What is AI?';
      const response = await agent.processMessage(message, 'test-user');

      expect(response).toBeDefined();
      expect(response.role).toBe('assistant');
      expect(response.content).toBeDefined();
      expect(response.timestamp).toBeDefined();
    });

    it('should sanitize input', async () => {
      const maliciousInput = '<script>alert("xss")</script>Hello';
      const response = await agent.processMessage(maliciousInput);

      expect(response.content).toBeDefined();
      // The input should be sanitized before processing
    });

    it('should store messages in database', async () => {
      await agent.processMessage('Test message');

      const execCalls = mockState.storage.sql.exec.mock.calls;
      const insertCalls = execCalls.filter((call: any[]) =>
        call[0].includes('INSERT INTO messages')
      );

      expect(insertCalls.length).toBeGreaterThan(0);
    });

    it('should track response time in metadata', async () => {
      const response = await agent.processMessage('Hello');

      expect(response.metadata).toBeDefined();
      expect(response.metadata?.responseTime).toBeDefined();
      expect(typeof response.metadata?.responseTime).toBe('number');
    });
  });

  describe('AI Integration', () => {
    it('should call Workers AI with correct parameters', async () => {
      await agent.processMessage('Test prompt');

      expect(mockEnv.AI.run).toHaveBeenCalledWith(
        expect.any(String), // model name
        expect.objectContaining({
          messages: expect.any(Array),
          max_tokens: expect.any(Number),
          temperature: expect.any(Number),
        })
      );
    });

    it('should handle AI failures gracefully', async () => {
      (mockEnv.AI.run as any).mockRejectedValueOnce(new Error('AI Error'));

      const response = await agent.processMessage('Test');

      expect(response.content).toContain('error');
    });

    it('should generate embeddings', async () => {
      const embedding = await agent['generateEmbedding']('Test text');

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(mockEnv.AI.run).toHaveBeenCalledWith(
        '@cf/baai/bge-base-en-v1.5',
        expect.any(Object)
      );
    });
  });

  describe('Memory System', () => {
    it('should store messages in vectorize', async () => {
      await agent.processMessage('Remember this');

      expect(mockEnv.VECTORIZE.upsert).toHaveBeenCalled();
    });

    it('should search memory for relevant context', async () => {
      const memories = await agent['searchMemory']('test query');

      expect(mockEnv.VECTORIZE.query).toHaveBeenCalled();
      expect(Array.isArray(memories)).toBe(true);
    });

    it('should handle memory search failures', async () => {
      (mockEnv.VECTORIZE.query as any).mockRejectedValueOnce(new Error('Search failed'));

      const memories = await agent['searchMemory']('test query');

      expect(memories).toEqual([]);
    });
  });

  describe('Context Management', () => {
    it('should build context with system prompt', async () => {
      const context = await agent['buildContext']('Test message', []);

      expect(context.length).toBeGreaterThan(0);
      expect(context[0].role).toBe('system');
    });

    it('should include recent conversation history', async () => {
      // Add some messages first
      await agent.processMessage('First message');
      await agent.processMessage('Second message');

      const context = await agent['buildContext']('Third message', []);

      const historyMessages = context.filter(
        (m: any) => m.role === 'user' || m.role === 'assistant'
      );
      expect(historyMessages.length).toBeGreaterThan(0);
    });

    it('should include relevant memories in context', async () => {
      const mockMemories = [
        {
          id: '1',
          type: 'conversation' as const,
          content: 'Previous conversation',
          embedding: [0.1, 0.2],
          metadata: {
            timestamp: Date.now(),
            userId: 'test',
            importance: 0.8,
            tags: [],
          },
        },
      ];

      const context = await agent['buildContext']('New message', mockMemories);

      const memoryContext = context.find((m: any) =>
        m.content.includes('Relevant context')
      );
      expect(memoryContext).toBeDefined();
    });

    it('should respect token limits', async () => {
      // Create a very long history
      for (let i = 0; i < 100; i++) {
        agent['state'].conversationHistory.push({
          id: `msg-${i}`,
          role: 'user',
          content: `Message ${i}`.repeat(100),
          timestamp: Date.now(),
        });
      }

      const context = await agent['buildContext']('New message', []);

      // Should not include all messages due to token limit
      expect(context.length).toBeLessThan(100);
    });
  });

  describe('Workflow Integration', () => {
    it('should trigger workflows', async () => {
      const workflowId = await agent.triggerWorkflow('test-workflow', {
        param: 'value',
      });

      expect(workflowId).toBeDefined();
      expect(typeof workflowId).toBe('string');
    });

    it('should store workflow records', async () => {
      await agent.triggerWorkflow('test-workflow', {});

      const execCalls = mockState.storage.sql.exec.mock.calls;
      const workflowInsert = execCalls.find((call: any[]) =>
        call[0].includes('INSERT INTO workflows')
      );

      expect(workflowInsert).toBeDefined();
    });

    it('should update workflow status', async () => {
      const workflowId = await agent.triggerWorkflow('test-workflow', {});
      await agent.updateWorkflowStatus(workflowId, 'completed', { result: 'success' });

      const execCalls = mockState.storage.sql.exec.mock.calls;
      const statusUpdate = execCalls.find((call: any[]) =>
        call[0].includes('UPDATE workflows')
      );

      expect(statusUpdate).toBeDefined();
    });
  });

  describe('State Persistence', () => {
    it('should save state after processing messages', async () => {
      await agent.processMessage('Test');

      expect(mockState.storage.put).toHaveBeenCalledWith('state', expect.any(Object));
    });

    it('should load state from storage on initialization', async () => {
      const savedState = {
        conversationHistory: [
          {
            id: '1',
            role: 'user',
            content: 'Previous message',
            timestamp: Date.now(),
          },
        ],
        userContext: { userId: 'test-user' },
        activeWorkflows: [],
        lastActivity: Date.now(),
      };

      mockState.storage.get.mockResolvedValueOnce(savedState);

      const newAgent = new AIAgent(mockState, mockEnv);

      // Give it time to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockState.storage.get).toHaveBeenCalledWith('state');
    });

    it('should update lastActivity timestamp', async () => {
      const beforeActivity = agent['state'].lastActivity;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      await agent.processMessage('Test');

      expect(agent['state'].lastActivity).toBeGreaterThan(beforeActivity);
    });
  });

  describe('History Management', () => {
    it('should trim history when it exceeds max length', async () => {
      // Add many messages
      for (let i = 0; i < 60; i++) {
        agent['state'].conversationHistory.push({
          id: `msg-${i}`,
          role: 'user',
          content: `Message ${i}`,
          timestamp: Date.now(),
        });
      }

      await agent['trimHistory']();

      expect(agent['state'].conversationHistory.length).toBeLessThanOrEqual(50);
    });

    it('should keep most recent messages when trimming', async () => {
      for (let i = 0; i < 60; i++) {
        agent['state'].conversationHistory.push({
          id: `msg-${i}`,
          role: 'user',
          content: `Message ${i}`,
          timestamp: Date.now() + i,
        });
      }

      await agent['trimHistory']();

      const firstMessage = agent['state'].conversationHistory[0];
      expect(firstMessage.content).toContain('10'); // Should start from message 10
    });
  });
});
