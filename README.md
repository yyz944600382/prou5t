# prou5t

回忆助手 — 对话 → 日记提取 → 持久化 → 检索 → 再生成

## 快速开始

```bash
cp .env.example .env
# 填入你的 API Key
npm install
npm run dev
```

## 文档

- [项目愿景](docs/VISION.md)
- [开发路线图](docs/ROADMAP.md)
- [架构决策记录](docs/decisions/)
- [功能规格](docs/specs/)

## 开发

```bash
npm run dev          # 开发模式
npm run build        # 编译
npm run test         # 测试
```

## 使用

### 交互模式

```bash
npm run dev
# 输入消息进行对话，系统自动识别回忆并提取为日记
```

### Headless 模式（自动化/测试）

```bash
# 单条消息
echo "去年七月去了成都" | npm run dev -- --headless

# 多条消息
cat <<EOF | npm run dev -- --headless
去年七月去了成都
吃了很多好吃的
EOF
```

Headless 模式特点：
- 从 stdin 读取输入，无需交互
- 日记自动确认保存
- 输出使用简洁格式（适合日志）
