/**
 * Main Worker entry point for AI Agent App
 */
import type { Env } from './types';
import { initializeTools, getToolRegistry } from './tools';
import { ToolContext } from './types/tools';
import { analyticsService } from './services/analytics';
import { collaborationService } from './services/collaboration';

// Initialize tools on worker startup
initializeTools();

/**
 * Main Worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check endpoint
      if (url.pathname === '/health') {
        return Response.json(
          {
            status: 'healthy',
            timestamp: Date.now(),
            environment: env.ENVIRONMENT,
          },
          { headers: corsHeaders }
        );
      }

      // API routes
      if (url.pathname.startsWith('/api/')) {
        return handleApiRequest(request, env, ctx, url);
      }

      // WebSocket upgrade for agent communication
      if (url.pathname.startsWith('/agent/') && request.headers.get('Upgrade') === 'websocket') {
        return handleWebSocketUpgrade(request, env, url);
      }

      // Default response
      return Response.json(
        {
          message: 'AI Agent App - Cloudflare Workers',
          version: '1.0.0',
          endpoints: {
            health: '/health',
            api: '/api/*',
            agent: '/agent/:id (WebSocket)',
          },
        },
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Error handling request:', error);
      return Response.json(
        {
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }
  },
};

/**
 * Handle API requests
 */
