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
    extra?: string
  ): Promise<void> {
    for (const hook of this.hooks) {
      const fn = hook[event];
      if (fn) {
        try {
          if (event === "afterUserMessage" || event === "afterAssistantMessage") {
            await fn.call(hook, ctx, extra);
          } else {
            await fn.call(hook, ctx);
          }
        } catch (err) {
          console.error(`[Hook Error] ${hook.name}.${event}:`, err);
        }
      }
    }
  }
}
