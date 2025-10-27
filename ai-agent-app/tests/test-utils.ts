/**
 * Test Utilities and Mock Factories for Cloudflare Workers Testing
 * 
 * Provides mock implementations for:
 * - Workers AI
 * - Durable Objects
 * - R2 Storage
 * - Vectorize
 * - KV Storage
 * - WebSockets
 */

import { vi, expect } from 'vitest';

// Type definitions for Cloudflare Workers
interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
  name?: string;
}

interface Env {
  AI: any;
  VECTORIZE: any;
  FILES: any;
  CONFIG: any;
  AI_AGENT: any;
  [key: string]: any;
}

/**
 * Mock Cloudflare Workers AI
 */
export class MockAI {
  private responses: Map<string, any> = new Map();

  constructor() {
    // Default mock responses
    this.responses.set('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      response: 'This is a mock AI response for testing.',
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    });

    this.responses.set('@cf/baai/bge-base-en-v1.5', {
      data: [[0.1, 0.2, 0.3, 0.4, 0.5]] // Mock embedding
    });

    this.responses.set('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    });

    this.responses.set('@cf/llava-hf/llava-1.5-7b-hf', {
      description: 'Mock image analysis result'
    });
  }

  setResponse(model: string, response: any) {
    this.responses.set(model, response);
  }

