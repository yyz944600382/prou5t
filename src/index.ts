/**
 * prou5t — CLI 入口
 */

import * as p from "@clack/prompts";
import { loadConfig, validateConfig } from "./utils/config";
import { createAdapter } from "./adapters";
import { HookRegistry } from "./hooks/registry";
import { AgentCore } from "./agent/core";
import { createDiaryExtractHook } from "./hooks/diary-extract";

async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  let modelFlag: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" && args[i + 1]) {
      modelFlag = args[i + 1];
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

  // 初始化组件
  const adapter = createAdapter(config.defaultModel, config);
  const hooks = new HookRegistry();

  // 注册日记提取 Hook
  hooks.register(createDiaryExtractHook(adapter));

  const agent = new AgentCore({ adapter, hooks });

  // 欢迎界面
  p.intro("prou5t — 回忆助手");
  p.note(`模型: ${config.defaultModel}`, "配置");

  // 触发 beforeConversation Hook（注入记忆等）
  await hooks.trigger("beforeConversation", agent.context);

  // 主循环
  async function chatLoop() {
    while (true) {
      const input = await p.text({
        message: "你:",
        placeholder: "输入消息，或输入 exit 退出",
      });

      if (p.isCancel(input) || input === "exit" || input === "quit") {
        break;
      }

      if (!input?.trim()) continue;

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

  // 结束会话
  await agent.endSession();
  p.outro("再见！你的回忆已保存。");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
