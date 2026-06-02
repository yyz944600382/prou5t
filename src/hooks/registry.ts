/**
 * Hook 注册中心
 */

import type { SessionContext } from "../agent/types";
import type { Hook, HookEvent } from "./types";

export class HookRegistry {
  private hooks: Hook[] = [];

  register(hook: Hook): void {
    this.hooks.push(hook);
  }

  async trigger(
    event: HookEvent,
    ctx: SessionContext,
    extra?: string,
  ): Promise<void> {
    for (const hook of this.hooks) {
      try {
        switch (event) {
          case "beforeConversation":
            await hook.beforeConversation?.(ctx);
            break;
          case "afterUserMessage":
            await hook.afterUserMessage?.(ctx, extra ?? "");
            break;
          case "afterAssistantMessage":
            await hook.afterAssistantMessage?.(ctx, extra ?? "");
            break;
          case "afterConversationEnd":
            await hook.afterConversationEnd?.(ctx);
            break;
        }
      } catch (err) {
        console.error(`[Hook Error] ${hook.name}.${event}:`, err);
      }
    }
  }
}
