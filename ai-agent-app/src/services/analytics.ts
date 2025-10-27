/**
 * Analytics and Observability System
 * Tracks events, performance metrics, and usage statistics
 */

/**
 * Event types for analytics
 */
export enum AnalyticsEventType {
  // Agent events
  AGENT_CREATED = 'agent_created',
  AGENT_DESTROYED = 'agent_destroyed',

  // Message events
  MESSAGE_SENT = 'message_sent',
  MESSAGE_RECEIVED = 'message_received',
  STREAMING_STARTED = 'streaming_started',
  STREAMING_COMPLETED = 'streaming_completed',

  // Tool events
  TOOL_CALLED = 'tool_called',
  TOOL_COMPLETED = 'tool_completed',
  TOOL_FAILED = 'tool_failed',

  // Memory events
  MEMORY_STORED = 'memory_stored',
  MEMORY_RETRIEVED = 'memory_retrieved',

  // Workflow events
  WORKFLOW_TRIGGERED = 'workflow_triggered',
  WORKFLOW_COMPLETED = 'workflow_completed',
  WORKFLOW_FAILED = 'workflow_failed',

  // Image events
  IMAGE_UPLOADED = 'image_uploaded',
  IMAGE_GENERATED = 'image_generated',
  IMAGE_ANALYZED = 'image_analyzed',

  // Collaboration events
  CONVERSATION_SHARED = 'conversation_shared',
  CONVERSATION_ACCESSED = 'conversation_accessed',

  // Error events
  ERROR_OCCURRED = 'error_occurred',
  RATE_LIMIT_HIT = 'rate_limit_hit',
}

/**
 * Analytics event data
 */
export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  timestamp: number;
  agentId?: string;
  userId?: string;
  data: Record<string, any>;
  metadata?: {
    duration?: number;
    success?: boolean;
    errorMessage?: string;
  };
}

/**
 * Performance metrics
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  timestamp: number;
  labels?: Record<string, string>;
}

/**
 * Usage statistics
 */
export interface UsageStats {
  period: {
    start: number;
    end: number;
  };
  metrics: {
    totalMessages: number;
    totalAgents: number;
    totalToolCalls: number;
    totalImages: number;
    totalTokens?: number;
    activeUsers: number;
    averageResponseTime: number;
    errorRate: number;
  };
  breakdown: {
    byTool: Record<string, number>;
    byAgent: Record<string, number>;
    byHour: Record<string, number>;
  };
}

/**
 * Analytics Service
 */
