/**
 * Tool Registry System
 * Manages registration, validation, and execution of tools
 */

import { Tool, ToolContext, ToolResult, ToolCall, ToolExecutionLog } from '../types/tools';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private executionLogs: ToolExecutionLog[] = [];
  private rateLimitTracker: Map<string, { calls: number; resetTime: number }> = new Map();

  /**
   * Register a new tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }

    // Validate tool structure
    this.validateTool(tool);

    this.tools.set(tool.name, tool);
    console.log(`✅ Registered tool: ${tool.name}`);
  }

  /**
   * Register multiple tools at once
   */
  registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool schemas for LLM function calling
   */
  getSchemas(): Array<{ type: string; function: any }> {
    return this.getAll().map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Execute a tool with parameters
   */
  async execute(name: string, params: any, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
      };
    }

    // Check rate limiting
    if (tool.rateLimit) {
      const canExecute = this.checkRateLimit(name, tool.rateLimit.calls, tool.rateLimit.period);
      if (!canExecute) {
        return {
          success: false,
          error: `Rate limit exceeded for tool '${name}'. Please try again later.`,
        };
      }
    }

    // Validate parameters against schema
    const validationError = this.validateParameters(params, tool.parameters);
    if (validationError) {
      return {
        success: false,
        error: `Parameter validation failed: ${validationError}`,
      };
    }

    // Execute the tool
    const startTime = Date.now();
    try {
      const result = await tool.execute(params, context);
      const duration = Date.now() - startTime;

      // Log execution
      this.logExecution({
        id: crypto.randomUUID(),
        toolName: name,
        agentId: context.agentId,
        userId: context.userId,
        parameters: params,
        result,
        timestamp: context.timestamp,
        duration,
      });

      return {
        ...result,
        executionTime: duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ Tool execution error for '${name}':`, error);

      return {
        success: false,
        error: error.message || 'Tool execution failed',
        executionTime: duration,
      };
    }
  }

  /**
   * Execute tool from LLM tool call
   */
  async executeFromLLMCall(toolCall: ToolCall, context: ToolContext): Promise<ToolResult> {
    try {
      const params = JSON.parse(toolCall.function.arguments);
      return await this.execute(toolCall.function.name, params, context);
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to parse tool call arguments: ${error.message}`,
      };
    }
  }

  /**
   * Validate tool structure
   */
  private validateTool(tool: Tool): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid name');
    }

    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error('Tool must have a description');
    }

    if (!tool.parameters || typeof tool.parameters !== 'object') {
      throw new Error('Tool must have a parameters schema');
    }

    if (typeof tool.execute !== 'function') {
      throw new Error('Tool must have an execute function');
    }
  }

  /**
   * Validate parameters against JSON schema
   */
  private validateParameters(params: any, schema: any): string | null {
    // Basic validation - in production, use a proper JSON schema validator
    if (schema.type === 'object' && schema.required) {
      for (const requiredParam of schema.required) {
        if (!(requiredParam in params)) {
          return `Missing required parameter: ${requiredParam}`;
        }
      }
    }

    // Validate individual properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties as any)) {
        if (key in params) {
          const value = params[key];
          const prop = propSchema as any;

          // Type validation
          if (prop.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== prop.type) {
              return `Parameter '${key}' must be of type '${prop.type}', got '${actualType}'`;
            }
          }

          // String length validation
          if (prop.type === 'string' && typeof value === 'string') {
            if (prop.minLength && value.length < prop.minLength) {
              return `Parameter '${key}' must be at least ${prop.minLength} characters`;
            }
            if (prop.maxLength && value.length > prop.maxLength) {
              return `Parameter '${key}' must be at most ${prop.maxLength} characters`;
            }
          }

          // Number range validation
          if (prop.type === 'number' && typeof value === 'number') {
            if (prop.minimum !== undefined && value < prop.minimum) {
              return `Parameter '${key}' must be at least ${prop.minimum}`;
            }
            if (prop.maximum !== undefined && value > prop.maximum) {
              return `Parameter '${key}' must be at most ${prop.maximum}`;
            }
          }

          // Enum validation
          if (prop.enum && !prop.enum.includes(value)) {
            return `Parameter '${key}' must be one of: ${prop.enum.join(', ')}`;
          }
        }
      }
    }

    return null;
  }

  /**
   * Check rate limiting for a tool
   */
  private checkRateLimit(toolName: string, maxCalls: number, period: number): boolean {
    const now = Date.now();
    const key = toolName;
    const tracker = this.rateLimitTracker.get(key);

    if (!tracker || now > tracker.resetTime) {
      // Reset or initialize
      this.rateLimitTracker.set(key, {
        calls: 1,
        resetTime: now + period * 1000,
      });
      return true;
    }

    if (tracker.calls >= maxCalls) {
      return false;
    }

    tracker.calls++;
    return true;
  }

  /**
   * Log tool execution
   */
  private logExecution(log: ToolExecutionLog): void {
    this.executionLogs.push(log);

    // Keep only last 1000 logs
    if (this.executionLogs.length > 1000) {
      this.executionLogs.shift();
    }
  }

  /**
   * Get execution logs
   */
  getExecutionLogs(filters?: {
    toolName?: string;
    agentId?: string;
    userId?: string;
    limit?: number;
  }): ToolExecutionLog[] {
    let logs = this.executionLogs;

    if (filters?.toolName) {
      logs = logs.filter((log) => log.toolName === filters.toolName);
    }

    if (filters?.agentId) {
      logs = logs.filter((log) => log.agentId === filters.agentId);
    }

    if (filters?.userId) {
      logs = logs.filter((log) => log.userId === filters.userId);
    }

    if (filters?.limit) {
      logs = logs.slice(-filters.limit);
    }

    return logs;
  }

  /**
   * Get tool statistics
   */
  getStatistics(): Record<string, any> {
    const stats: Record<string, any> = {
      totalTools: this.tools.size,
      totalExecutions: this.executionLogs.length,
      toolUsage: {} as Record<string, number>,
      successRate: {} as Record<string, number>,
    };

    for (const log of this.executionLogs) {
      // Count usage
      stats.toolUsage[log.toolName] = (stats.toolUsage[log.toolName] || 0) + 1;

      // Calculate success rate
      if (!stats.successRate[log.toolName]) {
        stats.successRate[log.toolName] = { success: 0, total: 0 };
      }
      stats.successRate[log.toolName].total++;
      if (log.result.success) {
        stats.successRate[log.toolName].success++;
      }
    }

    // Convert success rates to percentages
    for (const tool in stats.successRate) {
      const data = stats.successRate[tool];
      stats.successRate[tool] = (data.success / data.total) * 100;
    }

    return stats;
  }

  /**
   * Clear all tools and logs
   */
  clear(): void {
    this.tools.clear();
    this.executionLogs = [];
    this.rateLimitTracker.clear();
  }
}

// Global registry instance
export const toolRegistry = new ToolRegistry();
