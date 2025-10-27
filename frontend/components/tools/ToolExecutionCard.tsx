/**
 * Tool Execution Card Component
 * Displays tool execution with parameters and results
 */

import React from 'react';
import { Loader2, CheckCircle2, XCircle, Code, Wrench } from 'lucide-react';

interface ToolExecutionCardProps {
  toolName: string;
  parameters?: Record<string, any>;
  result?: {
    success: boolean;
    data?: any;
    error?: string;
    executionTime?: number;
  };
  isLoading?: boolean;
}

export function ToolExecutionCard({
  toolName,
  parameters,
  result,
  isLoading = false,
}: ToolExecutionCardProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4 my-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Wrench className="w-4 h-4 text-primary" />
        <span className="font-semibold text-sm">Tool: {toolName}</span>
        {isLoading && <Loader2 className="w-4 h-4 animate-spin ml-auto text-muted-foreground" />}
        {!isLoading && result && (
          <div className="ml-auto">
            {result.success ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
        )}
      </div>

      {/* Parameters */}
      {parameters && Object.keys(parameters).length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-muted-foreground mb-1">Parameters:</div>
          <div className="bg-background rounded-md p-2 text-xs">
            <pre className="overflow-x-auto">
              {JSON.stringify(parameters, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Executing...</span>
        </div>
      )}

      {/* Result */}
      {!isLoading && result && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center justify-between">
            <span>Result:</span>
            {result.executionTime && (
              <span className="text-muted-foreground">
                {result.executionTime}ms
              </span>
            )}
          </div>

          {result.success ? (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md p-3 text-sm">
              {typeof result.data === 'object' ? (
                <pre className="overflow-x-auto text-xs">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              ) : (
                <div>{String(result.data)}</div>
              )}
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-700 dark:text-red-400">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4" />
                <span className="font-semibold">Error</span>
              </div>
              <div className="text-xs">{result.error}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Tool Parameter Display Component
 * Shows tool parameters in a readable format
 */
interface ToolParameterDisplayProps {
  parameters: Record<string, any>;
  className?: string;
}

export function ToolParameterDisplay({
  parameters,
  className = '',
}: ToolParameterDisplayProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Object.entries(parameters).map(([key, value]) => (
        <div key={key} className="flex items-start gap-2">
          <div className="text-xs font-medium text-muted-foreground min-w-[100px]">
            {key}:
          </div>
          <div className="text-sm flex-1 break-words">
            {typeof value === 'object' ? (
              <pre className="text-xs bg-muted p-2 rounded">
                {JSON.stringify(value, null, 2)}
              </pre>
            ) : (
              <span>{String(value)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Tool Result Display Component
 * Shows tool execution results
 */
interface ToolResultDisplayProps {
  result: {
    success: boolean;
    data?: any;
    error?: string;
    executionTime?: number;
  };
  className?: string;
}

export function ToolResultDisplay({
  result,
  className = '',
}: ToolResultDisplayProps) {
  if (result.success) {
    return (
      <div className={`rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="font-semibold text-green-800 dark:text-green-300">Success</span>
          {result.executionTime && (
            <span className="text-xs text-green-600 dark:text-green-500 ml-auto">
              {result.executionTime}ms
            </span>
          )}
        </div>

        {result.data && (
          <div className="mt-3">
            {typeof result.data === 'object' ? (
              <pre className="text-xs bg-white dark:bg-black/20 p-3 rounded overflow-x-auto">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            ) : (
              <div className="text-sm text-green-900 dark:text-green-100">
                {String(result.data)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
        <span className="font-semibold text-red-800 dark:text-red-300">Error</span>
      </div>

      {result.error && (
        <div className="text-sm text-red-700 dark:text-red-400 mt-2">
          {result.error}
        </div>
      )}
    </div>
  );
}

/**
 * Tool Selector Component
 * Allows users to select and execute tools manually
 */
interface Tool {
  name: string;
  description: string;
  category: string;
  parameters: any;
}

interface ToolSelectorProps {
  tools: Tool[];
  onExecute: (toolName: string, parameters: Record<string, any>) => void;
  isLoading?: boolean;
}

export function ToolSelector({ tools, onExecute, isLoading = false }: ToolSelectorProps) {
  const [selectedTool, setSelectedTool] = React.useState<Tool | null>(null);
  const [parameters, setParameters] = React.useState<Record<string, any>>({});

  const handleExecute = () => {
    if (selectedTool) {
      onExecute(selectedTool.name, parameters);
    }
  };

  return (
    <div className="space-y-4 p-4 border border-border rounded-lg">
      <div>
        <label className="text-sm font-medium mb-2 block">Select Tool</label>
        <select
          className="w-full px-3 py-2 border border-border rounded-md bg-background"
          value={selectedTool?.name || ''}
          onChange={(e) => {
            const tool = tools.find((t) => t.name === e.target.value);
            setSelectedTool(tool || null);
            setParameters({});
          }}
          disabled={isLoading}
        >
          <option value="">-- Choose a tool --</option>
          {tools.map((tool) => (
            <option key={tool.name} value={tool.name}>
              {tool.name} ({tool.category})
            </option>
          ))}
        </select>
      </div>

      {selectedTool && (
        <>
          <div>
            <div className="text-xs text-muted-foreground mb-2">
              {selectedTool.description}
            </div>
          </div>

          {selectedTool.parameters?.properties && (
            <div className="space-y-3">
              <div className="text-sm font-medium">Parameters:</div>
              {Object.entries(selectedTool.parameters.properties).map(
                ([key, schema]: [string, any]) => (
                  <div key={key}>
                    <label className="text-xs font-medium mb-1 block">
                      {key}
                      {selectedTool.parameters.required?.includes(key) && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                      placeholder={schema.description}
                      value={parameters[key] || ''}
                      onChange={(e) =>
                        setParameters({ ...parameters, [key]: e.target.value })
                      }
                      disabled={isLoading}
                    />
                  </div>
                )
              )}
            </div>
          )}

          <button
            onClick={handleExecute}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <Code className="w-4 h-4" />
                <span>Execute Tool</span>
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
