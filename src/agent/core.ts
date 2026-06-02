/**
 * Agent 主循环
 * 接收用户输入 → 调用 LLM → 处理 Tool Use → 输出回复
 */

import type { LLMAdapter, LLMResponse } from "../adapters/base";
import type { Message, ToolDefinition, ToolResult, SessionContext } from "./types";
import type { HookRegistry } from "../hooks/registry";

const SYSTEM_PROMPT = `你是 prou5t，一个回忆助手。

你的职责是倾听用户回忆过去的事情，并在合适的时候帮助他们把这些回忆记录成日记。

注意：
- 只有用户讲述的"过去的事"（跨天以上）才会被提取为日记
- 当天的事情不算回忆，不记录
- 你应该像一个耐心的倾听者，引导用户讲述更多细节`;

export interface AgentCoreOptions {
  adapter: LLMAdapter;
  hooks: HookRegistry;
  tools?: ToolDefinition[];
  toolExecutor?: (name: string, args: Record<string, unknown>) => Promise<ToolResult>;
}

export class AgentCore {
  private adapter: LLMAdapter;
  private hooks: HookRegistry;
  private tools: ToolDefinition[];
  private toolExecutor?: (name: string, args: Record<string, unknown>) => Promise<ToolResult>;
  private ctx: SessionContext;

  constructor(options: AgentCoreOptions) {
    this.adapter = options.adapter;
    this.hooks = options.hooks;
    this.tools = options.tools ?? [];
    this.toolExecutor = options.toolExecutor;

    this.ctx = {
      sessionId: crypto.randomUUID(),
      model: options.adapter.name,
      messages: [],
      metadata: {},
    };
  }

  get context(): SessionContext {
    return this.ctx;
  }

  /** 处理一条用户消息，返回 AI 回复 */
  async processInput(userMessage: string): Promise<string> {
    // 记录用户消息
    const userMsg: Message = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    this.ctx.messages.push(userMsg);

    // 触发 afterUserMessage hook
    await this.hooks.trigger("afterUserMessage", this.ctx, userMessage);

    // 调用 LLM
    let response: LLMResponse;
    if (this.tools.length > 0 && this.toolExecutor) {
      response = await this.adapter.chatWithTools(
        this.ctx.messages,
        this.tools,
        SYSTEM_PROMPT,
      );
    } else {
      response = await this.adapter.chat(this.ctx.messages, SYSTEM_PROMPT);
    }

    // 处理 Tool Use
    if (response.toolCalls && response.toolCalls.length > 0 && this.toolExecutor) {
      for (const call of response.toolCalls) {
        const result = await this.toolExecutor(call.name, call.arguments);
        // 将工具结果加入消息，再次调用 LLM
        response = await this.handleToolResult(result);
      }
    }

    // 记录助手回复
    const assistantMsg: Message = {
      role: "assistant",
      content: response.content,
      timestamp: new Date(),
    };
    this.ctx.messages.push(assistantMsg);

    // 触发 afterAssistantMessage hook
    await this.hooks.trigger("afterAssistantMessage", this.ctx, response.content);

    return response.content;
  }

  /** 结束会话 */
  async endSession(): Promise<void> {
    await this.hooks.trigger("afterConversationEnd", this.ctx);
  }

  /** 处理工具调用结果，获取 LLM 后续回复 */
  private async handleToolResult(result: ToolResult): Promise<LLMResponse> {
    // 将工具调用和结果加入消息历史
    const toolMessage: Message = {
      role: "user", // 工具结果以 user 角色送回（简化处理）
      content: `[Tool: ${result.name}] ${result.result}`,
      timestamp: new Date(),
    };
    this.ctx.messages.push(toolMessage);

    // 再次调用 LLM 获取最终回复
    if (this.tools.length > 0) {
      return await this.adapter.chatWithTools(
        this.ctx.messages,
        this.tools,
        SYSTEM_PROMPT,
      );
    }
    return await this.adapter.chat(this.ctx.messages, SYSTEM_PROMPT);
  }
}
