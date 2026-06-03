/**
 * E2E 测试：S004 关键词检索端到端流程
 * 测试真实场景下的完整搜索流程
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { SearchRepository } from "../search-repository";
import { DiaryRepository } from "../../storage/diary-repository";
import { initDatabase, closeDatabase } from "../../storage/database";
import type { DiaryEntry } from "../../diary/types";
import { existsSync, rmSync } from "node:fs";

const TEST_DB_DIR = "test-data-search-e2e";

describe("E2E 测试：S004 关键词检索", () => {
  beforeAll(() => {
    // 使用临时数据库进行 E2E 测试
    initDatabase(TEST_DB_DIR);
  });

  afterAll(() => {
    closeDatabase();
    // 清理测试数据库
    if (existsSync(TEST_DB_DIR)) {
      try {
        rmSync(TEST_DB_DIR, { recursive: true, force: true });
      } catch {
        // 忽略清理错误
      }
    }
  });

  describe("完整搜索流程", () => {
    let searchRepo: SearchRepository;
    let diaryRepo: DiaryRepository;
    let testDiaryIds: string[];

    beforeAll(() => {
      searchRepo = new SearchRepository();
      diaryRepo = new DiaryRepository();

      // 创建测试数据集
      testDiaryIds = [
        diaryRepo.save({
          eventDate: "2024-07-15",
          content: "去年夏天和朋友一起去海边旅行，我们在沙滩上玩了一整天，还看了日落。那天的天气特别好，海风很舒服。",
          people: ["小明", "小红", "小刚"],
          locations: ["海边", "沙滩"],
          emotions: ["开心", "放松", "难忘"],
          tags: ["旅行", "夏天", "海滩", "朋友"],
        }),

        diaryRepo.save({
          eventDate: "2024-03-20",
          content: "今天去了奶奶家，她做了我最爱吃的红烧肉。味道好极了！奶奶还给我讲了以前的故事，感觉特别温馨。",
          people: ["奶奶"],
          locations: ["奶奶家"],
          emotions: ["温馨", "感动", "满足"],
          tags: ["家庭", "美食", "亲情", "奶奶"],
        }),

        diaryRepo.save({
          eventDate: "2024-12-25",
          content: "圣诞节和朋友们一起去了巴黎旅行，参观了埃菲尔铁塔和卢浮宫。巴黎的圣诞节氛围特别浓厚，街道上到处都是装饰。",
          people: ["朋友", "Tom", "Jerry"],
          locations: ["巴黎", "埃菲尔铁塔", "卢浮宫"],
          emotions: ["兴奋", "难忘", "开心"],
          tags: ["旅行", "圣诞节", "巴黎", "法国"],
        }),

        diaryRepo.save({
          eventDate: "2024-05-01",
          content: "五一假期和同事们去了黄山旅游，凌晨三点起床爬到光明顶看日出。虽然很累，但看到日出那一刻觉得一切都值得了。",
          people: ["同事", "老王", "小李"],
          locations: ["黄山", "光明顶"],
          emotions: ["感动", "满足", "累但值得"],
          tags: ["旅行", "登山", "日出", "五一"],
        }),

        diaryRepo.save({
          eventDate: "2024-02-14",
          content: "情人节和另一半一起去吃了法式晚餐，餐厅氛围很浪漫。还交换了礼物，感觉特别幸福。",
          people: ["另一半"],
          locations: ["法式餐厅"],
          emotions: ["幸福", "浪漫", "甜蜜"],
          tags: ["情人节", "爱情", "美食"],
        }),
      ];
    });

    it("场景1：搜索 '巴黎' 应该返回巴黎旅行的日记", () => {
      const results = searchRepo.search({ keyword: "巴黎" });

      expect(results.length).toBeGreaterThanOrEqual(1);
      const parisDiary = results.find((r) => r.diary.content.includes("巴黎"));
      expect(parisDiary).toBeDefined();
      expect(parisDiary!.diary.tags).toContain("巴黎");
    });

    it("场景2：搜索 '奶奶' 应该返回家庭相关的日记", () => {
      const results = searchRepo.search({ keyword: "奶奶" });

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].diary.people).toContain("奶奶");
      expect(results[0].diary.content).toContain("奶奶");
    });

    it("场景3：搜索 '旅行' 应该返回多条旅行日记", () => {
      const results = searchRepo.search({ keyword: "旅行" });

      // 至少应该有 3 条旅行日记（海边、巴黎、黄山）
      expect(results.length).toBeGreaterThanOrEqual(3);

      // 验证结果都包含"旅行"标签或内容
      results.forEach((r) => {
        const hasTravelKeyword =
          r.diary.content.includes("旅行") || r.diary.tags?.includes("旅行");
        expect(hasTravelKeyword).toBe(true);
      });
    });

    it("场景4：组合搜索 '巴黎 AND 旅行' 应该更精确", () => {
      const results = searchRepo.search({ keyword: "巴黎 AND 旅行" });

      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((r) => {
        const hasParis = r.diary.content.includes("巴黎") || r.diary.tags?.includes("巴黎");
        const hasTravel = r.diary.content.includes("旅行") || r.diary.tags?.includes("旅行");
        expect(hasParis && hasTravel).toBe(true);
      });
    });

    it("场景5：搜索 '黄山' 应该返回日出相关的日记", () => {
      const results = searchRepo.search({ keyword: "黄山" });

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].diary.content).toContain("黄山");
      expect(results[0].diary.content).toContain("日出");
    });

    it("场景6：搜索 '美食' 应该返回多条美食日记", () => {
      const results = searchRepo.search({ keyword: "美食" });

      // 应该包含奶奶的红烧肉和法式晚餐
      expect(results.length).toBeGreaterThanOrEqual(2);

      // 验证都有"美食"标签
      results.forEach((r) => {
        expect(r.diary.tags).toContain("美食");
      });
    });

    it("场景7：搜索人物 '小明' 应该返回海边旅行的日记", () => {
      const results = searchRepo.search({ keyword: "小明" });

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].diary.people).toContain("小明");
      expect(results[0].diary.content).toContain("海边");
    });

    it("场景8：搜索地点 '光明顶' 应该返回黄山日记", () => {
      const results = searchRepo.search({ keyword: "光明顶" });

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].diary.locations).toContain("光明顶");
      expect(results[0].diary.content).toContain("日出");
    });

    it("场景9：搜索不存在的词应该返回空结果", () => {
      const results = searchRepo.search({ keyword: "不存在的内容xyz123" });

      expect(results).toEqual([]);
    });

    it("场景10：搜索 '朋友' 应该返回多条包含朋友的日记", () => {
      const results = searchRepo.search({ keyword: "朋友" });

      // 海边旅行、巴黎旅行都包含朋友
      expect(results.length).toBeGreaterThanOrEqual(2);

      results.forEach((r) => {
        const hasFriend =
          r.diary.people?.includes("朋友") ||
          r.diary.content.includes("朋友");
        expect(hasFriend).toBe(true);
      });
    });

    it("场景11：搜索结果应该按相关度排序", () => {
      // 搜索同时包含"旅行"和"开心"的日记
      const results = searchRepo.search({ keyword: "旅行 开心" });

      if (results.length > 1) {
        // 第一个结果的相关度应该最高
        expect(results[0].rank).toBeGreaterThanOrEqual(results[1].rank);
      }
    });

    it("场景12：搜索结果应该包含高亮信息", () => {
      const results = searchRepo.search({ keyword: "巴黎" });

      expect(results.length).toBeGreaterThanOrEqual(1);

      results.forEach((r) => {
        // 应该有高亮信息
        expect(r.highlights).toBeDefined();
        expect(Object.keys(r.highlights).length).toBeGreaterThan(0);

        // 高亮内容应该包含标记
        const hasHighlight = Object.values(r.highlights).some(
          (h) => h && h.includes("{")
        );
        expect(hasHighlight).toBe(true);
      });
    });

    it("场景13：分页测试", () => {
      // 搜索"旅行"，每页 2 条
      const page1 = searchRepo.search({ keyword: "旅行", limit: 2, offset: 0 });
      const page2 = searchRepo.search({ keyword: "旅行", limit: 2, offset: 2 });

      // 每页最多 2 条
      expect(page1.length).toBeLessThanOrEqual(2);
      expect(page2.length).toBeLessThanOrEqual(2);

      // 两页不应该有重复
      const page1Ids = new Set(page1.map((r) => r.diary.id));
      const page2Ids = new Set(page2.map((r) => r.diary.id));

      const intersection = [...page1Ids].filter((id) => page2Ids.has(id));
      expect(intersection).toHaveLength(0);
    });
  });

  describe("索引同步 E2E 测试", () => {
    let searchRepo: SearchRepository;
    let diaryRepo: DiaryRepository;

    beforeAll(() => {
      searchRepo = new SearchRepository();
      diaryRepo = new DiaryRepository();
    });

    it("创建日记后应该能立即搜索到", () => {
      const diary = diaryRepo.save({
        eventDate: "2024-06-03",
        content: "这是一篇新创建的测试日记，包含关键词：即时搜索",
        tags: ["测试", "即时搜索"],
      });

      // 立即搜索应该能找到
      const results = searchRepo.search({ keyword: "即时搜索" });
      expect(results.length).toBeGreaterThanOrEqual(1);

      const found = results.find((r) => r.diary.id === diary.id);
      expect(found).toBeDefined();
    });

    it("更新日记后搜索结果应该同步", () => {
      const diary = diaryRepo.save({
        content: "原始内容",
        tags: ["原始"],
      });

      // 确认能搜索到原始内容
      let results = searchRepo.search({ keyword: "原始内容" });
      expect(results.length).toBeGreaterThanOrEqual(1);

      // 更新为新内容
      diaryRepo.update(diary.id, {
        content: "更新后的新内容：巴黎旅行",
        tags: ["更新", "巴黎"],
      });

      // 搜索新内容应该能找到
      results = searchRepo.search({ keyword: "巴黎旅行" });
      expect(results.length).toBeGreaterThanOrEqual(1);

      // 搜索旧内容应该找不到
      results = searchRepo.search({ keyword: "原始内容" });
      expect(results).toEqual([]);
    });

    it("删除日记后应该搜索不到", () => {
      const diary = diaryRepo.save({
        content: "待删除的测试日记",
        tags: ["删除"],
      });

      // 确认能搜索到
      let results = searchRepo.search({ keyword: "待删除" });
      expect(results.length).toBeGreaterThanOrEqual(1);

      // 删除日记
      diaryRepo.delete(diary.id);

      // 应该搜索不到
      results = searchRepo.search({ keyword: "待删除" });
      expect(results).toEqual([]);
    });

    it("批量操作后索引应该正确同步", () => {
      // 批量创建 10 条日记
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        const diary = diaryRepo.save({
          content: `批量测试日记 ${i}，关键词：批量测试`,
          tags: ["批量", "测试"],
        });
        ids.push(diary.id);
      }

      // 搜索应该能找到所有 10 条
      const results = searchRepo.search({ keyword: "批量测试" });
      expect(results.length).toBeGreaterThanOrEqual(10);

      // 验证每条都能找到
      ids.forEach((id) => {
        const found = results.find((r) => r.diary.id === id);
        expect(found).toBeDefined();
      });
    });
  });

  describe("中文分词效果测试", () => {
    let searchRepo: SearchRepository;
    let diaryRepo: DiaryRepository;

    beforeAll(() => {
      searchRepo = new SearchRepository();
      diaryRepo = new DiaryRepository();

      // 创建包含各种中文词汇的测试数据
      diaryRepo.save({
        content: "我和朋友们一起去北京故宫博物院参观，了解了中国的历史文化。",
        tags: ["北京", "故宫", "历史", "文化"],
      });

      diaryRepo.save({
        content: "今天在星巴克点了一杯拿铁咖啡，顺便处理了一些工作邮件。",
        tags: ["咖啡", "工作", "星巴克"],
      });

      diaryRepo.save({
        content: "周末和家人一起去爬山，虽然很累但很充实。",
        tags: ["运动", "家庭", "健康"],
      });
    });

    it("应该能搜索到中文地名", () => {
      const results = searchRepo.search({ keyword: "北京" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].diary.content).toContain("北京");
    });

    it("应该能搜索到中文品牌名", () => {
      const results = searchRepo.search({ keyword: "星巴克" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].diary.content).toContain("星巴克");
    });

    it("应该能搜索到中文动词", () => {
      const results = searchRepo.search({ keyword: "参观" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].diary.content).toContain("参观");
    });

    it("应该能搜索到中文形容词", () => {
      const results = searchRepo.search({ keyword: "累" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].diary.content).toContain("累");
    });

    it("应该能搜索复合词", () => {
      const results = searchRepo.search({ keyword: "故宫博物院" });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("性能测试", () => {
    let searchRepo: SearchRepository;
    let diaryRepo: DiaryRepository;

    beforeAll(() => {
      searchRepo = new SearchRepository();
      diaryRepo = new DiaryRepository();

      // 插入 100 条测试数据
      for (let i = 0; i < 100; i++) {
        diaryRepo.save({
          eventDate: `2024-${String(Math.floor(i / 30) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
          content: `这是第 ${i} 条测试日记。关键词包括：测试、日记、内容。`,
          tags: ["测试", `标签${i % 10}`],
          people: i % 3 === 0 ? ["测试用户"] : undefined,
          locations: i % 5 === 0 ? ["测试地点"] : undefined,
        });
      }
    });

    it("单次搜索应该在 500ms 内完成", () => {
      const start = Date.now();
      const results = searchRepo.search({ keyword: "测试" });
      const duration = Date.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500);
    });

    it("搜索结果数量应该合理", () => {
      const results = searchRepo.search({ keyword: "测试" });

      // 应该返回包含"测试"的所有日记
      expect(results.length).toBeGreaterThanOrEqual(100);
    });

    it("分页查询应该性能良好", () => {
      const start = Date.now();
      const page1 = searchRepo.search({ keyword: "测试", limit: 20, offset: 0 });
      const page2 = searchRepo.search({ keyword: "测试", limit: 20, offset: 20 });
      const page3 = searchRepo.search({ keyword: "测试", limit: 20, offset: 40 });
      const duration = Date.now() - start;

      expect(page1.length).toBeLessThanOrEqual(20);
      expect(page2.length).toBeLessThanOrEqual(20);
      expect(page3.length).toBeLessThanOrEqual(20);
      expect(duration).toBeLessThan(1000); // 3次查询在1秒内
    });
  });
});
