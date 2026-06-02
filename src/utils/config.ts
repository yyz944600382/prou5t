/**
 * 配置管理
 * 读取 .env 文件，提供统一配置访问
 */

import { config as dotenvConfig } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

dotenvConfig();

export interface AppConfig {
  /** 默认模型 */
  defaultModel: string;
  /** Anthropic API Key */
  anthropicApiKey: string;
  /** OpenAI API Key */
  openaiApiKey: string;
  /** DeepSeek API Key */
  deepseekApiKey: string;
  /** 数据目录 */
  dataDir: string;
}

let _config: AppConfig | null = null;

export function loadConfig(overrides?: { model?: string }): AppConfig {
  if (_config && !overrides) return _config;

  const dataDir = resolve(process.cwd(), "data");

  _config = {
    defaultModel: overrides?.model ?? process.env.DEFAULT_MODEL ?? "claude",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
    dataDir,
  };

  return _config;
}

export function getConfig(): AppConfig {
  if (!_config) return loadConfig();
  return _config;
}

/** 验证必需的配置项，返回缺失项列表 */
export function validateConfig(config: AppConfig): string[] {
  const missing: string[] = [];

  if (config.defaultModel === "claude" && !config.anthropicApiKey) {
    missing.push("ANTHROPIC_API_KEY");
  }
  if (config.defaultModel === "openai" && !config.openaiApiKey) {
    missing.push("OPENAI_API_KEY");
  }
  if (config.defaultModel === "deepseek" && !config.deepseekApiKey) {
    missing.push("DEEPSEEK_API_KEY");
  }

  return missing;
}