  async run(model: string, options: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate latency
    
    const response = this.responses.get(model);
    if (!response) {
      throw new Error(`Mock AI: Model ${model} not configured`);
    }

    // Handle streaming
    if (options.stream) {
      return {
        async *[Symbol.asyncIterator]() {
          const text = typeof response === 'string' ? response : response.response;
          for (const char of text) {
            yield { response: char };
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
      };
    }

    return response;
  }
}

/**
 * Mock Durable Object State
 */
export class MockDurableObjectState {
  private storage: Map<string, any> = new Map();
  public id: DurableObjectId;
  private blockConcurrencyWhile: any;

  constructor(id: string = 'test-do-id') {
    this.id = {
      toString: () => id,
      equals: (other: DurableObjectId) => other.toString() === id,
      name: id
    } as DurableObjectId;

    this.blockConcurrencyWhile = vi.fn(async (callback: () => Promise<void>) => {
      await callback();
    });
  }

  async get(key: string): Promise<any> {
    return this.storage.get(key);
  }

  async put(key: string, value: any): Promise<void> {
    this.storage.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }

  async list(options?: any): Promise<Map<string, any>> {
    if (!options) return new Map(this.storage);
    
    const result = new Map();
    for (const [key, value] of this.storage) {
      if (options.prefix && !key.startsWith(options.prefix)) continue;
      result.set(key, value);
    }
    return result;
  }

  async deleteAll(): Promise<void> {
    this.storage.clear();
  }

  async transaction(closure: (txn: any) => Promise<void>): Promise<void> {
    await closure({
      get: this.get.bind(this),
      put: this.put.bind(this),
      delete: this.delete.bind(this),
      list: this.list.bind(this),
      deleteAll: this.deleteAll.bind(this)
    });
  }

  getAlarm(): Promise<number | null> {
    return Promise.resolve(null);
  }

  setAlarm(scheduledTime: number | Date): Promise<void> {
    return Promise.resolve();
  }

  deleteAlarm(): Promise<void> {
    return Promise.resolve();
  }

  waitUntil(promise: Promise<any>): void {
    // No-op for testing
  }
}

/**
 * Mock R2 Bucket
 */
export class MockR2Bucket {
  private objects: Map<string, any> = new Map();

  async get(key: string): Promise<any> {
    const obj = this.objects.get(key);
    if (!obj) return null;

    return {
      key,
      version: 'test-version',
      size: obj.body.length,
      etag: 'test-etag',
      httpMetadata: obj.httpMetadata || {},
      customMetadata: obj.customMetadata || {},
      uploaded: new Date(),
      body: obj.body,
      bodyUsed: false,
      arrayBuffer: async () => obj.body,
      text: async () => new TextDecoder().decode(obj.body),
      json: async () => JSON.parse(new TextDecoder().decode(obj.body)),
      blob: async () => new Blob([obj.body])
    };
  }

  async put(key: string, value: ArrayBuffer | ReadableStream, options?: any): Promise<any> {
    let body: ArrayBuffer;
    
    if (value instanceof ReadableStream) {
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(chunk);
      }
      const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      body = combined.buffer;
    } else {
      body = value;
    }

    this.objects.set(key, {
      body,
      httpMetadata: options?.httpMetadata || {},
      customMetadata: options?.customMetadata || {}
    });

    return { key, etag: 'test-etag', version: 'test-version' };
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async list(options?: any): Promise<any> {
    const keys = Array.from(this.objects.keys());
    const filtered = options?.prefix 
      ? keys.filter(k => k.startsWith(options.prefix))
      : keys;

    return {
      objects: filtered.slice(0, options?.limit || 1000).map(key => ({
        key,
        version: 'test-version',
        size: this.objects.get(key).body.length,
        etag: 'test-etag',
        uploaded: new Date(),
        httpMetadata: this.objects.get(key).httpMetadata,
        customMetadata: this.objects.get(key).customMetadata
      })),
      truncated: false,
      cursor: undefined,
      delimitedPrefixes: []
    };
  }

  async head(key: string): Promise<any> {
    const obj = this.objects.get(key);
    if (!obj) return null;

    return {
      key,
      version: 'test-version',
      size: obj.body.length,
      etag: 'test-etag',
      httpMetadata: obj.httpMetadata,
      customMetadata: obj.customMetadata,
      uploaded: new Date()
    };
  }
}

/**
 * Mock Vectorize Index
 */
export class MockVectorize {
  private vectors: Array<{ id: string; values: number[]; metadata?: any }> = [];

  async insert(vectors: Array<{ id: string; values: number[]; metadata?: any }>): Promise<any> {
    this.vectors.push(...vectors);
    return { count: vectors.length, ids: vectors.map(v => v.id) };
  }

  async query(vector: number[], options?: any): Promise<any> {
    const topK = options?.topK || 5;
    
    // Simple cosine similarity calculation
    const results = this.vectors.map(v => ({
      id: v.id,
      score: this.cosineSimilarity(vector, v.values),
      metadata: v.metadata,
      values: v.values
    }));

    results.sort((a, b) => b.score - a.score);
    
    return {
      matches: results.slice(0, topK),
      count: results.length
    };
  }

  async getByIds(ids: string[]): Promise<any> {
    const results = this.vectors.filter(v => ids.includes(v.id));
    return results;
  }

  async deleteByIds(ids: string[]): Promise<any> {
    const before = this.vectors.length;
    this.vectors = this.vectors.filter(v => !ids.includes(v.id));
    return { deletedCount: before - this.vectors.length };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

/**
 * Mock KV Namespace
 */
export class MockKVNamespace {
  private storage: Map<string, { value: any; metadata?: any; expiration?: number }> = new Map();

  async get(key: string, options?: any): Promise<any> {
    const item = this.storage.get(key);
    if (!item) return null;

    // Check expiration
    if (item.expiration && Date.now() > item.expiration * 1000) {
      this.storage.delete(key);
      return null;
    }

    if (options?.type === 'json') {
      return JSON.parse(item.value);
    }
    if (options?.type === 'arrayBuffer') {
      return new TextEncoder().encode(item.value).buffer;
    }
    if (options?.type === 'stream') {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(item.value));
          controller.close();
        }
      });
    }

    return item.value;
  }

  async getWithMetadata(key: string, options?: any): Promise<any> {
    const item = this.storage.get(key);
    if (!item) return { value: null, metadata: null };

    const value = await this.get(key, options);
    return { value, metadata: item.metadata };
  }

