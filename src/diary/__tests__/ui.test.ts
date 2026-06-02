/**
 * Diary UI 测试
 *
 * 注意：@clack/prompts 必须保持 mock
 *
 * 原因：
 * 1. UI 交互需要用户输入（select/text prompts），无法在测试环境中自动化
 * 2. 这些是终端交互式组件，测试时没有真实的 TTY
 * 3. Mock 可以测试所有逻辑分支（confirm/modify/skip）
 *
 * 这与 LLM/Database 测试不同 - 后者可以用真实 API/数据库，
 * 但交互式 UI 在测试环境中必须 mock。
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { confirmExtraction } from "../ui";
import type { DiaryEntry } from "../types";
import * as p from "@clack/prompts";

// Mock @clack/prompts（必需：无法在测试环境中进行真实交互）
vi.mock("@clack/prompts", () => ({
  note: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  isCancel: vi.fn((value) => value === Symbol.for("canceled")),
}));

describe("confirmExtraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDiary: Omit<DiaryEntry, "id"> = {
    eventDate: "2024-03-15",
    createdAt: "2024-03-15T10:00:00.000Z",
    content: "今天和朋友们去了海边，玩得很开心。",
    people: ["张三", "李四"],
    locations: ["海滩"],
    emotions: ["开心", "放松"],
    tags: ["聚会", "户外"],
  };

  describe("用户选择确认", () => {
    it("用户选择 confirm 应该返回 confirm action", async () => {
      vi.mocked(p.select).mockResolvedValue("confirm" as const);

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("confirm");
      expect(p.note).toHaveBeenCalled();
    });

    it("应该展示完整的日记信息", async () => {
      vi.mocked(p.select).mockResolvedValue("confirm" as const);

      await confirmExtraction(mockDiary);

      const noteCalls = vi.mocked(p.note).mock.calls;
      expect(noteCalls.length).toBeGreaterThanOrEqual(2);

      // 检查第二次调用是否包含日记内容
      const contentCall = noteCalls[1]?.[0] as string;
      expect(contentCall).toContain("2024-03-15");
      expect(contentCall).toContain("今天和朋友们去了海边");
      expect(contentCall).toContain("张三");
      expect(contentCall).toContain("海滩");
    });
  });

  describe("用户选择跳过", () => {
    it("用户选择 skip 应该返回 skip action", async () => {
      vi.mocked(p.select).mockResolvedValue("skip" as const);

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("skip");
    });
  });

  describe("用户取消", () => {
    it("用户取消（Ctrl+C）应该返回 skip", async () => {
      const cancelSymbol = Symbol.for("canceled");
      vi.mocked(p.select).mockResolvedValue(cancelSymbol);

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("skip");
    });
  });

  describe("用户选择修改", () => {
    it("用户选择 modify 应该进入修改流程", async () => {
      // 第一次选择 modify，然后最终选择 confirm
      vi.mocked(p.select)
        .mockResolvedValueOnce("modify" as const)
        .mockResolvedValueOnce("confirm" as const);

      // Mock 所有 text 输入为空（保持原值）
      vi.mocked(p.text).mockResolvedValue("");

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("confirm");
      expect(result.diary).toBeDefined();
    });

    it("应该允许修改 eventDate", async () => {
      vi.mocked(p.select)
        .mockResolvedValueOnce("modify" as const)
        .mockResolvedValueOnce("confirm" as const);

      vi.mocked(p.text)
        .mockResolvedValueOnce("2024-12-25") // eventDate
        .mockResolvedValueOnce("") // content
        .mockResolvedValueOnce("") // people
        .mockResolvedValueOnce("") // locations
        .mockResolvedValueOnce("") // emotions
        .mockResolvedValueOnce(""); // tags

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("confirm");
      expect(result.diary?.eventDate).toBe("2024-12-25");
    });

    it("应该允许修改 content", async () => {
      vi.mocked(p.select)
        .mockResolvedValueOnce("modify" as const)
        .mockResolvedValueOnce("confirm" as const);

      const newContent = "修改后的日记内容";
      vi.mocked(p.text)
        .mockResolvedValueOnce("") // eventDate
        .mockResolvedValueOnce(newContent) // content
        .mockResolvedValueOnce("") // people
        .mockResolvedValueOnce("") // locations
        .mockResolvedValueOnce("") // emotions
        .mockResolvedValueOnce(""); // tags

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("confirm");
      expect(result.diary?.content).toBe(newContent);
    });

    it("应该允许修改 people（逗号分隔）", async () => {
      vi.mocked(p.select)
        .mockResolvedValueOnce("modify" as const)
        .mockResolvedValueOnce("confirm" as const);

      vi.mocked(p.text)
        .mockResolvedValueOnce("") // eventDate
        .mockResolvedValueOnce("") // content
        .mockResolvedValueOnce("王五,赵六") // people
        .mockResolvedValueOnce("") // locations
        .mockResolvedValueOnce("") // emotions
        .mockResolvedValueOnce(""); // tags

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("confirm");
      expect(result.diary?.people).toEqual(["王五", "赵六"]);
    });

    it("应该允许修改 locations（逗号分隔）", async () => {
      vi.mocked(p.select)
        .mockResolvedValueOnce("modify" as const)
        .mockResolvedValueOnce("confirm" as const);

      vi.mocked(p.text)
        .mockResolvedValueOnce("") // eventDate
        .mockResolvedValueOnce("") // content
        .mockResolvedValueOnce("") // people
        .mockResolvedValueOnce("山,湖") // locations
        .mockResolvedValueOnce("") // emotions
        .mockResolvedValueOnce(""); // tags

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("confirm");
      expect(result.diary?.locations).toEqual(["山", "湖"]);
    });

    it("应该允许修改 emotions（逗号分隔）", async () => {
      vi.mocked(p.select)
        .mockResolvedValueOnce("modify" as const)
        .mockResolvedValueOnce("confirm" as const);

      vi.mocked(p.text)
        .mockResolvedValueOnce("") // eventDate
        .mockResolvedValueOnce("") // content
        .mockResolvedValueOnce("") // people
        .mockResolvedValueOnce("") // locations
        .mockResolvedValueOnce("感动,怀念") // emotions
        .mockResolvedValueOnce(""); // tags

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("confirm");
      expect(result.diary?.emotions).toEqual(["感动", "怀念"]);
    });

    it("应该允许修改 tags（逗号分隔）", async () => {
      vi.mocked(p.select)
        .mockResolvedValueOnce("modify" as const)
        .mockResolvedValueOnce("confirm" as const);

      vi.mocked(p.text)
        .mockResolvedValueOnce("") // eventDate
        .mockResolvedValueOnce("") // content
        .mockResolvedValueOnce("") // people
        .mockResolvedValueOnce("") // locations
        .mockResolvedValueOnce("") // emotions
        .mockResolvedValueOnce("回忆,往事"); // tags

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("confirm");
      expect(result.diary?.tags).toEqual(["回忆", "往事"]);
    });

    it("修改时输入为空应该保持原值", async () => {
      vi.mocked(p.select)
        .mockResolvedValueOnce("modify" as const)
        .mockResolvedValueOnce("confirm" as const);

      vi.mocked(p.text).mockResolvedValue("");

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("confirm");
      expect(result.diary?.eventDate).toBe(mockDiary.eventDate);
      expect(result.diary?.content).toBe(mockDiary.content);
      expect(result.diary?.people).toEqual(mockDiary.people);
    });

    it("修改时取消应该返回 skip", async () => {
      const cancelSymbol = Symbol.for("canceled");
      vi.mocked(p.select).mockResolvedValueOnce("modify" as const);
      vi.mocked(p.text).mockResolvedValueOnce(cancelSymbol);

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("skip");
    });

    it("修改完成后选择 skip 应该返回 skip", async () => {
      vi.mocked(p.select)
        .mockResolvedValueOnce("modify" as const)
        .mockResolvedValueOnce("skip" as const);

      vi.mocked(p.text).mockResolvedValue("");

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("skip");
    });
  });

  describe("边界情况", () => {
    it("应该处理没有 eventDate 的日记", async () => {
      const diaryNoDate: Omit<DiaryEntry, "id"> = {
        ...mockDiary,
        eventDate: undefined,
      };
      vi.mocked(p.select).mockResolvedValue("confirm" as const);

      await confirmExtraction(diaryNoDate);

      const noteCalls = vi.mocked(p.note).mock.calls;
      const contentCall = noteCalls[1]?.[0] as string;
      expect(contentCall).toContain("事件时间: 未知");
    });

    it("应该处理没有可选字段的日记", async () => {
      const minimalDiary: Omit<DiaryEntry, "id"> = {
        eventDate: "2024-01-01",
        createdAt: "2024-01-01T00:00:00.000Z",
        content: "一条简单的日记",
      };
      vi.mocked(p.select).mockResolvedValue("confirm" as const);

      const result = await confirmExtraction(minimalDiary);
      expect(result.action).toBe("confirm");
    });

    it("应该正确处理逗号分隔输入中的空格", async () => {
      vi.mocked(p.select)
        .mockResolvedValueOnce("modify" as const)
        .mockResolvedValueOnce("confirm" as const);

      vi.mocked(p.text)
        .mockResolvedValueOnce("") // eventDate
        .mockResolvedValueOnce("") // content
        .mockResolvedValueOnce("A, B , C") // people with spaces
        .mockResolvedValueOnce("") // locations
        .mockResolvedValueOnce("") // emotions
        .mockResolvedValueOnce(""); // tags

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("confirm");
      expect(result.diary?.people).toEqual(["A", "B", "C"]);
    });

    it("应该过滤空字符串（逗号分隔输入）", async () => {
      vi.mocked(p.select)
        .mockResolvedValueOnce("modify" as const)
        .mockResolvedValueOnce("confirm" as const);

      vi.mocked(p.text)
        .mockResolvedValueOnce("") // eventDate
        .mockResolvedValueOnce("") // content
        .mockResolvedValueOnce("A,,B,") // people with empty parts
        .mockResolvedValueOnce("") // locations
        .mockResolvedValueOnce("") // emotions
        .mockResolvedValueOnce(""); // tags

      const result = await confirmExtraction(mockDiary);
      expect(result.action).toBe("confirm");
      expect(result.diary?.people).toEqual(["A", "B"]);
    });
  });
});
