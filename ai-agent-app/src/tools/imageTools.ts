/**
 * Image Generation and Analysis Tools
 * Multi-modal AI tools for working with images
 */

import { Tool, ToolContext, ToolResult } from '../types/tools';

/**
 * IMAGE GENERATION TOOL
 * Generates images using Stable Diffusion via Workers AI
 */
export const imageGenerationTool: Tool = {
  name: 'generate_image',
  description:
    'Generate an image from a text description using AI. Creates high-quality images based on detailed prompts.',
  category: 'image',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Detailed description of the image to generate',
        minLength: 3,
        maxLength: 1000,
      },
      negative_prompt: {
        type: 'string',
        description: 'Things to avoid in the generated image',
        maxLength: 500,
      },
      num_steps: {
        type: 'number',
        description: 'Number of inference steps (more steps = higher quality but slower)',
        minimum: 1,
        maximum: 50,
      },
    },
    required: ['prompt'],
  },
  execute: async (
    params: { prompt: string; negative_prompt?: string; num_steps?: number },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      const { AI, FILES } = context.env;

      if (!AI) {
        return {
          success: false,
          error: 'Workers AI is not configured',
        };
      }

      console.log('🎨 Generating image with prompt:', params.prompt);

      // Generate image using Stable Diffusion XL
      const response = await AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
        prompt: params.prompt,
        negative_prompt: params.negative_prompt || 'blurry, low quality, distorted',
        num_steps: params.num_steps || 20,
      });

      // The response is an image blob
      const imageBlob = response as unknown as ArrayBuffer;

      // Store image in R2 if available
      let imageUrl = null;
      let imageKey = null;

      if (FILES) {
        imageKey = `agents/${context.agentId}/images/${Date.now()}-${crypto.randomUUID()}.png`;
        await FILES.put(imageKey, imageBlob, {
          httpMetadata: {
            contentType: 'image/png',
          },
          customMetadata: {
            prompt: params.prompt,
            generatedAt: new Date().toISOString(),
          },
        });

        // Generate a public URL (note: in production, use signed URLs or proper access control)
        imageUrl = `/api/images/${imageKey}`;
      }

      return {
        success: true,
        data: {
          prompt: params.prompt,
          imageKey,
          imageUrl,
          message: 'Image generated successfully',
          size: imageBlob.byteLength,
        },
      };
    } catch (error: any) {
      console.error('❌ Image generation error:', error);
      return {
        success: false,
        error: `Image generation failed: ${error.message}`,
      };
    }
  },
  rateLimit: {
    calls: 10,
    period: 60,
  },
  cost: 5, // Higher cost due to GPU usage
};

/**
 * IMAGE ANALYSIS TOOL
 * Analyzes images using vision models
 */
export const imageAnalysisTool: Tool = {
  name: 'analyze_image',
  description:
    'Analyze an image and get a detailed description of its contents using AI vision models.',
  category: 'image',
  parameters: {
    type: 'object',
    properties: {
      image_url: {
        type: 'string',
        description: 'URL or path of the image to analyze',
      },
      prompt: {
        type: 'string',
        description: 'Specific question or instruction for image analysis',
        maxLength: 500,
      },
    },
    required: ['image_url'],
  },
  execute: async (
    params: { image_url: string; prompt?: string },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      const { AI } = context.env;

      if (!AI) {
        return {
          success: false,
          error: 'Workers AI is not configured',
        };
      }

      console.log('👁️ Analyzing image:', params.image_url);

      // Fetch the image if it's a URL
      let imageData: ArrayBuffer;

      if (params.image_url.startsWith('http')) {
        const imageResponse = await fetch(params.image_url);
        if (!imageResponse.ok) {
          return {
            success: false,
            error: 'Failed to fetch image from URL',
          };
        }
        imageData = await imageResponse.arrayBuffer();
      } else {
        // Assume it's a local path in R2
        const { FILES } = context.env;
        if (!FILES) {
          return {
            success: false,
            error: 'File storage is not configured',
          };
        }

        const object = await FILES.get(params.image_url);
        if (!object) {
          return {
            success: false,
            error: 'Image not found in storage',
          };
        }

        imageData = await object.arrayBuffer();
      }

      // Analyze image using LLaVA vision model
      const response = await AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
        image: Array.from(new Uint8Array(imageData)),
        prompt: params.prompt || 'Describe this image in detail.',
        max_tokens: 512,
      });

      return {
        success: true,
        data: {
          image_url: params.image_url,
          analysis: response.description || response,
          prompt: params.prompt || 'Describe this image in detail.',
        },
      };
    } catch (error: any) {
      console.error('❌ Image analysis error:', error);
      return {
        success: false,
        error: `Image analysis failed: ${error.message}`,
      };
    }
  },
  rateLimit: {
    calls: 20,
    period: 60,
  },
  cost: 3,
};

/**
 * IMAGE TO TEXT (OCR) TOOL
 * Extracts text from images
 */
export const imageToTextTool: Tool = {
  name: 'extract_text_from_image',
  description: 'Extract text from an image using OCR (Optical Character Recognition).',
  category: 'image',
  parameters: {
    type: 'object',
    properties: {
      image_url: {
        type: 'string',
        description: 'URL or path of the image containing text',
      },
    },
    required: ['image_url'],
  },
  execute: async (params: { image_url: string }, context: ToolContext): Promise<ToolResult> => {
    try {
      const { AI } = context.env;

      if (!AI) {
        return {
          success: false,
          error: 'Workers AI is not configured',
        };
      }

      console.log('📄 Extracting text from image:', params.image_url);

      // Fetch the image
      let imageData: ArrayBuffer;

      if (params.image_url.startsWith('http')) {
        const imageResponse = await fetch(params.image_url);
        if (!imageResponse.ok) {
          return {
            success: false,
            error: 'Failed to fetch image from URL',
          };
        }
        imageData = await imageResponse.arrayBuffer();
      } else {
        const { FILES } = context.env;
        if (!FILES) {
          return {
            success: false,
            error: 'File storage is not configured',
          };
        }

        const object = await FILES.get(params.image_url);
        if (!object) {
          return {
            success: false,
            error: 'Image not found in storage',
          };
        }

        imageData = await object.arrayBuffer();
      }

      // Use vision model to extract text
      const response = await AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
        image: Array.from(new Uint8Array(imageData)),
        prompt:
          'Extract and transcribe all visible text from this image. Only provide the extracted text, nothing else.',
        max_tokens: 1024,
      });

      const extractedText = response.description || response;

      return {
        success: true,
        data: {
          image_url: params.image_url,
          extracted_text: extractedText,
          character_count: typeof extractedText === 'string' ? extractedText.length : 0,
        },
      };
    } catch (error: any) {
      console.error('❌ OCR error:', error);
      return {
        success: false,
        error: `Text extraction failed: ${error.message}`,
      };
    }
  },
  rateLimit: {
    calls: 15,
    period: 60,
  },
  cost: 2,
};

// Export all image tools
export const imageTools: Tool[] = [imageGenerationTool, imageAnalysisTool, imageToTextTool];
