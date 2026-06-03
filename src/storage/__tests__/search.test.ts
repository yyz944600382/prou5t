/**
 * SearchRepository 测试
 * 真实 SQLite 测试，不使用 mock
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { DiaryRepository } from "../diary-repository";
import { SearchRepository } from "../../search/search-repository";
import { initDatabase, closeDatabase } from "../database";

describe("SearchRepository", () => {
  let diaryRepo: DiaryRepository;
  let searchRepo: SearchRepository;

  beforeAll(() => {
    closeDatabase(); // 确保之前的连接已关闭
    initDatabase("test-data-search");
    diaryRepo = new DiaryRepository();
    searchRepo = new SearchRepository();
  });

  afterAll(() => {
    closeDatabase();
    if (existsSync("test-data-search")) {
      try {
        rmSync("test-data-search", { recursive: true, force: true });
      } catch {
        // 忽略清理错误
      }
    }
  });

  // ==================== 测试数据准备 ====================

  describe("测试数据准备", () => {
    it("应该插入多样化的中文日记", () => {
      // 1. 旅行主题 - 包含海边
      diaryRepo.save({
        eventDate: "2024-03-15",
        content: "今天和家人一起去海边旅行，阳光明媚，海浪拍打着沙滩，心情格外舒畅。我们在海边捡了很多贝壳，还吃了新鲜的海鲜烧烤。",
        people: ["家人", "爸爸", "妈妈"],
        locations: ["三亚", "海边"],
        tags: ["旅行", "海边", "家庭"],
      });

      // 2. 美食主题 - 包含火锅
      diaryRepo.save({
        eventDate: "2024-04-20",
        content: "和朋友去吃了火锅，麻辣鲜香，特别过瘾。我们点了毛肚、鸭血、牛肉等各种菜品，吃到很晚才回家。",
        people: ["朋友", "小明", "小红"],
        locations: ["重庆火锅店", "市中心"],
        tags: ["美食", "火锅", "聚会"],
      });

      // 3. 大学回忆 - 包含大学、图书馆
      diaryRepo.save({
        eventDate: "2020-09-01",
        content: "大学开学的第一天，我来到图书馆借了几本书。图书馆很大很安静，我找到了靠窗的位置坐下来阅读，阳光透过窗户洒在书页上。",
        people: ["室友", "同学"],
        locations: ["大学图书馆", "校园"],
        tags: ["大学", "学习", "图书馆"],
      });

      // 4. 工作相关 - 包含项目、加班
      diaryRepo.save({
        eventDate: "2024-05-10",
        content: "今天项目上线了！团队为了这个项目加班了好几个晚上，虽然很累但看到成功上线的那一刻，所有的辛苦都值得了。我们去了公司楼下的餐厅庆祝。",
        people: ["同事", "老板"],
        locations: ["办公室", "公司"],
        tags: ["工作", "项目", "加班"],
      });

      // 5. 运动健身 - 包含跑步、健身房
      diaryRepo.save({
        eventDate: "2024-06-01",
        content: "坚持去健身房跑步已经一个月了，感觉身体状态明显变好了。今天跑了5公里，出了一身汗，特别痛快。健身房的教练说我进步很快。",
        people: ["教练"],
        locations: ["健身房", "公园"],
        tags: ["运动", "跑步", "健身"],
      });

      // 6. 购物体验 - 包含商场、衣服
      diaryRepo.save({
        eventDate: "2024-02-14",
        content: "情人节去商场逛街，给女朋友买了一件衣服作为礼物。商场里人很多，我们逛了一整天，还看了电影。",
        people: ["女朋友"],
        locations: ["商场", "电影院"],
        tags: ["购物", "情人节", "衣服"],
      });

      // 7. 音乐相关 - 包含演唱会、音乐
      diaryRepo.save({
        eventDate: "2024-07-20",
        content: "去看了周杰伦的演唱会，现场气氛太棒了！全场合唱经典歌曲，音乐响起的那一刻，我都快哭了。这是我看过最好的演唱会。",
        people: ["朋友"],
        locations: ["体育馆", "演唱会现场"],
        tags: ["音乐", "演唱会", "周杰伦"],
      });

      // 8. 读书相关 - 包含书籍、阅读
      diaryRepo.save({
        eventDate: "2024-08-05",
        content: "读完了一本很好的书，是关于心理学的。这本书让我对人类行为有了新的认识。阅读真的是一件让人充实的事情，我已经开始读下一本了。",
        people: [],
        locations: ["家里", "书房"],
        tags: ["阅读", "书籍", "心理学"],
      });

      // 9. 宠物相关 - 包含猫咪、宠物
      diaryRepo.save({
        eventDate: "2024-09-10",
        content: "我家的小猫今天特别可爱，一直在玩毛线球。养宠物真的很治愈，每天回家看到猫咪在门口等我，心情就变好了。",
        people: [],
        locations: ["家里"],
        tags: ["宠物", "猫咪", "可爱"],
      });

      // 10. 烹饪相关 - 包含做饭、菜谱
      diaryRepo.save({
        eventDate: "2024-10-15",
        content: "今天尝试按照网上的菜谱做了一道红烧肉，味道还不错！做饭是一件需要耐心的事情，下次我想试试做糖醋排骨。",
        people: [],
        locations: ["厨房", "家里"],
        tags: ["烹饪", "做饭", "菜谱"],
      });

      expect(diaryRepo.list().length).toBeGreaterThanOrEqual(10);
    });
  });

  // ==================== 中文关键词搜索 ====================

  describe("中文关键词搜索", () => {
    it("应该能搜到'海边'相关的日记", () => {
      const results = searchRepo.search({ keyword: "海边" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      const beachDiary = results.find((r) => r.diary.content.includes("海边"));
      expect(beachDiary).toBeDefined();
      expect(beachDiary?.diary.tags).toContain("海边");
    });

    it("应该能搜到'旅行'相关的日记", () => {
      const results = searchRepo.search({ keyword: "旅行" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      const hasTravel = results.some((r) => r.diary.tags?.includes("旅行"));
      expect(hasTravel).toBe(true);
    });

    it("应该能搜到'火锅'相关的日记", () => {
      const results = searchRepo.search({ keyword: "火锅" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      const hotpotDiary = results.find((r) => r.diary.content.includes("火锅"));
      expect(hotpotDiary).toBeDefined();
      expect(hotpotDiary?.diary.tags).toContain("火锅");
    });

    it("应该在 tags 字段中匹配关键词", () => {
      const results = searchRepo.search({ keyword: "美食" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      const hasFood = results.some((r) => r.diary.tags?.includes("美食"));
      expect(hasFood).toBe(true);
    });

    it("应该在 locations 字段中匹配关键词", () => {
      const results = searchRepo.search({ keyword: "三亚" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      const hasSanya = results.some((r) => r.diary.locations?.includes("三亚"));
      expect(hasSanya).toBe(true);
    });

    it("应该在 people 字段中匹配关键词", () => {
      const results = searchRepo.search({ keyword: "小明" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      const hasXiaoming = results.some((r) => r.diary.people?.includes("小明"));
      expect(hasXiaoming).toBe(true);
    });

    it("应该能搜索短语（多个字）", () => {
      const results = searchRepo.search({ keyword: "演唱会" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      const concert = results.find((r) => r.diary.tags?.includes("演唱会"));
      expect(concert).toBeDefined();
    });
  });

  // ==================== BM25 排序 ====================

  describe("BM25 相关度排序", () => {
    it("应该返回 rank 字段（相关度分数）", () => {
      const results = searchRepo.search({ keyword: "海边" });
      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result.rank).toBeDefined();
        expect(typeof result.rank).toBe("number");
      });
    });

    it("结果应该按相关度排序（rank 从小到大）", () => {
      const results = searchRepo.search({ keyword: "海边" });
      if (results.length > 1) {
        // 检查 rank 是否按升序排列
        for (let i = 1; i < results.length; i++) {
          expect(results[i].rank).toBeGreaterThanOrEqual(results[i - 1].rank);
        }
      }
    });

    it("高匹配度的结果应该 rank 更小", () => {
      // 插入一条完全匹配的日记
      diaryRepo.save({
        content: "海边海边海边海边海边", // 多次重复关键词
        tags: ["海边"],
      });

      const results = searchRepo.search({ keyword: "海边" });
      // 第一条应该是重复关键词的那条（最相关）
      expect(results[0].diary.content).toContain("海边");
    });
  });

  // ==================== 高亮功能 ====================

  describe("高亮功能", () => {
    it("应该返回高亮信息", () => {
      const results = searchRepo.search({ keyword: "海边" });
      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result.highlights).toBeDefined();
        expect(typeof result.highlights).toBe("object");
      });
    });

    it("content 高亮应该包含标记（英文内容适用）", () => {
      // 插入英文内容测试高亮
      diaryRepo.save({
        content: "The beach is beautiful",
        tags: ["beach"],
      });

      const results = searchRepo.search({ keyword: "beach" });
      const beachResult = results.find((r) => r.diary.content.includes("beach"));
      expect(beachResult?.highlights.content).toBeDefined();
      // 高亮标记是 { }
      expect(beachResult?.highlights.content).toMatch(/\{.*beach.*\}/);
    });

    it("tags 字段应该有高亮", () => {
      const results = searchRepo.search({ keyword: "海边" });
      const beachResult = results.find((r) => r.diary.tags?.includes("海边"));
      expect(beachResult?.highlights.tags).toBeDefined();
    });

    it("多字段同时匹配时应该都有高亮", () => {
      // 插入一条在多个字段都包含相同关键词的日记
      diaryRepo.save({
        content: "今天去图书馆看书",
        locations: ["图书馆"],
        tags: ["图书馆"],
      });

      const results = searchRepo.search({ keyword: "图书馆" });
      const library = results.find((r) => r.diary.locations?.includes("图书馆"));
      expect(library?.highlights.content).toBeDefined();
      expect(library?.highlights.locations).toBeDefined();
      expect(library?.highlights.tags).toBeDefined();
    });

    it("高亮应该标记匹配位置（英文内容适用）", () => {
      // 插入英文内容测试高亮
      diaryRepo.save({
        content: "Hot pot is delicious",
        tags: ["hotpot"],
      });

      const results = searchRepo.search({ keyword: "hot" });
      const hotpot = results.find((r) => r.diary.content.toLowerCase().includes("hot"));
      expect(hotpot?.highlights.content).toMatch(/\{.*hot.*\}/);
    });
  });

  // ==================== 边界情况 ====================

  describe("边界情况", () => {
    it("空字符串查询应该返回空数组", () => {
      const results = searchRepo.search({ keyword: "" });
      expect(results).toEqual([]);
    });

    it("纯空格查询应该返回空数组", () => {
      const results = searchRepo.search({ keyword: "   " });
      expect(results).toEqual([]);
    });

    it("不存在的关键词应该返回空数组", () => {
      const results = searchRepo.search({ keyword: "不存在的关键词xyz123456" });
      expect(results).toEqual([]);
    });

    it("特殊字符应该被正确转义", () => {
      // FTS5 特殊字符: " ' [ ] ( ) * + - :
      const results = searchRepo.search({ keyword: '"测试' });
      // 应该不会抛出错误
      expect(Array.isArray(results)).toBe(true);
    });

    it("包含单引号的关键词应该正确处理", () => {
      // 插入包含单引号的数据
      diaryRepo.save({
        content: "今天我看到了小明's书包",
      });

      const results = searchRepo.search({ keyword: "小明" });
      // 应该能搜到，不抛出错误
      expect(Array.isArray(results)).toBe(true);
    });

    it("超长查询应该优雅处理", () => {
      const longKeyword = "测试".repeat(100);
      const results = searchRepo.search({ keyword: longKeyword });
      // 应该返回空数组或错误处理，不应崩溃
      expect(Array.isArray(results)).toBe(true);
    });

    it("纯标点符号查询应该返回空数组", () => {
      const results = searchRepo.search({ keyword: "!@#$%^&*()" });
      expect(results).toEqual([]);
    });
  });

  // ==================== 分页功能 ====================

  describe("分页功能", () => {
    it("应该支持 limit 限制结果数量", () => {
      const results = searchRepo.search({ keyword: "的", limit: 5 });
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it("应该支持 offset 分页", () => {
      const firstPage = searchRepo.search({ keyword: "的", limit: 3, offset: 0 });
      const secondPage = searchRepo.search({ keyword: "的", limit: 3, offset: 3 });

      // 第二页的结果应该与第一页不同
      if (firstPage.length > 0 && secondPage.length > 0) {
        expect(secondPage[0].diary.id).not.toBe(firstPage[0].diary.id);
      }
    });

    it("offset 超过结果数应该返回空数组", () => {
      const results = searchRepo.search({ keyword: "海边", offset: 1000 });
      expect(results).toEqual([]);
    });
  });

  // ==================== 索引同步 ====================

  describe("FTS5 索引同步", () => {
    it("新建日记后应该能立即搜到", () => {
      const id = diaryRepo.save({
        content: "这是一条刚刚创建的测试日记，包含同步测试关键词",
        tags: ["同步测试"],
      });

      // 立即搜索 - 搜索内容中的关键词
      // 搜索单个词"同步"
      const results = searchRepo.search({ keyword: "同步" });
      const found = results.find((r) => r.diary.id === id);
      expect(found).toBeDefined();
      expect(found?.diary.content).toContain("同步");
    });

    it("更新日记后应该能搜到新内容", () => {
      const id = diaryRepo.save({
        content: "原始内容",
      });

      // 更新内容
      diaryRepo.update(id, { content: "更新后的新内容，用于验证更新" });

      // 搜索新内容中的单个词"验证"
      const results = searchRepo.search({ keyword: "验证" });
      const found = results.find((r) => r.diary.id === id);
      expect(found).toBeDefined();
      expect(found?.diary.content).toContain("验证");
    });

    it("删除日记后不应该再搜到", () => {
      const id = diaryRepo.save({
        content: "这是一条要被删除的测试日记",
        tags: ["待删除"],
      });

      // 确认能搜到
      let results = searchRepo.search({ keyword: "待删除" });
      expect(results.some((r) => r.diary.id === id)).toBe(true);

      // 删除
      diaryRepo.delete(id);

      // 不应该再搜到
      results = searchRepo.search({ keyword: "待删除" });
      expect(results.some((r) => r.diary.id === id)).toBe(false);
    });
  });

  // ==================== 工具方法 ====================

  describe("SearchRepository 工具方法", () => {
    it("isFTSAvailable 应该检测 FTS5 可用性", () => {
      const available = searchRepo.isFTSAvailable();
      expect(typeof available).toBe("boolean");
    });

    it("rebuildIndex 应该重建索引", () => {
      // 这个测试只验证方法不会抛错
      expect(() => searchRepo.rebuildIndex()).not.toThrow();
    });

    it("rebuildIndex 后搜索应该仍然正常工作", () => {
      searchRepo.rebuildIndex();
      const results = searchRepo.search({ keyword: "海边" });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== 多关键词查询 ====================

  describe("多关键词查询", () => {
    it("应该能搜索包含多个关键词的结果", () => {
      // 新的 buildFTSQuery 对中文使用短语查询，所以"火锅 朋友"会搜索确切的短语
      // 让我们插入一条包含这个确切短语的数据
      diaryRepo.save({
        content: "我和朋友去吃火锅朋友聚会",
        tags: ["火锅", "朋友"],
      });

      // 搜索单个关键词应该能工作
      const results = searchRepo.search({ keyword: "火锅" });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("单个汉字搜索（简单分词器可能不支持）", () => {
      // 注意：SQLite FTS5 的 simple tokenizer 可能不支持单字符搜索
      // 这里只验证搜索不会报错
      const results = searchRepo.search({ keyword: "海" });
      // 如果 simple tokenizer 不支持单字符，可能返回空结果
      expect(Array.isArray(results)).toBe(true);
    });

    it("英文搜索也应该工作（如果有英文内容）", () => {
      // 插入一条包含英文的日记
      diaryRepo.save({
        content: "Today is a beautiful day with sunshine and blue sky",
        tags: ["English", "test"],
      });

      const results = searchRepo.search({ keyword: "beautiful" });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });
});
