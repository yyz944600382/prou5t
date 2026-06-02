/**
 * OpenAI 适配器
 */

import OpenAI from "openai";
import type { LLMAdapter, LLMResponse } from "./base";
import type { Message, ToolDefinition } from "../agent/types";

export interface OpenAIAdapterOptions {
  /** API Key */
  apiKey: string;
  /** 模型名称 (默认 gpt-4o) */
  model?: string;
  /** API Base URL (可选，用于兼容 OpenAI 格式的 API) */
  baseURL?: string;
}

export class OpenAIAdapter implements LLMAdapter {
  readonly name = "openai";
  private client: OpenAI;
  private modelName: string;

  constructor(options: OpenAIAdapterOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
    this.modelName = options.model ?? "gpt-4o";
  }

  async chat(messages: Message[], systemPrompt?: string): Promise<LLMResponse> {
    const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      allMessages.push({ role: "system", content: systemPrompt });
    }

    for (const m of messages) {
      if (m.role === "system") continue; // system 由 systemPrompt 单独传入
      allMessages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    }

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: allMessages,
    });

    return {
      content: response.choices[0]?.message?.content ?? "",
    };
  }

  async chatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    systemPrompt?: string,
  ): Promise<LLMResponse> {
    const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      allMessages.push({ role: "system", content: systemPrompt });
    }

    for (const m of messages) {
      if (m.role === "system") continue; // system 由 systemPrompt 单独传入
      allMessages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    }

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: allMessages,
      tools: tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
    });

    const choice = response.choices[0];
    const message = choice?.message;

    return {
      content: message?.content ?? "",
      toolCalls:
        message?.tool_calls
          ?.filter((tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall =>
            "function" in tc
          )
          .map((tc) => ({
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments) as Record<
              string,
              unknown
            >,
          })) ?? undefined,
    };
  }
}