  async put(key: string, value: any, options?: any): Promise<void> {
    const item: any = { value: typeof value === 'string' ? value : JSON.stringify(value) };
    
    if (options?.metadata) item.metadata = options.metadata;
    if (options?.expiration) item.expiration = options.expiration;
    if (options?.expirationTtl) item.expiration = Math.floor(Date.now() / 1000) + options.expirationTtl;

    this.storage.set(key, item);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async list(options?: any): Promise<any> {
    const keys = Array.from(this.storage.keys());
    const filtered = options?.prefix 
      ? keys.filter(k => k.startsWith(options.prefix))
      : keys;

    return {
      keys: filtered.slice(0, options?.limit || 1000).map(key => ({
        name: key,
        expiration: this.storage.get(key)?.expiration,
        metadata: this.storage.get(key)?.metadata
      })),
      list_complete: true,
      cursor: undefined
    };
  }
}

/**
 * Mock WebSocket
 */
export class MockWebSocket {
  public readyState: number = 1; // OPEN
  public onmessage: ((event: any) => void) | null = null;
  public onclose: ((event: any) => void) | null = null;
  public onerror: ((event: any) => void) | null = null;
  public onopen: ((event: any) => void) | null = null;
  private sentMessages: any[] = [];

  send(data: any): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }

  accept(): void {
    this.readyState = 1; // OPEN
    if (this.onopen) {
      this.onopen({});
    }
  }

  simulateMessage(data: any): void {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }

  simulateError(error: any): void {
    if (this.onerror) {
      this.onerror(error);
    }
  }

  getSentMessages(): any[] {
    return this.sentMessages;
  }

  clearSentMessages(): void {
    this.sentMessages = [];
  }
}

/**
 * Create Mock Environment
 */
export function createMockEnv(overrides?: Partial<Env>): Env {
  return {
    AI: new MockAI() as any,
    VECTORIZE: new MockVectorize() as any,
    FILES: new MockR2Bucket() as any,
    CONFIG: new MockKVNamespace() as any,
    AI_AGENT: {} as any, // Durable Object namespace
    ...overrides
  } as Env;
}

/**
 * Create Mock Request
 */
export function createMockRequest(
  url: string,
  options?: RequestInit & { headers?: Record<string, string> }
): Request {
  const headers = new Headers(options?.headers || {});
  return new Request(url, {
    ...options,
    headers
  });
}

/**
 * Create Mock Response Helpers
 */
export function expectJsonResponse(response: Response, expectedStatus: number = 200) {
  expect(response.status).toBe(expectedStatus);
  expect(response.headers.get('content-type')).toContain('application/json');
}

export async function getJsonResponse(response: Response): Promise<any> {
  return await response.json();
}

/**
 * Time utilities for testing
 */
export function advanceTime(ms: number): void {
  vi.advanceTimersByTime(ms);
}

export function setSystemTime(date: Date | number): void {
  vi.setSystemTime(date);
}

/**
 * Wait for async operations
 */
export async function waitFor(condition: () => boolean, timeout: number = 5000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/**
 * Mock factory for creating test data
 */
export const TestDataFactory = {
  createMessage: (overrides?: Partial<any>) => ({
    role: 'user',
    content: 'Test message',
    timestamp: Date.now(),
    id: `msg_${Math.random().toString(36).substr(2, 9)}`,
    ...overrides
  }),

  createAgent: (overrides?: Partial<any>) => ({
    id: `agent_${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Agent',
    config: {},
    createdAt: Date.now(),
    ...overrides
  }),

  createToolCall: (overrides?: Partial<any>) => ({
    id: `call_${Math.random().toString(36).substr(2, 9)}`,
    type: 'function',
    function: {
      name: 'calculator',
      arguments: JSON.stringify({ expression: '2 + 2' })
    },
    ...overrides
  }),

  createShareConfig: (overrides?: Partial<any>) => ({
    id: `share_${Math.random().toString(36).substr(2, 9)}`,
    conversationId: 'conv_test',
    agentId: 'agent_test',
    userId: 'user_test',
    expiresAt: Date.now() + 86400000, // 24 hours
    viewOnly: true,
    isPublic: true,
    createdAt: Date.now(),
    accessCount: 0,
    ...overrides
  })
};

export default {
  MockAI,
  MockDurableObjectState,
  MockR2Bucket,
  MockVectorize,
  MockKVNamespace,
  MockWebSocket,
  createMockEnv,
  createMockRequest,
  expectJsonResponse,
  getJsonResponse,
  advanceTime,
  setSystemTime,
  waitFor,
  TestDataFactory
};
