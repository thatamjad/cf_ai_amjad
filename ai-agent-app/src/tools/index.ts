/**
 * Tools Module Index
 * Exports all tools and the registry
 */

export * from './ToolRegistry';
export * from './builtInTools';
export * from './imageTools';

import { toolRegistry } from './ToolRegistry';
import { builtInTools } from './builtInTools';
import { imageTools } from './imageTools';

/**
 * Initialize all built-in tools
 */
export function initializeTools(): void {
  console.log('🔧 Initializing tools...');

  // Register all built-in tools
  toolRegistry.registerAll(builtInTools);

  // Register image tools
  toolRegistry.registerAll(imageTools);

  console.log(`✅ Registered ${toolRegistry.getAll().length} tools`);
}

/**
 * Get tool registry instance
 */
export function getToolRegistry() {
  return toolRegistry;
}
