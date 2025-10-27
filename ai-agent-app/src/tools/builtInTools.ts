/**
 * Built-in Tools Implementation
 * Collection of ready-to-use tools for the AI agent
 */

import { Tool, ToolContext, ToolResult } from '../types/tools';

/**
 * CALCULATOR TOOL
 * Performs mathematical calculations
 */
export const calculatorTool: Tool = {
  name: 'calculator',
  description:
    'Perform mathematical calculations. Supports basic arithmetic, trigonometry, and complex expressions.',
  category: 'compute',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description:
          'The mathematical expression to evaluate (e.g., "2 + 2", "sin(pi/2)", "sqrt(16)")',
      },
    },
    required: ['expression'],
  },
  execute: async (params: { expression: string }): Promise<ToolResult> => {
    try {
      // Safe eval using Function constructor (sandboxed)
      const allowedMath = {
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        sqrt: Math.sqrt,
        pow: Math.pow,
        abs: Math.abs,
        floor: Math.floor,
        ceil: Math.ceil,
        round: Math.round,
        log: Math.log,
        exp: Math.exp,
        pi: Math.PI,
        e: Math.E,
      };

      // Create safe evaluation context
      const safeEval = new Function(...Object.keys(allowedMath), `return ${params.expression}`);

      const result = safeEval(...Object.values(allowedMath));

      return {
        success: true,
        data: {
          expression: params.expression,
          result,
          formatted: `${params.expression} = ${result}`,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Calculation error: ${error.message}`,
      };
    }
  },
  rateLimit: {
    calls: 100,
    period: 60,
  },
};

/**
 * WEATHER TOOL
 * Gets weather information for a location
 */
export const weatherTool: Tool = {
  name: 'get_weather',
  description: 'Get current weather information for a specific location.',
  category: 'data',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description:
          'The city name or location to get weather for (e.g., "London", "New York, NY")',
      },
      units: {
        type: 'string',
        description: 'Temperature units',
        enum: ['celsius', 'fahrenheit'],
      },
    },
    required: ['location'],
  },
  execute: async (params: { location: string; units?: string }): Promise<ToolResult> => {
    try {
      // Using Open-Meteo free API (no key required)
      // First, geocode the location
      const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(params.location)}&count=1&language=en&format=json`;
      const geocodeResponse = await fetch(geocodeUrl);
      const geocodeData: any = await geocodeResponse.json();

      if (!geocodeData.results || geocodeData.results.length === 0) {
        return {
          success: false,
          error: `Location "${params.location}" not found`,
        };
      }

      const { latitude, longitude, name, country } = geocodeData.results[0];

      // Get weather data
      const tempUnit = params.units === 'fahrenheit' ? 'fahrenheit' : 'celsius';
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&temperature_unit=${tempUnit}&wind_speed_unit=kmh&precipitation_unit=mm&timeformat=iso8601&timezone=auto`;

      const weatherResponse = await fetch(weatherUrl);
      const weatherData: any = await weatherResponse.json();

      const current = weatherData.current;

      // Weather code descriptions
      const weatherDescriptions: Record<number, string> = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Foggy',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with slight hail',
        99: 'Thunderstorm with heavy hail',
      };

      const condition = weatherDescriptions[current.weather_code] || 'Unknown';

      return {
        success: true,
        data: {
          location: `${name}, ${country}`,
          coordinates: { latitude, longitude },
          condition,
          temperature: current.temperature_2m,
          feels_like: current.apparent_temperature,
          humidity: current.relative_humidity_2m,
          wind_speed: current.wind_speed_10m,
          wind_direction: current.wind_direction_10m,
          pressure: current.pressure_msl,
          cloud_cover: current.cloud_cover,
          precipitation: current.precipitation,
          units: tempUnit,
          is_day: current.is_day === 1,
          timestamp: current.time,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Weather API error: ${error.message}`,
      };
    }
  },
  rateLimit: {
    calls: 30,
    period: 60,
  },
};

/**
 * WEB SEARCH TOOL
 * Searches the web using DuckDuckGo
 */
