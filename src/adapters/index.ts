/**
 * LLM 适配器工厂
 */

import type { LLMAdapter } from "./base";
import { ClaudeAdapter } from "./claude";
import { OpenAIAdapter, type OpenAIAdapterOptions } from "./openai";

export interface AdapterConfig {
  anthropicApiKey: string;
  openaiApiKey: string;
  deepseekApiKey?: string;
}

export function createAdapter(
  model: string,
  config: AdapterConfig,
): LLMAdapter {
  switch (model) {
    case "claude":
      return new ClaudeAdapter(config.anthropicApiKey);
    case "openai":
      return new OpenAIAdapter({ apiKey: config.openaiApiKey });
    case "deepseek":
      if (!config.deepseekApiKey) {
        throw new Error("DEEPSEEK_API_KEY is required for deepseek model");
      }
      return new OpenAIAdapter({
        apiKey: config.deepseekApiKey,
        model: "deepseek-v4-pro",
        baseURL: "https://api.deepseek.com",
      });
    default:
      throw new Error(
        `Unknown model: ${model}. Supported: claude, openai, deepseek`,
      );
  }
}

export { ClaudeAdapter, OpenAIAdapter };
