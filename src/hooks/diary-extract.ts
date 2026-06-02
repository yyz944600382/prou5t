/**
 * 日记提取 Hook
 * 在 afterUserMessage 触发，负责协调识别 → 累积 → 提炼 → 确认 → 存储
 */

import type { Hook } from "./types";
import type { SessionContext } from "../agent/types";
import type { LLMAdapter } from "../adapters/base";
import { DiaryExtractor } from "../diary/extractor";
import { DiaryRepository } from "../storage/diary-repository";
import { confirmExtraction } from "../diary/ui";

/**
 * 日记提取 Hook 配置
 */
interface DiaryExtractHookOptions {
  /** LLM 适配器 */
  adapter: LLMAdapter;
}

/**
 * 日记提取 Hook 实现
 */
export class DiaryExtractHook implements Hook {
  name = "DiaryExtractHook";

  private extractor: DiaryExtractor;
  private repository: DiaryRepository;
  private messageBuffer: string[] = [];
  private isProcessing = false;

  constructor(options: DiaryExtractHookOptions) {
    this.extractor = new DiaryExtractor(options.adapter);
    this.repository = new DiaryRepository();
  }

  /**
   * 用户消息后触发
   */
  async afterUserMessage(ctx: SessionContext, message: string): Promise<void> {
    // 如果正在处理，跳过（避免并发）
    if (this.isProcessing) {
      this.messageBuffer.push(message);
      return;
    }

    try {
      this.isProcessing = true;

      // 累积消息
      const { accumulated, ready } = this.extractor.accumulate(
        message,
        this.messageBuffer,
      );

      this.messageBuffer = accumulated;

      if (!ready) {
        return; // 还没准备好提取
      }

      // 识别是否为回忆
      const detection = await this.extractor.isRecall(this.messageBuffer);

      if (!detection.isRecall || detection.confidence < 0.7) {
        // 不是回忆，清空缓冲
        this.messageBuffer = [];
        return;
      }

      // 提取结构化日记
      const extraction = await this.extractor.extract(this.messageBuffer);

      // 转换为 DiaryEntry
      const diary = this.extractor.toDiaryEntry(extraction);

      // 用户确认
      const confirmation = await confirmExtraction(diary);

      if (confirmation.action === "skip") {
        // 用户跳过，清空缓冲
        this.messageBuffer = [];
        return;
      }

      // 保存到数据库
      const diaryToSave =
        confirmation.action === "confirm" && confirmation.diary
          ? confirmation.diary
          : diary;

      this.repository.save(diaryToSave);

      // 清空缓冲
      this.messageBuffer = [];
    } catch (error) {
      // 优雅降级：不影响主对话
      console.error("[DiaryExtractHook] error:", error);
      // 清空缓冲，避免重复处理
      this.messageBuffer = [];
    } finally {
      this.isProcessing = false;
    }
  }
}

/**
 * 创建日记提取 Hook
 *
 * @param adapter - LLM 适配器
 * @returns Hook 实例
 */
export function createDiaryExtractHook(adapter: LLMAdapter): Hook {
  return new DiaryExtractHook({ adapter });
}
