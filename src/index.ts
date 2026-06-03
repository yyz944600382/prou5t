/**
 * prou5t — CLI 入口
 */

import * as p from "@clack/prompts";
import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig, validateConfig } from "./utils/config";
import { createAdapter } from "./adapters";
import { HookRegistry } from "./hooks/registry";
import { AgentCore } from "./agent/core";
import { createDiaryExtractHook } from "./hooks/diary-extract";
import { initDatabase } from "./storage/database";
import { setHeadlessMode } from "./diary/ui";
import { SearchRepository } from "./search";

async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  let modelFlag: string | undefined;
  let headlessMode = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" && args[i + 1]) {
      modelFlag = args[i + 1];
    }
    if (args[i] === "--headless") {
      headlessMode = true;
    }
  }

  // 加载配置
  const config = loadConfig({ model: modelFlag });
  const missing = validateConfig(config);
  if (missing.length > 0) {
    console.error(`Missing config: ${missing.join(", ")}`);
    console.error("Please check your .env file.");
    process.exit(1);
  }

  // 初始化数据库
  initDatabase(config.dataDir);

  // 初始化组件
  const adapter = createAdapter(config.defaultModel, config);
  const hooks = new HookRegistry();

  // 设置 headless 模式
  setHeadlessMode(headlessMode);

  // 注册日记提取 Hook
  hooks.register(createDiaryExtractHook(adapter));

  const agent = new AgentCore({ adapter, hooks });

  // 触发 beforeConversation Hook（注入记忆等）
  await hooks.trigger("beforeConversation", agent.context);

  // 初始化搜索仓储
  const searchRepo = new SearchRepository();
  const isFTSAvailable = searchRepo.isFTSAvailable();
  if (!isFTSAvailable) {
    console.warn("[警告] FTS5 不可用，搜索功能将受限");
  }

  // headless 模式主循环
  if (headlessMode) {
    const rl = createInterface({ input, output });
    for await (const line of rl) {
      const input = line.trim();
      if (!input) continue;
      if (input === "exit" || input === "quit") break;

      try {
        const reply = await agent.processInput(input);
        console.log(`[prou5t] ${reply}`);
      } catch (err) {
        console.error(
          `[错误] ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    rl.close();
  } else {
    // 交互模式
    p.intro("prou5t — 回忆助手");
    p.note(`模型: ${config.defaultModel}`, "配置");

    // 搜索处理函数
    async function handleSearch(keyword: string): Promise<void> {
      const results = searchRepo.search({ keyword });
      if (results.length === 0) {
        p.note("没有找到相关日记", "搜索结果");
        return;
      }

      p.note(`找到 ${results.length} 条相关日记：`, "搜索结果");
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const header = `[${i + 1}] ${result.diary.eventDate ?? "未知日期"} — ${result.diary.content.slice(0, 30)}...`;
        p.note(header);

        if (result.highlights.content) {
          console.log(`  内容: ${result.highlights.content}`);
        }
        if (result.diary.people?.length) {
          console.log(`  人物: ${result.diary.people.join(", ")}`);
        }
        if (result.diary.locations?.length) {
          console.log(`  地点: ${result.diary.locations.join(", ")}`);
        }
      }
    }

    async function chatLoop() {
      while (true) {
        const input = await p.text({
          message: "你:",
          placeholder: "输入消息，或输入 exit 退出（输入 /search 关键词 进行搜索）",
        });

        if (p.isCancel(input) || input === "exit" || input === "quit") {
          break;
        }

        if (!input?.trim()) continue;

        // 处理搜索命令
        if (input.startsWith("/search ") || input.startsWith("s ")) {
          const keyword = input.replace(/^\/(search|s) /, "");
          await handleSearch(keyword);
          continue;
        }

        const s = p.spinner();
        s.start("思考中...");

        try {
          const reply = await agent.processInput(input);
          s.stop();
          p.note(reply, "prou5t");
        } catch (err) {
          s.stop();
          p.note(
            `出错了: ${err instanceof Error ? err.message : String(err)}`,
            "错误",
          );
        }
      }
    }

    await chatLoop();
  }

  // 结束会话
  await agent.endSession();
  if (!headlessMode) {
    p.outro("再见！你的回忆已保存。");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
