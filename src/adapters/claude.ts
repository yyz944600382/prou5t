/**
 * Claude (Anthropic) 适配器
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMAdapter, LLMResponse } from "./base";
import type { Message, ToolDefinition } from "../agent/types";

export class ClaudeAdapter implements LLMAdapter {
  readonly name = "claude";
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(messages: Message[], systemPrompt?: string): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt ?? "你是 prou5t 回忆助手。",
      messages: messages
        .filter((m) => m.role !== "system") // system 由 systemPrompt 参数单独传入
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return {
      content: textBlock && "text" in textBlock ? textBlock.text : "",
    };
  }

  async chatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    systemPrompt?: string,
  ): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt ?? "你是 prou5t 回忆助手。",
      messages: messages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Tool.InputSchema,
      })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

    return {
      content: textBlock && "text" in textBlock ? textBlock.text : "",
      toolCalls:
        toolUseBlocks.length > 0
          ? toolUseBlocks.map((b) => ({
              name: (b as Anthropic.ToolUseBlock).name,
              arguments: (b as Anthropic.ToolUseBlock).input as Record<
                string,
                unknown
              >,
            }))
          : undefined,
    };
  }
}
