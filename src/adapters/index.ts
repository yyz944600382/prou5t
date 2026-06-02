/**
 * LLM 适配器工厂
 */

import type { LLMAdapter } from "./base";
import { ClaudeAdapter } from "./claude";
import { OpenAIAdapter } from "./openai";

export function createAdapter(
  model: string,
  config: { anthropicApiKey: string; openaiApiKey: string },
): LLMAdapter {
  switch (model) {
    case "claude":
      return new ClaudeAdapter(config.anthropicApiKey);
    case "openai":
      return new OpenAIAdapter(config.openaiApiKey);
    default:
      throw new Error(`Unknown model: ${model}. Supported: claude, openai`);
  }
}

export { ClaudeAdapter, OpenAIAdapter };
