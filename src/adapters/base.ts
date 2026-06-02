/**
 * LLM 适配器接口
 * 所有模型适配器必须实现此接口
 */

import type { Message, ToolDefinition, ToolResult } from "../agent/types";

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

export interface LLMAdapter {
  /** 模型名称 */
  readonly name: string;

  /** 基础对话 */
  chat(messages: Message[], systemPrompt?: string): Promise<LLMResponse>;

  /** 带工具调用的对话 */
  chatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    systemPrompt?: string
  ): Promise<LLMResponse>;
}
