/**
 * Unit Tests for Tool Registry System
 * 
 * Tests cover:
 * - Tool registration
 * - Parameter validation
 * - Tool execution
 * - Rate limiting
 * - Error handling
 * - Statistics tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRegistry } from '../src/tools/ToolRegistry';
import { Tool, ToolContext, ToolCategory } from '../src/types/tools';
import { createMockEnv } from './test-utils';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockEnv: any;
  let mockContext: ToolContext;

  beforeEach(() => {
    registry = new ToolRegistry();
    mockEnv = createMockEnv();
    mockContext = {
      agentId: 'agent_test',
      userId: 'user_test',
      timestamp: Date.now(),
      env: mockEnv
    };
  });

  describe('Tool Registration', () => {
    it('should register a tool successfully', () => {
      const tool: Tool = {
        name: 'test_tool',
        description: 'A test tool',
        category: 'utility' as ToolCategory,
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        },
        execute: async (params) => ({ result: params.input })
      };

      registry.register(tool);
      
      const tools = registry.list();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_tool');
    });

    it('should register multiple tools', () => {
      const tools: Tool[] = [
        {
          name: 'tool1',
          description: 'Tool 1',
          category: 'compute' as ToolCategory,
          parameters: { type: 'object', properties: {} },
          execute: async () => ({})
        },
        {
          name: 'tool2',
          description: 'Tool 2',
          category: 'search' as ToolCategory,
          parameters: { type: 'object', properties: {} },
          execute: async () => ({})
        }
      ];

      registry.registerAll(tools);
      
      const registered = registry.list();
      expect(registered).toHaveLength(2);
      expect(registered.map(t => t.name)).toEqual(['tool1', 'tool2']);
    });

    it('should not register duplicate tool names', () => {
      const tool: Tool = {
        name: 'duplicate',
        description: 'Tool',
        category: 'utility' as ToolCategory,
        parameters: { type: 'object', properties: {} },
        execute: async () => ({})
      };

      registry.register(tool);
      expect(() => registry.register(tool)).toThrow('Tool duplicate already registered');
    });

    it('should get tool by name', () => {
      const tool: Tool = {
        name: 'findme',
        description: 'Tool',
        category: 'utility' as ToolCategory,
        parameters: { type: 'object', properties: {} },
        execute: async () => ({})
      };

      registry.register(tool);
      
      const found = registry.get('findme');
      expect(found).toBeDefined();
      expect(found?.name).toBe('findme');
    });

    it('should return undefined for non-existent tool', () => {
      const found = registry.get('nonexistent');
      expect(found).toBeUndefined();
    });
  });

  describe('Parameter Validation', () => {
    beforeEach(() => {
      const tool: Tool = {
        name: 'validator_test',
        description: 'Test validation',
        category: 'utility' as ToolCategory,
        parameters: {
          type: 'object',
          properties: {
            required_string: { type: 'string' },
            optional_number: { type: 'number' },
            enum_value: { type: 'string', enum: ['a', 'b', 'c'] }
          },
          required: ['required_string']
        },
        execute: async (params) => params
      };
      registry.register(tool);
    });

    it('should validate required parameters', async () => {
      await expect(
        registry.execute('validator_test', {}, mockContext)
      ).rejects.toThrow();

      const result = await registry.execute(
        'validator_test',
        { required_string: 'value' },
        mockContext
      );
      expect(result.success).toBe(true);
    });

    it('should validate parameter types', async () => {
      await expect(
        registry.execute(
          'validator_test',
          { required_string: 123 }, // Wrong type
          mockContext
        )
      ).rejects.toThrow();
    });

    it('should validate enum values', async () => {
      await expect(
        registry.execute(
          'validator_test',
          { required_string: 'test', enum_value: 'invalid' },
          mockContext
        )
      ).rejects.toThrow();

      const result = await registry.execute(
        'validator_test',
        { required_string: 'test', enum_value: 'a' },
        mockContext
      );
      expect(result.success).toBe(true);
    });

    it('should allow optional parameters to be omitted', async () => {
      const result = await registry.execute(
        'validator_test',
        { required_string: 'test' },
        mockContext
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('should execute a tool successfully', async () => {
      const tool: Tool = {
        name: 'success_tool',
        description: 'Always succeeds',
        category: 'utility' as ToolCategory,
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        },
        execute: async (params) => ({ output: params.input.toUpperCase() })
      };
      registry.register(tool);

      const result = await registry.execute(
        'success_tool',
        { input: 'hello' },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ output: 'HELLO' });
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle tool execution errors', async () => {
      const tool: Tool = {
        name: 'error_tool',
        description: 'Always fails',
        category: 'utility' as ToolCategory,
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          throw new Error('Tool error');
        }
      };
      registry.register(tool);

      const result = await registry.execute('error_tool', {}, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool error');
    });

    it('should track execution time', async () => {
      const tool: Tool = {
        name: 'slow_tool',
        description: 'Slow execution',
        category: 'compute' as ToolCategory,
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { done: true };
        }
      };
      registry.register(tool);

      const result = await registry.execute('slow_tool', {}, mockContext);

      expect(result.executionTime).toBeGreaterThanOrEqual(100);
    });

    it('should throw error for non-existent tool', async () => {
      await expect(
        registry.execute('nonexistent', {}, mockContext)
      ).rejects.toThrow('Tool nonexistent not found');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should enforce rate limits', async () => {
      const tool: Tool = {
        name: 'rate_limited',
        description: 'Rate limited tool',
        category: 'utility' as ToolCategory,
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true }),
        rateLimit: {
          maxCalls: 2,
          windowMs: 60000
        }
      };
      registry.register(tool);

      // First two calls should succeed
      await registry.execute('rate_limited', {}, mockContext);
      await registry.execute('rate_limited', {}, mockContext);

      // Third call should fail
      const result = await registry.execute('rate_limited', {}, mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('should reset rate limit after window expires', async () => {
      const tool: Tool = {
        name: 'rate_limited',
        description: 'Rate limited tool',
        category: 'utility' as ToolCategory,
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true }),
        rateLimit: {
          maxCalls: 1,
          windowMs: 1000
        }
      };
      registry.register(tool);

      // First call succeeds
      await registry.execute('rate_limited', {}, mockContext);

      // Second call fails (within window)
      let result = await registry.execute('rate_limited', {}, mockContext);
      expect(result.success).toBe(false);

      // Advance time past window
      vi.advanceTimersByTime(1100);

      // Third call succeeds (new window)
      result = await registry.execute('rate_limited', {}, mockContext);
      expect(result.success).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should track tool execution statistics', async () => {
      const tool: Tool = {
        name: 'stats_tool',
        description: 'Tool for stats',
        category: 'utility' as ToolCategory,
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true })
      };
      registry.register(tool);

      // Execute multiple times
      await registry.execute('stats_tool', {}, mockContext);
      await registry.execute('stats_tool', {}, mockContext);

      const stats = registry.getStatistics();
      
      expect(stats.totalExecutions).toBe(2);
      expect(stats.toolStats['stats_tool']).toBeDefined();
      expect(stats.toolStats['stats_tool'].count).toBe(2);
      expect(stats.toolStats['stats_tool'].successCount).toBe(2);
      expect(stats.toolStats['stats_tool'].failureCount).toBe(0);
    });

    it('should track success and failure counts', async () => {
      const tool: Tool = {
        name: 'mixed_tool',
        description: 'Sometimes fails',
        category: 'utility' as ToolCategory,
        parameters: {
          type: 'object',
          properties: {
            shouldFail: { type: 'boolean' }
          }
        },
        execute: async (params) => {
          if (params.shouldFail) throw new Error('Failed');
          return { success: true };
        }
      };
      registry.register(tool);

      await registry.execute('mixed_tool', { shouldFail: false }, mockContext);
      await registry.execute('mixed_tool', { shouldFail: true }, mockContext);
      await registry.execute('mixed_tool', { shouldFail: false }, mockContext);

      const stats = registry.getStatistics();
      const toolStats = stats.toolStats['mixed_tool'];
      
      expect(toolStats.count).toBe(3);
      expect(toolStats.successCount).toBe(2);
      expect(toolStats.failureCount).toBe(1);
    });

    it('should calculate average execution time', async () => {
      const tool: Tool = {
        name: 'timed_tool',
        description: 'Tool with timing',
        category: 'compute' as ToolCategory,
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { done: true };
        }
      };
      registry.register(tool);

      await registry.execute('timed_tool', {}, mockContext);
      await registry.execute('timed_tool', {}, mockContext);

      const stats = registry.getStatistics();
      const toolStats = stats.toolStats['timed_tool'];
      
      expect(toolStats.averageTime).toBeGreaterThan(0);
      expect(toolStats.averageTime).toBeGreaterThanOrEqual(50);
    });

    it('should list most used tools', async () => {
      const tools: Tool[] = [
        {
          name: 'tool_a',
          description: 'Tool A',
          category: 'utility' as ToolCategory,
          parameters: { type: 'object', properties: {} },
          execute: async () => ({})
        },
        {
          name: 'tool_b',
          description: 'Tool B',
          category: 'utility' as ToolCategory,
          parameters: { type: 'object', properties: {} },
          execute: async () => ({})
        }
      ];
      registry.registerAll(tools);

      // Execute tool_a more times
      await registry.execute('tool_a', {}, mockContext);
      await registry.execute('tool_a', {}, mockContext);
      await registry.execute('tool_a', {}, mockContext);
      await registry.execute('tool_b', {}, mockContext);

      const stats = registry.getStatistics();
      const mostUsed = stats.mostUsedTools;
      
      expect(mostUsed[0].name).toBe('tool_a');
      expect(mostUsed[0].count).toBe(3);
      expect(mostUsed[1].name).toBe('tool_b');
      expect(mostUsed[1].count).toBe(1);
    });
  });

  describe('Schema Generation', () => {
    it('should generate LLM function schemas', () => {
      const tool: Tool = {
        name: 'example_tool',
        description: 'An example tool for testing',
        category: 'utility' as ToolCategory,
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            limit: {
              type: 'number',
              description: 'Max results',
              default: 10
            }
          },
          required: ['query']
        },
        execute: async () => ({})
      };
      registry.register(tool);

      const schemas = registry.getSchemas();
      
      expect(schemas).toHaveLength(1);
      expect(schemas[0]).toEqual({
        type: 'function',
        function: {
          name: 'example_tool',
          description: 'An example tool for testing',
          parameters: tool.parameters
        }
      });
    });

    it('should generate schemas for all registered tools', () => {
      const tools: Tool[] = [
        {
          name: 'tool1',
          description: 'Tool 1',
          category: 'utility' as ToolCategory,
          parameters: { type: 'object', properties: {} },
          execute: async () => ({})
        },
        {
          name: 'tool2',
          description: 'Tool 2',
          category: 'utility' as ToolCategory,
          parameters: { type: 'object', properties: {} },
          execute: async () => ({})
        }
      ];
      registry.registerAll(tools);

      const schemas = registry.getSchemas();
      
      expect(schemas).toHaveLength(2);
      expect(schemas.map((s: any) => s.function.name)).toEqual(['tool1', 'tool2']);
    });
  });

  describe('Execution Logging', () => {
    it('should log successful executions', async () => {
      const tool: Tool = {
        name: 'logged_tool',
        description: 'Logged tool',
        category: 'utility' as ToolCategory,
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        },
        execute: async (params) => ({ output: params.input })
      };
      registry.register(tool);

      await registry.execute('logged_tool', { input: 'test' }, mockContext);

      const logs = registry.getExecutionLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].toolName).toBe('logged_tool');
      expect(logs[0].success).toBe(true);
      expect(logs[0].parameters).toEqual({ input: 'test' });
      expect(logs[0].result).toEqual({ output: 'test' });
    });

    it('should log failed executions', async () => {
      const tool: Tool = {
        name: 'failing_tool',
        description: 'Failing tool',
        category: 'utility' as ToolCategory,
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          throw new Error('Execution failed');
        }
      };
      registry.register(tool);

      await registry.execute('failing_tool', {}, mockContext);

      const logs = registry.getExecutionLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].success).toBe(false);
      expect(logs[0].error).toContain('Execution failed');
    });

    it('should limit log storage', async () => {
      const tool: Tool = {
        name: 'many_executions',
        description: 'Tool',
        category: 'utility' as ToolCategory,
        parameters: { type: 'object', properties: {} },
        execute: async () => ({})
      };
      registry.register(tool);

      // Execute more than max log size (assume max is 1000)
      for (let i = 0; i < 1100; i++) {
        await registry.execute('many_executions', {}, mockContext);
      }

      const logs = registry.getExecutionLogs();
      
      // Should be capped at max size
      expect(logs.length).toBeLessThanOrEqual(1000);
    });
  });
});