export class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  private metrics: PerformanceMetric[] = [];
  private maxStoredEvents = 10000;
  private maxStoredMetrics = 5000;

  /**
   * Track an event
   */
  trackEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): void {
    const fullEvent: AnalyticsEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...event,
    };

    this.events.push(fullEvent);

    // Keep only recent events
    if (this.events.length > this.maxStoredEvents) {
      this.events = this.events.slice(-this.maxStoredEvents);
    }

    // Log to console (in production, send to external analytics service)
    console.log(`📊 Analytics Event: ${event.type}`, {
      agentId: event.agentId,
      userId: event.userId,
      data: event.data,
    });
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      timestamp: Date.now(),
      ...metric,
    };

    this.metrics.push(fullMetric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxStoredMetrics) {
      this.metrics = this.metrics.slice(-this.maxStoredMetrics);
    }
  }

  /**
   * Start tracking time for an operation
   */
  startTimer(operationName: string): () => void {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      this.recordMetric({
        name: operationName,
        value: duration,
        unit: 'ms',
      });
    };
  }

  /**
   * Get events by type
   */
  getEventsByType(type: AnalyticsEventType, limit = 100): AnalyticsEvent[] {
    return this.events.filter((event) => event.type === type).slice(-limit);
  }

  /**
   * Get events by agent
   */
  getEventsByAgent(agentId: string, limit = 100): AnalyticsEvent[] {
    return this.events.filter((event) => event.agentId === agentId).slice(-limit);
  }

  /**
   * Get events by user
   */
  getEventsByUser(userId: string, limit = 100): AnalyticsEvent[] {
    return this.events.filter((event) => event.userId === userId).slice(-limit);
  }

  /**
   * Get metrics by name
   */
  getMetricsByName(name: string, limit = 100): PerformanceMetric[] {
    return this.metrics.filter((metric) => metric.name === name).slice(-limit);
  }

  /**
   * Calculate average metric value
   */
  getAverageMetric(name: string, since?: number): number | null {
    let relevantMetrics = this.metrics.filter((metric) => metric.name === name);

    if (since) {
      relevantMetrics = relevantMetrics.filter((metric) => metric.timestamp >= since);
    }

    if (relevantMetrics.length === 0) {
      return null;
    }

    const sum = relevantMetrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / relevantMetrics.length;
  }

  /**
   * Get usage statistics for a time period
   */
  getUsageStats(startTime: number, endTime: number): UsageStats {
    const periodEvents = this.events.filter(
      (event) => event.timestamp >= startTime && event.timestamp <= endTime
    );

    const totalMessages = periodEvents.filter(
      (e) => e.type === AnalyticsEventType.MESSAGE_SENT
    ).length;

    const uniqueAgents = new Set(periodEvents.filter((e) => e.agentId).map((e) => e.agentId));

    const uniqueUsers = new Set(periodEvents.filter((e) => e.userId).map((e) => e.userId));

    const toolCalls = periodEvents.filter((e) => e.type === AnalyticsEventType.TOOL_CALLED);

    const imageEvents = periodEvents.filter(
      (e) =>
        e.type === AnalyticsEventType.IMAGE_GENERATED ||
        e.type === AnalyticsEventType.IMAGE_UPLOADED ||
        e.type === AnalyticsEventType.IMAGE_ANALYZED
    );

    const errors = periodEvents.filter((e) => e.type === AnalyticsEventType.ERROR_OCCURRED);

    const errorRate = totalMessages > 0 ? (errors.length / totalMessages) * 100 : 0;

    // Calculate average response time
    const responseTimeMetrics = this.metrics.filter(
      (m) => m.name === 'llm_response_time' && m.timestamp >= startTime && m.timestamp <= endTime
    );

    const avgResponseTime =
      responseTimeMetrics.length > 0
        ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length
        : 0;

    // Breakdown by tool
    const byTool: Record<string, number> = {};
    for (const event of toolCalls) {
      const toolName = event.data.toolName || 'unknown';
      byTool[toolName] = (byTool[toolName] || 0) + 1;
    }

    // Breakdown by agent
    const byAgent: Record<string, number> = {};
    for (const event of periodEvents) {
      if (event.agentId) {
        byAgent[event.agentId] = (byAgent[event.agentId] || 0) + 1;
      }
    }

    // Breakdown by hour
    const byHour: Record<string, number> = {};
    for (const event of periodEvents) {
      const hour = new Date(event.timestamp).getHours();
      const hourKey = hour.toString().padStart(2, '0');
      byHour[hourKey] = (byHour[hourKey] || 0) + 1;
    }

    return {
      period: {
        start: startTime,
        end: endTime,
      },
      metrics: {
        totalMessages,
        totalAgents: uniqueAgents.size,
        totalToolCalls: toolCalls.length,
        totalImages: imageEvents.length,
        activeUsers: uniqueUsers.size,
        averageResponseTime: Math.round(avgResponseTime),
        errorRate: Math.round(errorRate * 100) / 100,
      },
      breakdown: {
        byTool,
        byAgent,
        byHour,
      },
    };
  }

  /**
   * Get real-time dashboard data
   */
  getDashboardData(): any {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;
    const lastHour = now - 60 * 60 * 1000;

    const stats24h = this.getUsageStats(last24Hours, now);
    const stats1h = this.getUsageStats(lastHour, now);

    const recentEvents = this.events.slice(-50).reverse();
    const recentErrors = recentEvents.filter((e) => e.type === AnalyticsEventType.ERROR_OCCURRED);

    return {
      current: {
        timestamp: now,
        activeAgents: new Set(recentEvents.filter((e) => e.agentId).map((e) => e.agentId)).size,
        recentActivity: recentEvents.length,
      },
      last24Hours: stats24h,
      lastHour: stats1h,
      recentEvents: recentEvents.slice(0, 10),
      recentErrors: recentErrors.slice(0, 5),
      topTools: Object.entries(stats24h.breakdown.byTool)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
    };
  }

  /**
   * Clear all analytics data
   */
  clear(): void {
    this.events = [];
    this.metrics = [];
  }

  /**
   * Export analytics data
   */
  export(): {
    events: AnalyticsEvent[];
    metrics: PerformanceMetric[];
  } {
    return {
      events: [...this.events],
      metrics: [...this.metrics],
    };
  }
}

// Global analytics service instance
export const analyticsService = new AnalyticsService();

/**
 * Helper function to track message events
 */
export function trackMessage(
  type: 'sent' | 'received',
  agentId: string,
  content: string,
  userId?: string,
  metadata?: any
): void {
  analyticsService.trackEvent({
    type: type === 'sent' ? AnalyticsEventType.MESSAGE_SENT : AnalyticsEventType.MESSAGE_RECEIVED,
    agentId,
    userId,
    data: {
      contentLength: content.length,
      ...metadata,
    },
  });
}

/**
 * Helper function to track tool calls
 */
export function trackToolCall(
  toolName: string,
  success: boolean,
  duration: number,
  agentId: string,
  userId?: string
): void {
  analyticsService.trackEvent({
    type: success ? AnalyticsEventType.TOOL_COMPLETED : AnalyticsEventType.TOOL_FAILED,
    agentId,
    userId,
    data: {
      toolName,
    },
    metadata: {
      duration,
      success,
    },
  });
}

/**
 * Helper function to track errors
 */
export function trackError(error: Error, context: string, agentId?: string, userId?: string): void {
  analyticsService.trackEvent({
    type: AnalyticsEventType.ERROR_OCCURRED,
    agentId,
    userId,
    data: {
      context,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    },
    metadata: {
      success: false,
      errorMessage: error.message,
    },
  });
}
