/**
 * prou5t - 回忆助手
 * 核心类型定义
 */

/** 会话上下文 */
export interface SessionContext {
  sessionId: string;
  model: string;
  messages: Message[];
  metadata: Record<string, unknown>;
}

/** 消息 */
export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

/** 工具定义 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** 工具调用结果 */
export interface ToolResult {
  name: string;
  result: string;
  success: boolean;
}