export const webSearchTool: Tool = {
  name: 'web_search',
  description: 'Search the web for information using DuckDuckGo. Returns relevant search results.',
  category: 'search',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
        minLength: 1,
        maxLength: 500,
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return (1-10)',
        minimum: 1,
        maximum: 10,
      },
    },
    required: ['query'],
  },
  execute: async (params: { query: string; max_results?: number }): Promise<ToolResult> => {
    try {
      const maxResults = params.max_results || 5;

      // Using DuckDuckGo Instant Answer API
      const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(params.query)}&format=json&no_html=1&skip_disambig=1`;

      const response = await fetch(searchUrl);
      const data: any = await response.json();

      const results: any[] = [];

      // Add abstract if available
      if (data.Abstract) {
        results.push({
          title: data.Heading || 'Summary',
          snippet: data.Abstract,
          url: data.AbstractURL,
          source: data.AbstractSource,
        });
      }

      // Add related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, maxResults - results.length)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0],
              snippet: topic.Text,
              url: topic.FirstURL,
            });
          }
        }
      }

      if (results.length === 0) {
        return {
          success: true,
          data: {
            query: params.query,
            results: [],
            message: 'No results found. Try rephrasing your query.',
          },
        };
      }

      return {
        success: true,
        data: {
          query: params.query,
          results: results.slice(0, maxResults),
          count: results.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Web search error: ${error.message}`,
      };
    }
  },
  rateLimit: {
    calls: 20,
    period: 60,
  },
};

/**
 * CODE EXECUTOR TOOL
 * Executes JavaScript code in a sandboxed environment
 */
export const codeExecutorTool: Tool = {
  name: 'execute_code',
  description:
    'Execute JavaScript code in a safe sandboxed environment. Returns the result of the execution.',
  category: 'compute',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The JavaScript code to execute',
        maxLength: 5000,
      },
      timeout: {
        type: 'number',
        description: 'Execution timeout in milliseconds (max 5000)',
        minimum: 100,
        maximum: 5000,
      },
    },
    required: ['code'],
  },
  execute: async (params: { code: string; timeout?: number }): Promise<ToolResult> => {
    try {
      const timeout = params.timeout || 3000;

      // Create a sandboxed execution environment
      const sandbox = {
        console: {
          log: (...args: any[]) => args.join(' '),
        },
        Math,
        JSON,
        Date,
        Array,
        String,
        Number,
        Object,
      };

      // Wrap code in async function
      const wrappedCode = `
        return (async () => {
          ${params.code}
        })();
      `;

      const fn = new Function(...Object.keys(sandbox), wrappedCode);

      // Execute with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Execution timeout')), timeout);
      });

      const result = await Promise.race([fn(...Object.values(sandbox)), timeoutPromise]);

      return {
        success: true,
        data: {
          result,
          output: typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Code execution error: ${error.message}`,
      };
    }
  },
  rateLimit: {
    calls: 10,
    period: 60,
  },
};

/**
 * FILE OPERATIONS TOOL
 * Performs file operations with R2
 */
export const fileOperationsTool: Tool = {
  name: 'file_operations',
  description: 'Perform file operations such as list, read, write, or delete files in storage.',
  category: 'file',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'The file operation to perform',
        enum: ['list', 'read', 'write', 'delete'],
      },
      path: {
        type: 'string',
        description: 'The file path',
      },
      content: {
        type: 'string',
        description: 'The file content (for write operation)',
      },
    },
    required: ['operation'],
  },
  execute: async (
    params: { operation: string; path?: string; content?: string },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      const { FILES } = context.env;

      if (!FILES) {
        return {
          success: false,
          error: 'File storage (R2) is not configured',
        };
      }

      const agentPrefix = `agents/${context.agentId}/`;

      switch (params.operation) {
        case 'list': {
          const listed = await FILES.list({ prefix: agentPrefix, limit: 100 });
          return {
            success: true,
            data: {
              files: listed.objects.map((obj: any) => ({
                key: obj.key.replace(agentPrefix, ''),
                size: obj.size,
                uploaded: obj.uploaded,
              })),
              count: listed.objects.length,
            },
          };
        }

        case 'read': {
          if (!params.path) {
            return { success: false, error: 'Path is required for read operation' };
          }

          const fullPath = agentPrefix + params.path;
          const object = await FILES.get(fullPath);

          if (!object) {
            return {
              success: false,
              error: `File not found: ${params.path}`,
            };
          }

          const content = await object.text();

          return {
            success: true,
            data: {
              path: params.path,
              content,
              size: object.size,
            },
          };
        }

        case 'write': {
          if (!params.path) {
            return { success: false, error: 'Path is required for write operation' };
          }
          if (!params.content) {
            return { success: false, error: 'Content is required for write operation' };
          }

          const fullPath = agentPrefix + params.path;
          await FILES.put(fullPath, params.content);

          return {
            success: true,
            data: {
              path: params.path,
              size: params.content.length,
              message: 'File written successfully',
            },
          };
        }

        case 'delete': {
          if (!params.path) {
            return { success: false, error: 'Path is required for delete operation' };
          }

          const fullPath = agentPrefix + params.path;
          await FILES.delete(fullPath);

          return {
            success: true,
            data: {
              path: params.path,
              message: 'File deleted successfully',
            },
          };
        }

        default:
          return {
            success: false,
            error: `Unknown operation: ${params.operation}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `File operation error: ${error.message}`,
      };
    }
  },
  rateLimit: {
    calls: 50,
    period: 60,
  },
};

