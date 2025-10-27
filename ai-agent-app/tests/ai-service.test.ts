/**
 * AI Service Tests - Phase 2
 * 
 * Tests for AI service functionality:
 * - Chat completion
 * - Embedding generation
 * - Prompt templates
 * - Streaming
 * - Fallback mechanisms
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIService, PromptTemplates } from '../src/services/ai.service';
import type { Env } from '../src/types';

const createMockEnv = (): Env => ({
  AI: {
    run: vi.fn().mockResolvedValue({
      response: 'Mock AI response',
      data: [[0.1, 0.2, 0.3]],
    }),
  } as any,
  VECTORIZE: {} as any,
  FILES: {} as any,
  CONFIG: {} as any,
  AI_AGENT: {} as any,
  ENVIRONMENT: 'test',
  LOG_LEVEL: 'debug',
});

describe('AIService', () => {
  let service: AIService;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = createMockEnv();
    service = new AIService(mockEnv);
  });

  describe('Chat Completion', () => {
    it('should generate chat completion', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const response = await service.generateChatCompletion(messages);

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(mockEnv.AI.run).toHaveBeenCalled();
    });

    it('should use default options', async () => {
      const messages = [{ role: 'user', content: 'Test' }];
      await service.generateChatCompletion(messages);

      expect(mockEnv.AI.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          temperature: 0.7,
          max_tokens: 1024,
          top_p: 0.9,
        })
      );
    });

    it('should allow custom options', async () => {
      const messages = [{ role: 'user', content: 'Test' }];
      await service.generateChatCompletion(messages, {
        temperature: 0.5,
        max_tokens: 512,
      });

      expect(mockEnv.AI.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          temperature: 0.5,
          max_tokens: 512,
        })
      );
    });

    it('should handle AI failures with fallback', async () => {
      (mockEnv.AI.run as any)
        .mockRejectedValueOnce(new Error('Primary model failed'))
        .mockResolvedValueOnce({ response: 'Fallback response' });

      const messages = [{ role: 'user', content: 'Test' }];
      const response = await service.generateChatCompletion(messages);

      expect(response).toBeDefined();
      expect(mockEnv.AI.run).toHaveBeenCalledTimes(2);
    });

    it('should return error message if all models fail', async () => {
      (mockEnv.AI.run as any).mockRejectedValue(new Error('All models failed'));

      const messages = [{ role: 'user', content: 'Test' }];
      const response = await service.generateChatCompletion(messages);

      expect(response).toContain('error');
    });
  });

  describe('Embedding Generation', () => {
    it('should generate embeddings', async () => {
      const text = 'Test text';
      const embedding = await service.generateEmbedding(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should call correct embedding model', async () => {
      await service.generateEmbedding('Test');

      expect(mockEnv.AI.run).toHaveBeenCalledWith(
        '@cf/baai/bge-base-en-v1.5',
        expect.objectContaining({
          text: ['Test'],
        })
      );
    });

    it('should generate batch embeddings', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      (mockEnv.AI.run as any).mockResolvedValue({
        data: [[0.1], [0.2], [0.3]],
      });

      const embeddings = await service.generateEmbeddingsBatch(texts);

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(3);
      expect(mockEnv.AI.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: texts,
        })
      );
    });

    it('should handle embedding failures', async () => {
      (mockEnv.AI.run as any).mockRejectedValue(new Error('Embedding failed'));

      await expect(service.generateEmbedding('Test')).rejects.toThrow();
    });
  });

  describe('Prompt Templates', () => {
    it('should create prompt from template', () => {
      const template = 'Hello {{name}}, welcome to {{place}}!';
      const variables = { name: 'Alice', place: 'Wonderland' };

      const prompt = service.createPrompt(template, variables);

      expect(prompt).toBe('Hello Alice, welcome to Wonderland!');
    });

    it('should handle multiple instances of same variable', () => {
      const template = '{{word}} {{word}} {{word}}';
      const variables = { word: 'test' };

      const prompt = service.createPrompt(template, variables);

      expect(prompt).toBe('test test test');
    });

    it('should have predefined templates', () => {
      expect(PromptTemplates.greeting).toBeDefined();
      expect(PromptTemplates.error).toBeDefined();
      expect(PromptTemplates.clarification).toBeDefined();
    });
  });

  describe('System Prompts', () => {
    it('should return base system prompt', () => {
      const prompt = service.getSystemPrompt();

      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toContain('AI assistant');
    });

    it('should include custom instructions', () => {
      const custom = 'Be extra helpful';
      const prompt = service.getSystemPrompt(custom);

      expect(prompt).toContain(custom);
    });
  });

  describe('Message Formatting', () => {
    it('should format messages for AI model', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const formatted = service.formatMessages(messages);

      expect(formatted).toBeDefined();
      expect(formatted.length).toBe(2);
      expect(formatted[0].role).toBe('user');
    });

    it('should add system prompt if provided', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const systemPrompt = 'You are helpful';

      const formatted = service.formatMessages(messages, systemPrompt);

      expect(formatted[0].role).toBe('system');
      expect(formatted[0].content).toBe(systemPrompt);
      expect(formatted.length).toBe(2);
    });
  });

  describe('Conversation Summarization', () => {
    it('should summarize conversation', async () => {
      const messages = [
        { role: 'user', content: 'What is AI?' },
        { role: 'assistant', content: 'AI stands for Artificial Intelligence...' },
      ];

      const summary = await service.summarizeConversation(messages);

      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
      expect(mockEnv.AI.run).toHaveBeenCalled();
    });

    it('should use appropriate parameters for summarization', async () => {
      await service.summarizeConversation([]);

      expect(mockEnv.AI.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          max_tokens: 150,
          temperature: 0.5,
        })
      );
    });
  });

  describe('Intent Extraction', () => {
    it('should extract intent from message', async () => {
      const message = 'How do I reset my password?';
      const intent = await service.extractIntent(message);

      expect(intent).toBeDefined();
      expect(typeof intent).toBe('string');
    });

    it('should use low temperature for intent extraction', async () => {
      await service.extractIntent('Test message');

      expect(mockEnv.AI.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          temperature: 0.3,
          max_tokens: 10,
        })
      );
    });
  });

  describe('Content Moderation', () => {
    it('should return safe for appropriate content', async () => {
      (mockEnv.AI.run as any).mockResolvedValue({ response: 'SAFE' });

      const result = await service.moderateContent('Hello, how are you?');

      expect(result.safe).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return unsafe with reason for inappropriate content', async () => {
      (mockEnv.AI.run as any).mockResolvedValue({
        response: 'UNSAFE: Contains offensive language',
      });

      const result = await service.moderateContent('Bad content');

      expect(result.safe).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should default to safe on moderation failure', async () => {
      (mockEnv.AI.run as any).mockRejectedValue(new Error('Moderation failed'));

      const result = await service.moderateContent('Test');

      expect(result.safe).toBe(true);
    });
  });
});
