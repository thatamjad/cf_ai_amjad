/**
 * AI Agent Durable Object - Phase 2 Complete Implementation
 *
 * This Durable Object manages stateful AI agent interactions with:
 * - Persistent conversation history via SQL
 * - Workers AI integration (Llama 3.3)
 * - Vectorize for semantic memory
 * - Real-time WebSocket communication
 * - Workflow orchestration
 * - Context management
 */
import type { Env, AgentState, Message, Memory } from '../types';
import { Logger } from '../utils/logger';
import { generateId, estimateTokenCount, retry, sanitizeInput } from '../utils/helpers';

const MAX_CONTEXT_TOKENS = 4096;
const MAX_HISTORY_MESSAGES = 50;
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const LLM_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export class AIAgent {
  private state: AgentState;
  private env: Env;
  private storage: any;
  private sql: any;
  private logger: Logger;
  private activeConnections: Map<string, any>;

  constructor(state: any, env: Env) {
    this.storage = state.storage;
    this.sql = state.storage.sql;
    this.env = env;
    this.logger = new Logger('AIAgent');
    this.activeConnections = new Map();

    this.state = {
      conversationHistory: [],
      userContext: { userId: '' },
      activeWorkflows: [],
      lastActivity: Date.now(),
    };

    // Initialize database and state on construction
    this.initializeAgent();
  }

  /**
   * Initialize agent state and SQL database
   */
  private async initializeAgent(): Promise<void> {
    try {
      // Create SQL tables if they don't exist
      await this.initializeDatabase();

      // Load state from Durable Object storage
      const savedState = await this.storage.get('state');
      if (savedState) {
        this.state = savedState as AgentState;
        this.logger.info('Loaded agent state from storage', {
          userId: this.state.userContext.userId,
        });
      }

      // Load conversation history from SQL
      await this.loadConversationHistory();

      this.logger.info('Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize agent', { error });
      throw error;
    }
  }

  /**
   * Create SQL database schema
   */
  private async initializeDatabase(): Promise<void> {
    // Conversation messages table
    await this.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      )
    `);

    // User context table
    await this.sql.exec(`
      CREATE TABLE IF NOT EXISTS user_context (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Workflows table
    await this.sql.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        params TEXT,
        result TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      )
    `);

    // Create indexes
    await this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`);
    await this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status)`);

    this.logger.info('Database initialized');
  }

  /**
   * Load conversation history from SQL
   */
  private async loadConversationHistory(): Promise<void> {
    const results = await this.sql.exec(`
      SELECT id, role, content, timestamp, metadata
      FROM messages
      ORDER BY timestamp DESC
      LIMIT ${MAX_HISTORY_MESSAGES}
    `);

    this.state.conversationHistory = results
      .toArray()
      .reverse()
      .map((row: any) => ({
        id: row.id,
        role: row.role as 'user' | 'assistant' | 'system',
        content: row.content,
        timestamp: row.timestamp,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));

    this.logger.debug('Loaded conversation history', {
      count: this.state.conversationHistory.length,
    });
  }

  /**
   * Save message to SQL database
   */
  private async saveMessage(message: Message): Promise<void> {
    await this.sql.exec(
      `INSERT INTO messages (id, role, content, timestamp, metadata) VALUES (?, ?, ?, ?, ?)`,
      message.id,
      message.role,
      message.content,
      message.timestamp,
      message.metadata ? JSON.stringify(message.metadata) : null
    );
  }

  /**
   * Save agent state to storage
   */
  private async saveState(): Promise<void> {
    this.state.lastActivity = Date.now();
    await this.storage.put('state', this.state);
  }

  /**
   * Handle HTTP requests to the Durable Object
   */
  async fetch(request: any): Promise<any> {
    const url = new URL(request.url);

    try {
      // Handle WebSocket upgrade
      if (request.headers.get('Upgrade') === 'websocket') {
        return this.handleWebSocket(request);
      }

      // Health check
      if (url.pathname.endsWith('/health')) {
        return Response.json({
          status: 'healthy',
          agentId: this.storage.id?.toString(),
          lastActivity: this.state.lastActivity,
          messageCount: this.state.conversationHistory.length,
          activeWorkflows: this.state.activeWorkflows.length,
        });
      }

      // Get conversation history
      if (url.pathname.endsWith('/history')) {
        return Response.json({
          history: this.state.conversationHistory,
          totalMessages: this.state.conversationHistory.length,
        });
      }

      // Send message (HTTP API)
      if (url.pathname.endsWith('/message') && request.method === 'POST') {
        const body = await request.json();
        const response = await this.processMessage(body.content, body.userId);
        return Response.json(response);
      }

      // Get user context
      if (url.pathname.endsWith('/context')) {
        return Response.json({ context: this.state.userContext });
      }

      // Clear history
      if (url.pathname.endsWith('/clear') && request.method === 'POST') {
        await this.clearHistory();
        return Response.json({ message: 'History cleared' });
      }

      return Response.json({ message: 'AI Agent Durable Object - Phase 2' });
    } catch (error: any) {
      this.logger.error('Error handling request', { error, path: url.pathname });
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  /**
   * Handle WebSocket connections for real-time communication
   */
  private handleWebSocket(_request: any): any {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const connectionId = generateId();

    // Accept the WebSocket connection
    (server as any).accept();
    this.activeConnections.set(connectionId, server);

    // Send welcome message
    this.sendWebSocketMessage(server, {
      type: 'connected',
      message: 'Connected to AI Agent',
      agentId: this.storage.id?.toString(),
      connectionId,
      timestamp: Date.now(),
    });

    this.logger.info('WebSocket connection established', { connectionId });

    // Handle incoming messages
    (server as any).addEventListener('message', async (event: any) => {
      try {
        const data = JSON.parse(event.data);
        await this.handleWebSocketMessage(server, data, connectionId);
      } catch (error: any) {
        this.logger.error('Error handling WebSocket message', { error, connectionId });
        this.sendWebSocketMessage(server, {
          type: 'error',
          message: error.message,
          timestamp: Date.now(),
        });
      }
    });

    // Handle connection close
    (server as any).addEventListener('close', () => {
      this.activeConnections.delete(connectionId);
      this.logger.info('WebSocket connection closed', { connectionId });
    });

    // Handle errors
    (server as any).addEventListener('error', (error: any) => {
      this.logger.error('WebSocket error', { error, connectionId });
      this.activeConnections.delete(connectionId);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as any);
  }

  /**
   * Handle WebSocket messages
   */
  private async handleWebSocketMessage(ws: any, data: any, connectionId: string): Promise<void> {
    this.logger.debug('Received WebSocket message', { type: data.type, connectionId });

    switch (data.type) {
      case 'message':
        await this.handleChatMessage(ws, data.content, data.userId);
        break;

      case 'ping':
        this.sendWebSocketMessage(ws, { type: 'pong', timestamp: Date.now() });
        break;

      case 'get_history':
        this.sendWebSocketMessage(ws, {
          type: 'history',
          history: this.state.conversationHistory,
          timestamp: Date.now(),
        });
        break;

      case 'clear_history':
        await this.clearHistory();
        this.sendWebSocketMessage(ws, {
          type: 'history_cleared',
          message: 'Conversation history cleared',
          timestamp: Date.now(),
        });
        break;

      default:
        this.logger.warn('Unknown message type', { type: data.type });
    }
  }

  /**
   * Handle chat messages from WebSocket
   */
  private async handleChatMessage(ws: any, content: string, userId?: string): Promise<void> {
    // Send typing indicator
    this.sendWebSocketMessage(ws, { type: 'typing', timestamp: Date.now() });

    try {
      // Process the message and get response
      const response = await this.processMessage(content, userId);

      // Stream the response token by token
      await this.streamResponse(ws, response.content);

      // Send completion message
      this.sendWebSocketMessage(ws, {
        type: 'message_complete',
        messageId: response.id,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      this.logger.error('Error processing chat message', { error });
      this.sendWebSocketMessage(ws, {
        type: 'error',
        message: 'Failed to process message',
        error: error.message,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Stream response to WebSocket token by token
   */
  private async streamResponse(ws: any, content: string): Promise<void> {
    const words = content.split(' ');

    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? ' ' : '');

      this.sendWebSocketMessage(ws, {
        type: 'token',
        content: word,
        timestamp: Date.now(),
      });

      // Small delay to simulate streaming (remove in production for real streaming)
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * Send message through WebSocket
   */
  private sendWebSocketMessage(ws: any, message: any): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error('Error sending WebSocket message', { error });
    }
  }

  /**
   * Process incoming message and generate AI response
   */
  async processMessage(content: string, userId?: string): Promise<Message> {
    const startTime = Date.now();

    // Sanitize input
    const sanitizedContent = sanitizeInput(content);

    // Update user context
    if (userId) {
      this.state.userContext.userId = userId;
    }

    // Create user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: sanitizedContent,
      timestamp: Date.now(),
    };

    // Add to history and save
    this.state.conversationHistory.push(userMessage);
    await this.saveMessage(userMessage);

    // Store message in vector database for semantic memory
    await this.storeInMemory(sanitizedContent, 'conversation', {
      messageId: userMessage.id,
      userId: userId || 'anonymous',
      role: 'user',
    });

    // Get relevant memories
    const relevantMemories = await this.searchMemory(sanitizedContent);

    // Build context for LLM
    const context = await this.buildContext(sanitizedContent, relevantMemories);

    // Generate AI response
    const aiResponse = await this.generateAIResponse(context);

    // Create assistant message
    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: aiResponse,
      timestamp: Date.now(),
      metadata: {
        responseTime: Date.now() - startTime,
        model: LLM_MODEL,
        tokensUsed: estimateTokenCount(aiResponse),
      },
    };

    // Add to history and save
    this.state.conversationHistory.push(assistantMessage);
    await this.saveMessage(assistantMessage);

    // Store assistant response in memory
    await this.storeInMemory(aiResponse, 'conversation', {
      messageId: assistantMessage.id,
      userId: userId || 'anonymous',
      role: 'assistant',
    });

    // Save state
    await this.saveState();

    // Trim history if too long
    await this.trimHistory();

    this.logger.info('Message processed', {
      userId,
      responseTime: Date.now() - startTime,
      messageLength: sanitizedContent.length,
    });

    return assistantMessage;
  }

  /**
   * Build context for LLM including history and memories
   */
  private async buildContext(_currentMessage: string, memories: Memory[]): Promise<any[]> {
    const messages: any[] = [];

    // System prompt
    messages.push({
      role: 'system',
      content: `You are a helpful AI assistant powered by Cloudflare Workers AI. You have access to conversation history and relevant memories. Be concise, helpful, and friendly.`,
    });

    // Add relevant memories as context
    if (memories.length > 0) {
      const memoryContext = memories.map((m) => `- ${m.content}`).join('\n');

      messages.push({
        role: 'system',
        content: `Relevant context from past conversations:\n${memoryContext}`,
      });
    }

    // Add recent conversation history (with token limit)
    let tokenCount = estimateTokenCount(messages.map((m) => m.content).join(' '));
    const recentHistory = [...this.state.conversationHistory].reverse();

    for (const msg of recentHistory) {
      const msgTokens = estimateTokenCount(msg.content);

      if (tokenCount + msgTokens > MAX_CONTEXT_TOKENS) {
        break;
      }

      messages.unshift({
        role: msg.role,
        content: msg.content,
      });

      tokenCount += msgTokens;
    }

    return messages;
  }

  /**
   * Generate AI response using Workers AI
   */
  private async generateAIResponse(messages: any[]): Promise<string> {
    try {
      const response = await retry(
        async () => {
          return await this.env.AI.run(LLM_MODEL, {
            messages,
            max_tokens: 1024,
            temperature: 0.7,
            top_p: 0.9,
          });
        },
        3,
        1000
      );

      if (response && response.response) {
        return response.response;
      }

      throw new Error('Invalid AI response format');
    } catch (error: any) {
      this.logger.error('AI generation failed', { error });
      return 'I apologize, but I encountered an error generating a response. Please try again.';
    }
  }

  /**
   * Store content in Vectorize for semantic memory
   */
  private async storeInMemory(content: string, type: string, metadata: any): Promise<void> {
    try {
      // Generate embedding
      const embedding = await this.generateEmbedding(content);

      // Store in Vectorize
      await this.env.VECTORIZE.upsert([
        {
          id: generateId(),
          values: embedding,
          metadata: {
            content,
            type,
            timestamp: Date.now(),
            ...metadata,
          },
        },
      ]);

      this.logger.debug('Stored in memory', { type, contentLength: content.length });
    } catch (error) {
      this.logger.error('Failed to store in memory', { error });
      // Don't throw - memory storage is not critical
    }
  }

  /**
   * Search semantic memory
   */
  private async searchMemory(query: string, topK: number = 5): Promise<Memory[]> {
    try {
      // Generate embedding for query
      const embedding = await this.generateEmbedding(query);

      // Search Vectorize
      const results = await this.env.VECTORIZE.query(embedding, {
        topK,
        returnMetadata: true,
      });

      return results.matches.map((match: any) => ({
        id: match.id,
        type: match.metadata.type,
        content: match.metadata.content,
        embedding: match.values,
        metadata: {
          timestamp: match.metadata.timestamp,
          userId: match.metadata.userId,
          importance: match.score,
          tags: [],
        },
      }));
    } catch (error) {
      this.logger.error('Memory search failed', { error });
      return [];
    }
  }

  /**
   * Generate embedding using Workers AI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.env.AI.run(EMBEDDING_MODEL, {
        text: [text],
      });

      if (response && response.data && response.data[0]) {
        return response.data[0];
      }

      throw new Error('Invalid embedding response');
    } catch (error) {
      this.logger.error('Embedding generation failed', { error });
      throw error;
    }
  }

  /**
   * Trim conversation history if it exceeds max length
   */
  private async trimHistory(): Promise<void> {
    if (this.state.conversationHistory.length > MAX_HISTORY_MESSAGES) {
      // Keep only recent messages in memory
      this.state.conversationHistory = this.state.conversationHistory.slice(-MAX_HISTORY_MESSAGES);

      // Note: We keep all messages in SQL, only trim in-memory state
      this.logger.debug('Trimmed conversation history', {
        count: this.state.conversationHistory.length,
      });
    }
  }

  /**
   * Clear conversation history
   */
  private async clearHistory(): Promise<void> {
    // Clear SQL
    await this.sql.exec(`DELETE FROM messages`);

    // Clear in-memory state
    this.state.conversationHistory = [];

    await this.saveState();

    this.logger.info('Conversation history cleared');
  }

  /**
   * Trigger a workflow
   */
  async triggerWorkflow(name: string, params: any): Promise<string> {
    const workflowId = generateId();

    // Store workflow record
    await this.sql.exec(
      `INSERT INTO workflows (id, name, status, params, created_at) VALUES (?, ?, ?, ?, ?)`,
      workflowId,
      name,
      'pending',
      JSON.stringify(params),
      Date.now()
    );

    this.state.activeWorkflows.push({ id: workflowId, name, status: 'pending' });
    await this.saveState();

    this.logger.info('Workflow triggered', { workflowId, name });

    return workflowId;
  }

  /**
   * Update workflow status
   */
  async updateWorkflowStatus(workflowId: string, status: string, result?: any): Promise<void> {
    await this.sql.exec(
      `UPDATE workflows SET status = ?, result = ?, completed_at = ? WHERE id = ?`,
      status,
      result ? JSON.stringify(result) : null,
      Date.now(),
      workflowId
    );

    // Update in-memory state
    const workflow = this.state.activeWorkflows.find((w) => w.id === workflowId);
    if (workflow) {
      workflow.status = status as 'pending' | 'running' | 'completed' | 'failed';
    }

    await this.saveState();

    this.logger.info('Workflow status updated', { workflowId, status });
  }
}
