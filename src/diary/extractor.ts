/**
 * 日记提取器
 * 负责识别回忆性内容并结构化提取
 */

import type { DiaryEntry } from "./types";
import { RECALL_DETECTION_PROMPT, EXTRACTION_PROMPT } from "./prompts";
import type { LLMAdapter } from "../adapters/base";
import type { Message } from "../agent/types";

/**
 * 回忆识别结果
 */
export interface RecallDetectionResult {
  /** 是否为回忆 */
  isRecall: boolean;
  /** 判断理由 */
  reason: string;
  /** 置信度 (0-1) */
  confidence: number;
}

/**
 * 提取结果
 */
export interface ExtractionResult {
  /** 事件日期 (YYYY-MM-DD) */
  eventDate: string | null;
  /** 提炼后的内容 */
  content: string;
  /** 相关人物 */
  people: string[];
  /** 相关地点 */
  locations: string[];
  /** 情感标签 */
  emotions: string[];
  /** 其他标签 */
  tags: string[];
}

/**
 * 日记提取器类
 */
export class DiaryExtractor {
  constructor(private adapter: LLMAdapter) {}

  /**
   * 判断消息是否包含回忆性内容
   *
   * @param messages - 消息数组
   * @returns 识别结果
   */
  async isRecall(messages: string[]): Promise<RecallDetectionResult> {
    if (messages.length === 0) {
      return { isRecall: false, reason: "无消息内容", confidence: 1 };
    }

    const prompt = RECALL_DETECTION_PROMPT.replace(
      "{messages}",
      messages.join("\n"),
    );

    try {
      const response = await this.adapter.chat([], prompt);
      const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```/);

      if (!jsonMatch) {
        // 尝试直接解析 JSON
        return JSON.parse(response.content.trim()) as RecallDetectionResult;
      }

      return JSON.parse(jsonMatch[1]) as RecallDetectionResult;
    } catch (error) {
      console.error("[DiaryExtractor] isRecall error:", error);
      // 降级：返回非回忆，避免阻塞主对话
      return { isRecall: false, reason: "识别失败", confidence: 0 };
    }
  }

  /**
   * 结构化提取日记
   *
   * @param messages - 消息数组
   * @returns 提取结果
   */
  async extract(messages: string[]): Promise<ExtractionResult> {
    if (messages.length === 0) {
      throw new Error("无法从空消息中提取日记");
    }

    const prompt = EXTRACTION_PROMPT.replace(
      "{messages}",
      messages.join("\n"),
    );

    try {
      const response = await this.adapter.chat([], prompt);
      const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```/);

      let result: ExtractionResult;
      if (!jsonMatch) {
        result = JSON.parse(response.content.trim()) as ExtractionResult;
      } else {
        result = JSON.parse(jsonMatch[1]) as ExtractionResult;
      }

      // 验证必需字段
      if (!result.content || typeof result.content !== "string") {
        throw new Error("提取结果缺少 content 字段");
      }

      // 确保数组字段存在
      result.people ??= [];
      result.locations ??= [];
      result.emotions ??= [];
      result.tags ??= [];

      return result;
    } catch (error) {
      console.error("[DiaryExtractor] extract error:", error);
      throw error;
    }
  }

  /**
   * 累积消息，判断是否准备好提取
   *
   * @param message - 新消息
   * @param buffer - 当前累积缓冲
   * @returns 累积状态
   */
  accumulate(
    message: string,
    buffer: string[],
  ): { accumulated: string[]; ready: boolean } {
    // 简单策略：累积到一定长度或数量后触发
    // 更复杂的策略可以判断讲述是否"结束"

    const newBuffer = [...buffer, message];
    const totalLength = newBuffer.join("").length;

    // 触发条件：
    // 1. 总长度 > 200 字符（约一条完整回忆）
    // 2. 消息数 >= 3 条
    const ready = totalLength > 200 || newBuffer.length >= 3;

    return { accumulated: newBuffer, ready };
  }

  /**
   * 将提取结果转换为 DiaryEntry
   *
   * @param result - 提取结果
   * @returns DiaryEntry（不含 id）
   */
  toDiaryEntry(result: ExtractionResult): Omit<DiaryEntry, "id"> {
    return {
      eventDate: result.eventDate ?? undefined,
      createdAt: new Date().toISOString(),
      content: result.content,
      people: result.people.length > 0 ? result.people : undefined,
      locations: result.locations.length > 0 ? result.locations : undefined,
      emotions: result.emotions.length > 0 ? result.emotions : undefined,
      tags: result.tags.length > 0 ? result.tags : undefined,
    };
  }
}
