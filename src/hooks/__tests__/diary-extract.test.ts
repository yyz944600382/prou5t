/**
 * DiaryExtractHook 测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { DiaryExtractHook } from "../diary-extract";
import type { SessionContext } from "../../agent/types";
import type { LLMAdapter } from "../../adapters/base";
import type { LLMResponse } from "../../adapters/base";
import type { DiaryEntry } from "../../diary/types";
import { DiaryRepository } from "../../storage/diary-repository";
import { initDatabase, closeDatabase } from "../../storage/database";
import * as DiaryModule from "../../diary/ui";

// Mock dependencies
vi.mock("../../storage/diary-repository", () => ({
  DiaryRepository: vi.fn(),
}));

vi.mock("../../diary/ui", () => ({
  confirmExtraction: vi.fn(),
}));

describe("DiaryExtractHook", () => {
  let mockAdapter: LLMAdapter;
  let mockRepository: DiaryRepository;
  let hook: DiaryExtractHook;
  let ctx: SessionContext;

  beforeEach(() => {
    // 初始化测试数据库
    closeDatabase();
    initDatabase("test-data-hook");

    // 创建 mock adapter
    mockAdapter = {
      name: "mock-adapter",
      chat: vi.fn(),
      chatWithTools: vi.fn(),
    };

    // 创建 mock repository
    mockRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as DiaryRepository;
    vi.mocked(DiaryRepository).mockImplementation(() => mockRepository);

    // 创建 hook 实例
    hook = new DiaryExtractHook({ adapter: mockAdapter });

    // 创建 mock context
    ctx = {} as SessionContext;

    vi.clearAllMocks();
  });

  afterEach(() => {
    closeDatabase();
  });

  describe("基础流程", () => {
    it("应该在消息累积满足条件后触发提取", async () => {
      // Mock isRecall 和 extract 返回不同结果
      vi.mocked(mockAdapter.chat)
        .mockResolvedValueOnce({
          content: `{"isRecall": true, "reason": "回忆", "confidence": 0.9}`,
        } as LLMResponse)
        .mockResolvedValueOnce({
          content: `{
  "eventDate": "2024-03-15",
  "content": "测试回忆",
  "people": [],
  "locations": [],
  "emotions": [],
  "tags": []
}`,
        } as LLMResponse);

      // Mock 用户确认
      vi.mocked(DiaryModule.confirmExtraction).mockResolvedValue({
        action: "confirm",
      });

      // 发送长消息触发提取
      const longMessage = "A".repeat(201);
      await hook.afterUserMessage(ctx, longMessage);

      expect(DiaryModule.confirmExtraction).toHaveBeenCalled();
    });

    it("短消息不应该触发提取", async () => {
      await hook.afterUserMessage(ctx, "短消息");

      expect(mockAdapter.chat).not.toHaveBeenCalled();
      expect(DiaryModule.confirmExtraction).not.toHaveBeenCalled();
    });

    it("三条消息应该触发提取", async () => {
      vi.mocked(mockAdapter.chat).mockResolvedValue({
        content: `{"isRecall": true, "reason": "回忆", "confidence": 0.9}`,
      } as LLMResponse);

      await hook.afterUserMessage(ctx, "消息1");
      await hook.afterUserMessage(ctx, "消息2");
      await hook.afterUserMessage(ctx, "消息3");

      expect(mockAdapter.chat).toHaveBeenCalled();
    });
  });

  describe("回忆识别", () => {
    it("不是回忆时不应该提取", async () => {
      vi.mocked(mockAdapter.chat).mockResolvedValue({
        content: `{"isRecall": false, "reason": "日常", "confidence": 0.9}`,
      } as LLMResponse);

      const longMessage = "A".repeat(201);
      await hook.afterUserMessage(ctx, longMessage);

      expect(DiaryModule.confirmExtraction).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it("置信度 < 0.7 时不应该提取", async () => {
      vi.mocked(mockAdapter.chat).mockResolvedValue({
        content: `{"isRecall": true, "reason": "回忆", "confidence": 0.6}`,
      } as LLMResponse);

      const longMessage = "A".repeat(201);
      await hook.afterUserMessage(ctx, longMessage);

      expect(DiaryModule.confirmExtraction).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it("识别为回忆时应该提取", async () => {
      vi.mocked(mockAdapter.chat)
        .mockResolvedValueOnce({
          content: `{"isRecall": true, "reason": "回忆", "confidence": 0.9}`,
        } as LLMResponse)
        .mockResolvedValueOnce({
          content: `{
  "eventDate": "2024-01-01",
  "content": "回忆内容",
  "people": [],
  "locations": [],
  "emotions": [],
  "tags": []
}`,
        } as LLMResponse);

      vi.mocked(DiaryModule.confirmExtraction).mockResolvedValue({
        action: "confirm",
      });

      const longMessage = "A".repeat(201);
      await hook.afterUserMessage(ctx, longMessage);

      expect(DiaryModule.confirmExtraction).toHaveBeenCalled();
    });
  });

  describe("用户确认流程", () => {
    beforeEach(() => {
      vi.mocked(mockAdapter.chat)
        .mockResolvedValueOnce({
          content: `{"isRecall": true, "reason": "回忆", "confidence": 0.9}`,
        } as LLMResponse)
        .mockResolvedValueOnce({
          content: `{
  "eventDate": "2024-01-01",
  "content": "回忆内容",
  "people": [],
  "locations": [],
  "emotions": [],
  "tags": []
}`,
        } as LLMResponse);
    });

    it("用户确认应该保存日记", async () => {
      vi.mocked(DiaryModule.confirmExtraction).mockResolvedValue({
        action: "confirm",
      });
      vi.mocked(mockRepository.save).mockReturnValue("test-id");

      const longMessage = "A".repeat(201);
      await hook.afterUserMessage(ctx, longMessage);

      expect(mockRepository.save).toHaveBeenCalled();
    });

    it("用户跳过不应该保存日记", async () => {
      vi.mocked(DiaryModule.confirmExtraction).mockResolvedValue({
        action: "skip",
      });

      const longMessage = "A".repeat(201);
      await hook.afterUserMessage(ctx, longMessage);

      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it("用户修改后确认应该保存修改后的日记", async () => {
      const modifiedDiary: Omit<DiaryEntry, "id"> = {
        eventDate: "2024-12-25",
        createdAt: "2024-12-25T00:00:00.000Z",
        content: "修改后的内容",
        people: ["新人物"],
        locations: ["新地点"],
        emotions: ["新情感"],
        tags: ["新标签"],
      };
      vi.mocked(DiaryModule.confirmExtraction).mockResolvedValue({
        action: "confirm",
        diary: modifiedDiary,
      });
      vi.mocked(mockRepository.save).mockReturnValue("test-id");

      const longMessage = "A".repeat(201);
      await hook.afterUserMessage(ctx, longMessage);

      expect(mockRepository.save).toHaveBeenCalledWith(modifiedDiary);
    });
  });

  describe("错误处理", () => {
    it("LLM 错误应该优雅降级不影响主流程", async () => {
      vi.mocked(mockAdapter.chat).mockRejectedValue(new Error("API error"));

      const longMessage = "A".repeat(201);
      await expect(
        hook.afterUserMessage(ctx, longMessage),
      ).resolves.toBeUndefined();

      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it("extract 错误应该优雅降级", async () => {
      vi.mocked(mockAdapter.chat)
        .mockResolvedValueOnce({
          content: `{"isRecall": true, "reason": "回忆", "confidence": 0.9}`,
        } as LLMResponse)
        .mockRejectedValueOnce(new Error("Extract error"));

      const longMessage = "A".repeat(201);
      await expect(
        hook.afterUserMessage(ctx, longMessage),
      ).resolves.toBeUndefined();
    });

    it("用户确认错误应该优雅降级", async () => {
      vi.mocked(mockAdapter.chat)
        .mockResolvedValueOnce({
          content: `{"isRecall": true, "reason": "回忆", "confidence": 0.9}`,
        } as LLMResponse)
        .mockResolvedValueOnce({
          content: `{"eventDate": null, "content": "test", "people": [], "locations": [], "emotions": [], "tags": []}`,
        } as LLMResponse);

      vi.mocked(DiaryModule.confirmExtraction).mockRejectedValue(
        new Error("UI error"),
      );

      const longMessage = "A".repeat(201);
      await expect(
        hook.afterUserMessage(ctx, longMessage),
      ).resolves.toBeUndefined();
    });
  });

  describe("消息累积", () => {
    it("应该累积多条消息", async () => {
      vi.mocked(mockAdapter.chat).mockResolvedValue({
        content: `{"isRecall": true, "reason": "回忆", "confidence": 0.9}`,
      } as LLMResponse);

      // 发送三条消息触发
      await hook.afterUserMessage(ctx, "消息1");
      await hook.afterUserMessage(ctx, "消息2");
      await hook.afterUserMessage(ctx, "消息3");

      expect(mockAdapter.chat).toHaveBeenCalled();
      // 验证 prompt 包含所有消息
      const calls = vi.mocked(mockAdapter.chat).mock.calls;
      const prompt = calls[0]?.[1] as string;
      expect(prompt).toContain("消息1");
      expect(prompt).toContain("消息2");
      expect(prompt).toContain("消息3");
    });

    it("提取成功后应该清空缓冲", async () => {
      vi.mocked(mockAdapter.chat).mockResolvedValue({
        content: `{"isRecall": true, "reason": "回忆", "confidence": 0.9}`,
      } as LLMResponse);
      vi.mocked(DiaryModule.confirmExtraction).mockResolvedValue({
        action: "confirm",
      });

      // 发送长消息触发
      const longMessage = "A".repeat(201);
      await hook.afterUserMessage(ctx, longMessage);

      // 再次发送短消息（应该不触发）
      vi.mocked(mockAdapter.chat).mockClear();
      await hook.afterUserMessage(ctx, "新消息");

      expect(mockAdapter.chat).not.toHaveBeenCalled();
    });

    it("不是回忆时应该清空缓冲", async () => {
      vi.mocked(mockAdapter.chat).mockResolvedValue({
        content: `{"isRecall": false, "reason": "日常", "confidence": 0.9}`,
      } as LLMResponse);

      const longMessage = "A".repeat(201);
      await hook.afterUserMessage(ctx, longMessage);

      // 验证缓冲已清空
      vi.mocked(mockAdapter.chat).mockClear();
      await hook.afterUserMessage(ctx, "新消息");

      expect(mockAdapter.chat).not.toHaveBeenCalled();
    });
  });
});