async function handleApiRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  url: URL
): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  // GET /api/config - Get configuration
  if (url.pathname === '/api/config' && request.method === 'GET') {
    return Response.json(
      {
        environment: env.ENVIRONMENT,
        logLevel: env.LOG_LEVEL,
        features: {
          ai: true,
          vectorize: true,
          r2: true,
          kv: true,
          workflows: true,
          websockets: true,
        },
        models: {
          llm: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          embedding: '@cf/baai/bge-base-en-v1.5',
        },
      },
      { headers: corsHeaders }
    );
  }

  // POST /api/agent/create - Create new agent instance
  if (url.pathname === '/api/agent/create' && request.method === 'POST') {
    try {
      const body = await request.json<{ userId?: string; name?: string }>();
      const agentId = crypto.randomUUID();

      // Create a new Durable Object instance
      const id = env.AI_AGENT.idFromName(agentId);
      const stub = env.AI_AGENT.get(id);

      // Initialize agent with HTTP request
      await stub.fetch(new Request(`http://internal/health`));

      return Response.json(
        {
          agentId,
          userId: body.userId || 'anonymous',
          name: body.name || 'AI Agent',
          message: 'Agent created successfully',
          websocketUrl: `/agent/${agentId}`,
          apiUrl: `/api/agent/${agentId}`,
          createdAt: Date.now(),
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to create agent',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // GET /api/agent/:id - Get agent information
  if (url.pathname.match(/^\/api\/agent\/[^/]+$/) && request.method === 'GET') {
    try {
      const agentId = url.pathname.split('/').pop()!;
      const id = env.AI_AGENT.idFromName(agentId);
      const stub = env.AI_AGENT.get(id);

      // Get agent health
      const response = await stub.fetch(new Request(`http://internal/health`));
      const data = await response.json();

      return Response.json(
        {
          agentId,
          ...data,
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to get agent info',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // POST /api/agent/:id/message - Send message to agent (HTTP API)
  if (url.pathname.match(/^\/api\/agent\/[^/]+\/message$/) && request.method === 'POST') {
    try {
      const agentId = url.pathname.split('/')[3];
      const body = await request.json<{ content: string; userId?: string }>();

      if (!body.content) {
        return Response.json(
          { error: 'Message content required' },
          { status: 400, headers: corsHeaders }
        );
      }

      const id = env.AI_AGENT.idFromName(agentId);
      const stub = env.AI_AGENT.get(id);

      // Send message to agent
      const response = await stub.fetch(
        new Request(`http://internal/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      );

      const data = await response.json();

      return Response.json(data, { headers: corsHeaders });
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to send message',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // GET /api/agent/:id/history - Get conversation history
  if (url.pathname.match(/^\/api\/agent\/[^/]+\/history$/) && request.method === 'GET') {
    try {
      const agentId = url.pathname.split('/')[3];
      const id = env.AI_AGENT.idFromName(agentId);
      const stub = env.AI_AGENT.get(id);

      const response = await stub.fetch(new Request(`http://internal/history`));
      const data = await response.json();

      return Response.json(data, { headers: corsHeaders });
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to get history',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // POST /api/agent/:id/clear - Clear conversation history
  if (url.pathname.match(/^\/api\/agent\/[^/]+\/clear$/) && request.method === 'POST') {
    try {
      const agentId = url.pathname.split('/')[3];
      const id = env.AI_AGENT.idFromName(agentId);
      const stub = env.AI_AGENT.get(id);

      const response = await stub.fetch(new Request(`http://internal/clear`, { method: 'POST' }));
      const data = await response.json();

      return Response.json(data, { headers: corsHeaders });
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to clear history',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // GET /api/agent/:id/context - Get user context
  if (url.pathname.match(/^\/api\/agent\/[^/]+\/context$/) && request.method === 'GET') {
    try {
      const agentId = url.pathname.split('/')[3];
      const id = env.AI_AGENT.idFromName(agentId);
      const stub = env.AI_AGENT.get(id);

      const response = await stub.fetch(new Request(`http://internal/context`));
      const data = await response.json();

      return Response.json(data, { headers: corsHeaders });
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to get context',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // POST /api/test/ai - Test AI integration
  if (url.pathname === '/api/test/ai' && request.method === 'POST') {
    try {
      const body = await request.json<{ prompt: string }>();

      if (!body.prompt) {
        return Response.json({ error: 'Prompt required' }, { status: 400, headers: corsHeaders });
      }

      // Test Workers AI
      const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          {
            role: 'user',
            content: body.prompt,
          },
        ],
        max_tokens: 256,
      });

      return Response.json(
        {
          prompt: body.prompt,
          response: response,
          timestamp: Date.now(),
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'AI test failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // POST /api/test/embedding - Test embedding generation
  if (url.pathname === '/api/test/embedding' && request.method === 'POST') {
    try {
      const body = await request.json<{ text: string }>();

      if (!body.text) {
        return Response.json({ error: 'Text required' }, { status: 400, headers: corsHeaders });
      }

      // Test embedding generation
      const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [body.text],
      });

      return Response.json(
        {
          text: body.text,
          embedding: response.data[0],
          dimensions: response.data[0].length,
          timestamp: Date.now(),
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Embedding test failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // GET /api/tools - List all available tools
  if (url.pathname === '/api/tools' && request.method === 'GET') {
    try {
      const registry = getToolRegistry();
      const tools = registry.getAll();

      return Response.json(
        {
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            category: tool.category,
            parameters: tool.parameters,
            rateLimit: tool.rateLimit,
            cost: tool.cost,
          })),
          count: tools.length,
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to list tools',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // POST /api/tools/execute - Execute a tool
  if (url.pathname === '/api/tools/execute' && request.method === 'POST') {
    try {
      const body = await request.json<{
        toolName: string;
        parameters: any;
        agentId: string;
        userId?: string;
      }>();

      if (!body.toolName || !body.parameters || !body.agentId) {
        return Response.json(
          { error: 'toolName, parameters, and agentId are required' },
          { status: 400, headers: corsHeaders }
        );
      }

      const registry = getToolRegistry();
      const context: ToolContext = {
        agentId: body.agentId,
        userId: body.userId,
        timestamp: Date.now(),
        env,
      };

      const result = await registry.execute(body.toolName, body.parameters, context);

      return Response.json(
        {
          tool: body.toolName,
          result,
          timestamp: Date.now(),
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Tool execution failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // GET /api/tools/stats - Get tool usage statistics
  if (url.pathname === '/api/tools/stats' && request.method === 'GET') {
    try {
      const registry = getToolRegistry();
      const stats = registry.getStatistics();

      return Response.json(
        {
          statistics: stats,
          timestamp: Date.now(),
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to get tool statistics',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // GET /api/tools/:name - Get tool details
  if (url.pathname.match(/^\/api\/tools\/[^/]+$/) && request.method === 'GET') {
    try {
      const toolName = url.pathname.split('/').pop()!;
      const registry = getToolRegistry();
      const tool = registry.get(toolName);

      if (!tool) {
        return Response.json(
          { error: `Tool '${toolName}' not found` },
          { status: 404, headers: corsHeaders }
        );
      }

      return Response.json(
        {
          name: tool.name,
          description: tool.description,
          category: tool.category,
          parameters: tool.parameters,
          rateLimit: tool.rateLimit,
          cost: tool.cost,
          requiresAuth: tool.requiresAuth,
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to get tool details',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // GET /api/analytics/dashboard - Get real-time dashboard data
  if (url.pathname === '/api/analytics/dashboard' && request.method === 'GET') {
    try {
      const dashboard = analyticsService.getDashboardData();

      return Response.json(
        {
          dashboard,
          timestamp: Date.now(),
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to get dashboard data',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // GET /api/analytics/stats - Get usage statistics
  if (url.pathname === '/api/analytics/stats' && request.method === 'GET') {
    try {
      const period = url.searchParams.get('period') || '24h';
      const now = Date.now();
      let startTime: number;

      switch (period) {
        case '1h':
          startTime = now - 60 * 60 * 1000;
          break;
        case '24h':
          startTime = now - 24 * 60 * 60 * 1000;
          break;
        case '7d':
          startTime = now - 7 * 24 * 60 * 60 * 1000;
          break;
        case '30d':
          startTime = now - 30 * 24 * 60 * 60 * 1000;
          break;
        default:
          startTime = now - 24 * 60 * 60 * 1000;
      }

      const stats = analyticsService.getUsageStats(startTime, now);

      return Response.json(
        {
          period,
          stats,
          timestamp: Date.now(),
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to get usage statistics',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // GET /api/analytics/events - Get analytics events
  if (url.pathname === '/api/analytics/events' && request.method === 'GET') {
    try {
      const type = url.searchParams.get('type');
      const agentId = url.searchParams.get('agentId');
      const userId = url.searchParams.get('userId');
      const limit = parseInt(url.searchParams.get('limit') || '100');

      let events;

      if (type) {
        events = analyticsService.getEventsByType(type as any, limit);
      } else if (agentId) {
        events = analyticsService.getEventsByAgent(agentId, limit);
      } else if (userId) {
        events = analyticsService.getEventsByUser(userId, limit);
      } else {
        events = analyticsService.export().events.slice(-limit);
      }

      return Response.json(
        {
          events,
          count: events.length,
          timestamp: Date.now(),
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to get analytics events',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // POST /api/share/create - Create a share link
  if (url.pathname === '/api/share/create' && request.method === 'POST') {
    try {
      const body = await request.json<{
        conversationId: string;
        agentId: string;
        userId: string;
        expiresInHours?: number;
        viewOnly?: boolean;
        isPublic?: boolean;
        password?: string;
        maxAccess?: number;
      }>();

      if (!body.conversationId || !body.agentId || !body.userId) {
        return Response.json(
          { error: 'conversationId, agentId, and userId are required' },
          { status: 400, headers: corsHeaders }
        );
      }

      const expiresAt = body.expiresInHours
        ? Date.now() + body.expiresInHours * 60 * 60 * 1000
        : undefined;

      const shareConfig = collaborationService.createShareLink({
        conversationId: body.conversationId,
        agentId: body.agentId,
        createdBy: body.userId,
        expiresAt,
        isPublic: body.isPublic ?? true,
        viewOnly: body.viewOnly ?? true,
        password: body.password,
        maxAccess: body.maxAccess,
      });

      return Response.json(
        {
          share: shareConfig,
          shareUrl: `${url.origin}/shared/${shareConfig.id}`,
          message: 'Share link created successfully',
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to create share link',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // GET /api/share/:id - Get share configuration
  if (url.pathname.match(/^\/api\/share\/[^/]+$/) && request.method === 'GET') {
    try {
      const shareId = url.pathname.split('/').pop()!;
      const config = collaborationService.getShareConfig(shareId);

      if (!config) {
        return Response.json(
          { error: 'Share link not found or expired' },
          { status: 404, headers: corsHeaders }
        );
      }

      // Don't expose password
      const sanitizedConfig = { ...config, password: config.password ? '***' : undefined };

      return Response.json(
        {
          share: sanitizedConfig,
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to get share configuration',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // POST /api/share/:id/access - Validate and log share access
  if (url.pathname.match(/^\/api\/share\/[^/]+\/access$/) && request.method === 'POST') {
    try {
      const shareId = url.pathname.split('/')[3] as string;
      const body = await request.json<{
        userId?: string;
        password?: string;
      }>();

      const validation = collaborationService.validateAccess(shareId, body.userId, body.password);

      if (!validation.valid) {
        return Response.json(
          {
            valid: false,
            reason: validation.reason,
          },
          { status: 403, headers: corsHeaders }
        );
      }

      // Log access
      const clientIP = request.headers.get('CF-Connecting-IP');
      const userAgent = request.headers.get('User-Agent');
      collaborationService.logAccess(
        shareId,
        body.userId,
        clientIP || undefined,
        userAgent || undefined
      );

      const config = collaborationService.getShareConfig(shareId);

      return Response.json(
        {
          valid: true,
          share: config,
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to validate share access',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // DELETE /api/share/:id - Delete a share link
  if (url.pathname.match(/^\/api\/share\/[^/]+$/) && request.method === 'DELETE') {
    try {
      const shareId = url.pathname.split('/').pop()!;
      const deleted = collaborationService.deleteShareLink(shareId);

      if (!deleted) {
        return Response.json(
          { error: 'Share link not found' },
          { status: 404, headers: corsHeaders }
        );
      }

      return Response.json(
        {
          message: 'Share link deleted successfully',
          shareId,
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to delete share link',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // GET /api/share/stats - Get sharing statistics
  if (url.pathname === '/api/share/stats' && request.method === 'GET') {
    try {
      const stats = collaborationService.getStatistics();

      return Response.json(
        {
          statistics: stats,
          timestamp: Date.now(),
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      return Response.json(
        {
          error: 'Failed to get sharing statistics',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  return Response.json(
    {
      error: 'Not Found',
      message: 'API endpoint not found',
      availableEndpoints: [
        'GET /api/config',
        'POST /api/agent/create',
        'GET /api/agent/:id',
        'POST /api/agent/:id/message',
        'GET /api/agent/:id/history',
        'POST /api/agent/:id/clear',
        'GET /api/agent/:id/context',
        'GET /api/tools',
        'POST /api/tools/execute',
        'GET /api/tools/stats',
        'GET /api/tools/:name',
        'GET /api/analytics/dashboard',
        'GET /api/analytics/stats',
        'GET /api/analytics/events',
        'POST /api/share/create',
        'GET /api/share/:id',
        'POST /api/share/:id/access',
        'DELETE /api/share/:id',
        'GET /api/share/stats',
        'POST /api/test/ai',
        'POST /api/test/embedding',
      ],
    },
    { status: 404, headers: corsHeaders }
  );
}

/**
 * Handle WebSocket upgrade for agent communication
 */
function handleWebSocketUpgrade(request: Request, env: Env, url: URL): Response {
  // Extract agent ID from URL
  const agentId = url.pathname.split('/').pop();

  if (!agentId) {
    return new Response('Agent ID required', { status: 400 });
  }

  try {
    // Get Durable Object instance
    const id = env.AI_AGENT.idFromName(agentId);
    const stub = env.AI_AGENT.get(id);

    // Forward WebSocket upgrade to Durable Object
    return stub.fetch(request);
  } catch (error) {
    console.error('Error upgrading WebSocket:', error);
    return new Response('Failed to connect to agent', { status: 500 });
  }
}

/**
 * Export Durable Object class (will be implemented in Phase 2)
 */
export { AIAgent } from './agents/AIAgent';
