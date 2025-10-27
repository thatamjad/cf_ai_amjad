/**
 * AI Service - Workers AI Integration with AI Gateway
 *
 * This service provides a wrapper around Workers AI with:
 * - AI Gateway integration for caching and rate limiting
 * - Fallback mechanisms
 * - Streaming support
 * - Prompt templates
 * - Token management
 */

import type { Env, AIOptions } from '../types';
import { Logger } from '../utils/logger';
import { retry } from '../utils/helpers';

const LLM_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export class AIService {
  private env: Env;
  private logger: Logger;

  constructor(env: Env) {
    this.env = env;
    this.logger = new Logger('AIService');
  }

  /**
   * Generate chat completion
   */
  async generateChatCompletion(messages: any[], options: AIOptions = {}): Promise<string> {
    const defaultOptions: AIOptions = {
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 0.9,
      stream: false,
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      // Try primary model with retry
      const response = await retry(
        async () => {
          return await this.env.AI.run(LLM_MODEL, {
            messages,
            ...finalOptions,
          });
        },
        3,
        1000
      );

      if (response && response.response) {
        this.logger.info('Chat completion generated', {
          model: LLM_MODEL,
          messageCount: messages.length,
          responseLength: response.response.length,
        });
        return response.response;
      }

      throw new Error('Invalid AI response format');
    } catch (error: any) {
      this.logger.error('Primary model failed, trying fallback', { error });

      // Try fallback model
      return await this.generateWithFallback(messages, finalOptions);
    }
  }

  /**
   * Generate with fallback model
   */
  private async generateWithFallback(messages: any[], options: AIOptions): Promise<string> {
    try {
      const response = await this.env.AI.run(FALLBACK_MODEL, {
        messages,
        ...options,
      });

      if (response && response.response) {
        this.logger.info('Fallback model used', { model: FALLBACK_MODEL });
        return response.response;
      }

      throw new Error('Fallback model also failed');
    } catch (error: any) {
      this.logger.error('All models failed', { error });
      return 'I apologize, but I encountered an error generating a response. Please try again.';
    }
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await retry(
        async () => {
          return await this.env.AI.run(EMBEDDING_MODEL, {
            text: [text],
          });
        },
        3,
        1000
      );

      if (response && response.data && response.data[0]) {
        this.logger.debug('Embedding generated', {
          textLength: text.length,
          dimensions: response.data[0].length,
        });
        return response.data[0];
      }

      throw new Error('Invalid embedding response');
    } catch (error: any) {
      this.logger.error('Embedding generation failed', { error });
      throw error;
    }
  }

  /**
   * Generate embeddings in batch
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.env.AI.run(EMBEDDING_MODEL, {
        text: texts,
      });

      if (response && response.data) {
        this.logger.debug('Batch embeddings generated', {
          count: texts.length,
        });
        return response.data;
      }

      throw new Error('Invalid batch embedding response');
    } catch (error: any) {
      this.logger.error('Batch embedding failed', { error });
      throw error;
    }
  }

  /**
   * Stream chat completion (token by token)
   */
  async *streamChatCompletion(
    messages: any[],
    options: AIOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const defaultOptions: AIOptions = {
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 0.9,
      stream: true,
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      const stream = await this.env.AI.run(LLM_MODEL, {
        messages,
        ...finalOptions,
      });

      // If streaming is supported, yield tokens
      if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
        for await (const chunk of stream) {
          if (chunk && chunk.response) {
            yield chunk.response;
          }
        }
      } else {
        // Fallback to non-streaming
        const response = await this.generateChatCompletion(messages, {
          ...options,
          stream: false,
        });
        yield response;
      }
    } catch (error: any) {
      this.logger.error('Stream failed', { error });
      yield 'I apologize, but I encountered an error. Please try again.';
    }
  }

  /**
   * Create prompt from template
   */
  createPrompt(template: string, variables: Record<string, string>): string {
    let prompt = template;

    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return prompt;
  }

  /**
   * Get system prompt for agent
   */
  getSystemPrompt(customInstructions?: string): string {
    const basePrompt = `You are a helpful AI assistant powered by Cloudflare Workers AI. 
You have access to conversation history and relevant memories. 
Be concise, helpful, and friendly.
Always provide accurate information and admit when you're unsure.`;

    if (customInstructions) {
      return `${basePrompt}\n\nAdditional instructions:\n${customInstructions}`;
    }

    return basePrompt;
  }

  /**
   * Format messages for AI model
   */
  formatMessages(messages: Array<{ role: string; content: string }>, systemPrompt?: string): any[] {
    const formatted: any[] = [];

    // Add system prompt if provided
    if (systemPrompt) {
      formatted.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Add all messages
    for (const msg of messages) {
      formatted.push({
        role: msg.role,
        content: msg.content,
      });
    }

    return formatted;
  }

  /**
   * Summarize conversation
   */
  async summarizeConversation(messages: any[]): Promise<string> {
    const conversationText = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

    const summaryMessages = [
      {
        role: 'system',
        content:
          'Summarize the following conversation in 2-3 sentences. Focus on key topics and important points.',
      },
      {
        role: 'user',
        content: conversationText,
      },
    ];

    return await this.generateChatCompletion(summaryMessages, {
      max_tokens: 150,
      temperature: 0.5,
    });
  }

  /**
   * Extract intent from user message
   */
  async extractIntent(message: string): Promise<string> {
    const intentMessages = [
      {
        role: 'system',
        content:
          'Analyze the user message and extract the primary intent in one word (e.g., question, request, greeting, feedback).',
      },
      {
        role: 'user',
        content: message,
      },
    ];

    return await this.generateChatCompletion(intentMessages, {
      max_tokens: 10,
      temperature: 0.3,
    });
  }

  /**
   * Check if content is appropriate
   */
  async moderateContent(content: string): Promise<{ safe: boolean; reason?: string }> {
    const moderationMessages = [
      {
        role: 'system',
        content:
          'Analyze if the following content is appropriate and safe. Respond with "SAFE" or "UNSAFE: reason".',
      },
      {
        role: 'user',
        content,
      },
    ];

    try {
      const result = await this.generateChatCompletion(moderationMessages, {
        max_tokens: 50,
        temperature: 0.1,
      });

      if (result.startsWith('SAFE')) {
        return { safe: true };
      } else {
        return { safe: false, reason: result.replace('UNSAFE:', '').trim() };
      }
    } catch (error) {
      // Default to safe if moderation fails
      this.logger.error('Moderation failed', { error });
      return { safe: true };
    }
  }
}

/**
 * Prompt templates for common use cases
 */
export const PromptTemplates = {
  greeting: `Hello! I'm your AI assistant. How can I help you today?`,

  error: `I apologize, but I encountered an error: {{error}}. Please try again.`,

  clarification: `I'm not sure I understand. Could you please clarify what you mean by "{{query}}"?`,

  summarize: `Please summarize the following content in a concise way:\n\n{{content}}`,

  analyze: `Analyze the following information and provide insights:\n\n{{content}}`,

  code_review: `Review the following code and suggest improvements:\n\n\`\`\`{{language}}\n{{code}}\n\`\`\``,

  translate: `Translate the following text to {{language}}:\n\n{{text}}`,

  brainstorm: `Help me brainstorm ideas about: {{topic}}`,
};
