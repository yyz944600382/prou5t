/**
 * Hook 系统类型定义
 */

import type { SessionContext } from "../agent/types";

export interface Hook {
  name: string;

  /** 会话开始前 */
  beforeConversation?(ctx: SessionContext): Promise<void>;

  /** 用户消息后 */
  afterUserMessage?(ctx: SessionContext, message: string): Promise<void>;

  /** AI 回复后 */
  afterAssistantMessage?(ctx: SessionContext, message: string): Promise<void>;

  /** 会话结束时 */
  afterConversationEnd?(ctx: SessionContext): Promise<void>;
}

export type HookEvent =
  | "beforeConversation"
  | "afterUserMessage"
  | "afterAssistantMessage"
  | "afterConversationEnd";
