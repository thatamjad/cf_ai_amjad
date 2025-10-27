import type {
  AgentConfig,
  AgentMetadata,
  Message,
  ConversationHistory,
  ContextInfo,
  CreateAgentResponse,
  SendMessageResponse,
  ApiResponse,
  AgentError,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred');
    }
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health');
  }

  // Agent Management
  async createAgent(config: AgentConfig): Promise<CreateAgentResponse> {
    return this.request<CreateAgentResponse>('/api/agent/create', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async getAgent(agentId: string): Promise<AgentMetadata> {
    return this.request<AgentMetadata>(`/api/agent/${agentId}`);
  }

  // Messaging
  async sendMessage(
    agentId: string,
    message: string
  ): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>(`/api/agent/${agentId}/message`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getHistory(
    agentId: string,
    limit: number = 50,
    before?: string
  ): Promise<ConversationHistory> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(before && { before }),
    });
    return this.request<ConversationHistory>(
      `/api/agent/${agentId}/history?${params}`
    );
  }

  async clearHistory(agentId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/api/agent/${agentId}/clear`,
      {
        method: 'POST',
      }
    );
  }

  // Context Management
  async getContext(agentId: string): Promise<ContextInfo> {
    return this.request<ContextInfo>(`/api/agent/${agentId}/context`);
  }

  // WebSocket Connection
  getWebSocketUrl(agentId: string): string {
    const wsProtocol = this.baseUrl.startsWith('https') ? 'wss' : 'ws';
    const baseWsUrl = this.baseUrl
      .replace('https://', '')
      .replace('http://', '');
    return `${wsProtocol}://${baseWsUrl}/agent/${agentId}`;
  }

  // Testing endpoints (for development)
  async testAI(prompt: string): Promise<{ response: string }> {
    return this.request<{ response: string }>('/api/test/ai', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  async testEmbedding(text: string): Promise<{ embedding: number[] }> {
    return this.request<{ embedding: number[] }>('/api/test/embedding', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  // ============================================
  // PHASE 4: Tools API
  // ============================================

  /**
   * Get all available tools
   */
  async getTools(): Promise<{ tools: any[]; count: number }> {
    return this.request('/api/tools');
  }

  /**
   * Get a specific tool by name
   */
  async getTool(toolName: string): Promise<any> {
    return this.request(`/api/tools/${toolName}`);
  }

  /**
   * Execute a tool
   */
  async executeTool(
    toolName: string,
    parameters: any,
    agentId: string,
    userId?: string
  ): Promise<{ tool: string; result: any; timestamp: number }> {
    return this.request('/api/tools/execute', {
      method: 'POST',
      body: JSON.stringify({ toolName, parameters, agentId, userId }),
    });
  }

  /**
   * Get tool usage statistics
   */
  async getToolStats(): Promise<{ statistics: any; timestamp: number }> {
    return this.request('/api/tools/stats');
  }

  // ============================================
  // PHASE 4: Analytics API
  // ============================================

  /**
   * Get real-time dashboard data
   */
  async getAnalyticsDashboard(): Promise<{ dashboard: any; timestamp: number }> {
    return this.request('/api/analytics/dashboard');
  }

  /**
   * Get usage statistics for a time period
   */
  async getAnalyticsStats(
    period: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{ period: string; stats: any; timestamp: number }> {
    return this.request(`/api/analytics/stats?period=${period}`);
  }

  /**
   * Get analytics events
   */
  async getAnalyticsEvents(filters?: {
    type?: string;
    agentId?: string;
    userId?: string;
    limit?: number;
  }): Promise<{ events: any[]; count: number; timestamp: number }> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.agentId) params.append('agentId', filters.agentId);
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    return this.request(`/api/analytics/events?${params}`);
  }

  // ============================================
  // PHASE 4: Collaboration/Sharing API
  // ============================================

  /**
   * Create a share link for a conversation
   */
  async createShareLink(config: {
    conversationId: string;
    agentId: string;
    userId: string;
    expiresInHours?: number;
    viewOnly?: boolean;
    isPublic?: boolean;
    password?: string;
    maxAccess?: number;
  }): Promise<{ share: any; shareUrl: string; message: string }> {
    return this.request('/api/share/create', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  /**
   * Get share configuration
   */
  async getShareConfig(shareId: string): Promise<{ share: any }> {
    return this.request(`/api/share/${shareId}`);
  }

  /**
   * Validate and access a shared conversation
   */
  async accessSharedConversation(
    shareId: string,
    userId?: string,
    password?: string
  ): Promise<{ valid: boolean; share?: any; reason?: string }> {
    return this.request(`/api/share/${shareId}/access`, {
      method: 'POST',
      body: JSON.stringify({ userId, password }),
    });
  }

  /**
   * Delete a share link
   */
  async deleteShareLink(shareId: string): Promise<{ message: string; shareId: string }> {
    return this.request(`/api/share/${shareId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get sharing statistics
   */
  async getShareStats(): Promise<{ statistics: any; timestamp: number }> {
    return this.request('/api/share/stats');
  }

  // ============================================
  // PHASE 4: Image API
  // ============================================

  /**
   * Upload an image
   */
  async uploadImage(
    file: File,
    agentId: string
  ): Promise<{ success: boolean; url?: string; key?: string; error?: string }> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('agentId', agentId);

    try {
      const response = await fetch(`${this.baseUrl}/api/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `Upload failed: ${response.status}`,
        };
      }

      const data = await response.json();
      return { success: true, ...data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Generate an image using AI
   */
  async generateImage(
    prompt: string,
    agentId: string,
    options?: {
      negative_prompt?: string;
      num_steps?: number;
    }
  ): Promise<{ tool: string; result: any; timestamp: number }> {
    return this.executeTool(
      'generate_image',
      {
        prompt,
        negative_prompt: options?.negative_prompt,
        num_steps: options?.num_steps,
      },
      agentId
    );
  }

  /**
   * Analyze an image using AI
   */
  async analyzeImage(
    imageUrl: string,
    agentId: string,
    prompt?: string
  ): Promise<{ tool: string; result: any; timestamp: number }> {
    return this.executeTool(
      'analyze_image',
      {
        image_url: imageUrl,
        prompt,
      },
      agentId
    );
  }

  /**
   * Extract text from an image (OCR)
   */
  async extractTextFromImage(
    imageUrl: string,
    agentId: string
  ): Promise<{ tool: string; result: any; timestamp: number }> {
    return this.executeTool(
      'extract_text_from_image',
      {
        image_url: imageUrl,
      },
      agentId
    );
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for custom instances
export { ApiClient };

// Helper function to handle API errors
export function handleApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