/**
 * TIME AND DATE TOOL
 * Gets current time, date, and timezone information
 */
export const timeDateTool: Tool = {
  name: 'get_time_date',
  description: 'Get current time, date, timezone information, or convert between timezones.',
  category: 'utility',
  parameters: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: 'IANA timezone name (e.g., "America/New_York", "Europe/London")',
      },
      format: {
        type: 'string',
        description: 'Date format type',
        enum: ['full', 'date', 'time', 'iso'],
      },
    },
    required: [],
  },
  execute: async (params: { timezone?: string; format?: string }): Promise<ToolResult> => {
    try {
      const now = new Date();
      const timezone = params.timezone || 'UTC';
      const format = params.format || 'full';

      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'long',
      };

      let formatted: string;

      switch (format) {
        case 'date':
          formatted = now.toLocaleDateString('en-US', { timeZone: timezone, dateStyle: 'full' });
          break;
        case 'time':
          formatted = now.toLocaleTimeString('en-US', { timeZone: timezone, timeStyle: 'long' });
          break;
        case 'iso':
          formatted = now.toISOString();
          break;
        default:
          formatted = now.toLocaleString('en-US', options);
      }

      return {
        success: true,
        data: {
          formatted,
          iso: now.toISOString(),
          timestamp: now.getTime(),
          timezone,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
          hour: now.getHours(),
          minute: now.getMinutes(),
          second: now.getSeconds(),
          dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Time/date error: ${error.message}`,
      };
    }
  },
  rateLimit: {
    calls: 100,
    period: 60,
  },
};

/**
 * UUID GENERATOR TOOL
 * Generates UUIDs
 */
export const uuidGeneratorTool: Tool = {
  name: 'generate_uuid',
  description: 'Generate a random UUID (Universally Unique Identifier).',
  category: 'utility',
  parameters: {
    type: 'object',
    properties: {
      count: {
        type: 'number',
        description: 'Number of UUIDs to generate (1-10)',
        minimum: 1,
        maximum: 10,
      },
    },
    required: [],
  },
  execute: async (params: { count?: number }): Promise<ToolResult> => {
    try {
      const count = params.count || 1;
      const uuids: string[] = [];

      for (let i = 0; i < count; i++) {
        uuids.push(crypto.randomUUID());
      }

      return {
        success: true,
        data: {
          uuids,
          count: uuids.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `UUID generation error: ${error.message}`,
      };
    }
  },
  rateLimit: {
    calls: 100,
    period: 60,
  },
};

/**
 * TEXT ANALYSIS TOOL
 * Analyzes text for various metrics
 */
export const textAnalysisTool: Tool = {
  name: 'analyze_text',
  description: 'Analyze text for word count, character count, reading time, and other metrics.',
  category: 'utility',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text to analyze',
        maxLength: 50000,
      },
    },
    required: ['text'],
  },
  execute: async (params: { text: string }): Promise<ToolResult> => {
    try {
      const text = params.text;
      const words = text
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0);
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

      const wordCount = words.length;
      const charCount = text.length;
      const charCountNoSpaces = text.replace(/\s/g, '').length;
      const sentenceCount = sentences.length;
      const paragraphCount = paragraphs.length;

      // Average reading speed: 200-250 words per minute
      const readingTimeMinutes = Math.ceil(wordCount / 225);

      // Average word length
      const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / wordCount;

      // Average sentence length
      const avgSentenceLength = wordCount / sentenceCount;

      return {
        success: true,
        data: {
          words: wordCount,
          characters: charCount,
          charactersNoSpaces: charCountNoSpaces,
          sentences: sentenceCount,
          paragraphs: paragraphCount,
          readingTimeMinutes,
          averageWordLength: Math.round(avgWordLength * 10) / 10,
          averageSentenceLength: Math.round(avgSentenceLength * 10) / 10,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Text analysis error: ${error.message}`,
      };
    }
  },
  rateLimit: {
    calls: 50,
    period: 60,
  },
};

// Export all tools as an array
export const builtInTools: Tool[] = [
  calculatorTool,
  weatherTool,
  webSearchTool,
  codeExecutorTool,
  fileOperationsTool,
  timeDateTool,
  uuidGeneratorTool,
  textAnalysisTool,
];
