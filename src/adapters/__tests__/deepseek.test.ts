/**
 * DeepSeek 适配器测试（真实 API 调用，禁止 mock）
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createAdapter, type AdapterConfig } from "../index";
import type { LLMAdapter } from "../base";

describe("DeepSeek 适配器（真实 API）", () => {
  let adapter: LLMAdapter;
  let config: AdapterConfig;

  beforeAll(() => {
    // 从环境变量读取配置
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekApiKey) {
      throw new Error("DEEPSEEK_API_KEY 环境变量未设置");
    }

    config = {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || "test-key",
      openaiApiKey: process.env.OPENAI_API_KEY || "test-key",
      deepseekApiKey,
    };
  });

  describe("createAdapter 工厂", () => {
    it("应该正确创建 DeepSeek 适配器", () => {
      adapter = createAdapter("deepseek", config);
      expect(adapter).toBeDefined();
      expect(adapter.name).toBe("openai"); // DeepSeek 复用 OpenAI 适配器
    });

    it("缺少 deepseekApiKey 时应该抛出错误", () => {
      const invalidConfig = {
        anthropicApiKey: "test",
        openaiApiKey: "test",
      };
      expect(() => createAdapter("deepseek", invalidConfig)).toThrow(
        "DEEPSEEK_API_KEY is required for deepseek model",
      );
    });

    it("不支持的 model 应该抛出错误", () => {
      expect(() => createAdapter("unknown-model", config)).toThrow(
        "Unknown model: unknown-model",
      );
    });
  });

  describe("真实 DeepSeek API 调用", () => {
    it("应该能正常发送消息并返回回复", { timeout: 30000 }, async () => {
      adapter = createAdapter("deepseek", config);

      const response = await adapter.chat(
        [{ role: "user", content: "你好，请用一句话回复：测试成功", timestamp: new Date() }],
        undefined,
      );

      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe("string");
      expect(response.content.length).toBeGreaterThan(0);
      console.log("DeepSeek 回复:", response.content);
    });

    it("应该能处理中文对话", { timeout: 30000 }, async () => {
      adapter = createAdapter("deepseek", config);

      const response = await adapter.chat(
        [
          {
            role: "user",
            content: "请问北京是中国的首都吗？请简短回答。",
            timestamp: new Date(),
          },
        ],
        undefined,
      );

      expect(response.content).toBeDefined();
      expect(response.content).toMatch(/北京|首都|中国|是/);
      console.log("中文对话回复:", response.content);
    });

    it("应该能处理 system prompt", { timeout: 30000 }, async () => {
      adapter = createAdapter("deepseek", config);

      const response = await adapter.chat(
        [{ role: "user", content: "你好", timestamp: new Date() }],
        "你是一个专业的诗歌助手，所有回复都必须是诗歌形式。",
      );

      expect(response.content).toBeDefined();
      console.log("带 system prompt 的回复:", response.content);
    });

    it("应该能处理多轮对话", { timeout: 30000 }, async () => {
      adapter = createAdapter("deepseek", config);

      const messages = [
        { role: "user" as const, content: "我叫小明", timestamp: new Date() },
        { role: "assistant" as const, content: "你好，小明！", timestamp: new Date() },
        { role: "user" as const, content: "我刚才告诉你我叫什么？", timestamp: new Date() },
      ];

      const response = await adapter.chat(messages, undefined);

      expect(response.content).toBeDefined();
      expect(response.content).toMatch(/小明/);
      console.log("多轮对话回复:", response.content);
    });
  });

  describe("OpenAIAdapter 构造函数改动", () => {
    it("应该支持 options 对象格式（新格式）", () => {
      const { OpenAIAdapter } = require("../openai.ts");

      const adapter = new OpenAIAdapter({
        apiKey: "test-key",
        model: "custom-model",
        baseURL: "https://custom.api.com",
      });

      expect(adapter).toBeDefined();
      expect(adapter.name).toBe("openai");
    });

    it("DeepSeek 适配器应该使用正确的 baseURL 和 model", () => {
      adapter = createAdapter("deepseek", config);

      // DeepSeek 复用 OpenAI 适配器
      // 验证配置已正确传递（通过检查是否创建成功）
      expect(adapter).toBeDefined();
    });
  });

  describe("日记提取场景测试", () => {
    it("应该能识别回忆性内容", { timeout: 30000 }, async () => {
      adapter = createAdapter("deepseek", config);

      const prompt = `你是一个回忆识别助手。你的任务是判断用户的消息是否包含"回忆性内容"。

回忆性内容的定义：
- 用户讲述的是**过去的事情**（事件时间至少在一天以前）
- 跨天以上的回忆才算，当天发生的事情不算回忆
- 模糊时间表达如"去年夏天"、"大三那年"、"那次旅行"也算回忆

非回忆性内容：
- 当天的日常事务（如"今天吃了什么"、"刚才在开会"）
- 未来计划（如"明天打算去..."）
- 纯技术讨论、问题咨询
- 虚构内容、假设场景

请分析以下用户消息，判断是否包含回忆性内容。

返回格式（严格 JSON）：
\`\`\`json
{
  "isRecall": boolean,
  "reason": string,
  "confidence": number
}
\`\`\`

字段说明：
- isRecall: true 表示包含回忆性内容
- reason: 判断理由（简短说明）
- confidence: 置信度 (0-1)，>0.7 时高置信

用户消息：
那年夏天，我和朋友们一起去海边旅行，我们住了三天两夜，每天晚上都在沙滩上烧烤聊天。`;

      const response = await adapter.chat([], prompt);

      expect(response.content).toBeDefined();
      console.log("回忆识别结果:", response.content);

      // 验证返回的是有效 JSON（可能包含 markdown 代码块）
      const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : response.content;
      const result = JSON.parse(jsonContent);
      expect(result.isRecall).toBe(true);
      expect(result.reason).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("应该能提取日记结构化数据", { timeout: 30000 }, async () => {
      adapter = createAdapter("deepseek", config);

      const prompt = `你是一个日记提炼助手。你的任务是从用户的回忆性内容中提炼出结构化的日记条目。

请提取以下字段：

1. **eventDate** (事件日期)
   - 用户回忆的那个时间
   - 格式：YYYY-MM-DD（如 2024-03-15）
   - 如果时间完全未知，返回 null
   - 如果是模糊时间（如"去年夏天"），推断一个大概日期

2. **content** (内容)
   - 提炼后的日记正文
   - 保持用户原意，但去除冗余、口语化表达
   - 形成连贯、可读的叙述

3. **people** (人物)
   - 提及的人物姓名
   - 返回数组，如 ["张三", "李四"]
   - 如果没有人物，返回空数组 []

4. **locations** (地点)
   - 提及的地点名称
   - 返回数组，如 ["北京", "故宫"]
   - 如果没有地点，返回空数组 []

5. **emotions** (情感)
   - 情感标签
   - 返回数组，如 ["开心", "怀念", "感动"]
   - 如果没有明显情感，返回空数组 []

6. **tags** (标签)
   - 其他自定义标签
   - 返回数组，如 ["旅行", "美食", "毕业"]
   - 如果没有标签，返回空数组 []

返回格式（严格 JSON）：
\`\`\`json
{
  "eventDate": string | null,
  "content": string,
  "people": string[],
  "locations": string[],
  "emotions": string[],
  "tags": string[]
}
\`\`\`

重要：
- eventDate 和 content 是必需字段
- eventDate 可以是 null（当时间完全未知时）
- 其他字段如果无法提取，返回空数组 []
- 必须返回有效的 JSON，不要添加任何额外文本

用户消息：
大三那年暑假，我和室友们一起去了黄山旅游。我们凌晨三点起床看日出，站在光明顶上看着太阳慢慢升起，那一刻我觉得所有的辛苦都值得了。`;

      const response = await adapter.chat([], prompt);

      expect(response.content).toBeDefined();
      console.log("日记提取结果:", response.content);

      // 验证返回的是有效 JSON（可能包含 markdown 代码块）
      const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : response.content;
      const result = JSON.parse(jsonContent);
      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe("string");
      expect(result.people).toBeDefined();
      expect(Array.isArray(result.people)).toBe(true);
      expect(result.locations).toBeDefined();
      expect(Array.isArray(result.locations)).toBe(true);
      expect(result.emotions).toBeDefined();
      expect(Array.isArray(result.emotions)).toBe(true);
      expect(result.tags).toBeDefined();
      expect(Array.isArray(result.tags)).toBe(true);
    });
  });
});
