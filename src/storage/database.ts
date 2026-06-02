/**
 * SQLite 数据库连接管理
 * 负责数据库初始化、连接获取和关闭
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";

let db: Database.Database | null = null;

/**
 * 数据库默认路径
 */
const DEFAULT_DATA_DIR = "data";
const DEFAULT_DB_NAME = "prou5t.db";

/**
 * 初始化数据库
 * 创建数据目录（如果不存在），建立数据库连接，初始化表结构和索引
 *
 * @param dataDir - 数据目录路径，默认为 "data"
 */
export function initDatabase(dataDir: string = DEFAULT_DATA_DIR): void {
  if (db) {
    return; // 已初始化
  }

  // 确保数据目录存在
  // 如果 dataDir 是绝对路径，直接使用；否则相对于 process.cwd()
  const dbPath = isAbsolute(dataDir) ? dataDir : join(process.cwd(), dataDir);
  if (!existsSync(dbPath)) {
    mkdirSync(dbPath, { recursive: true });
  }

  // 建立数据库连接
  const dbFilePath = join(dbPath, DEFAULT_DB_NAME);
  db = new Database(dbFilePath);

  // 启用 WAL 模式（更好的并发性能）
  db.pragma("journal_mode = WAL");

  // 创建表结构
  createTables();
}

/**
 * 创建表结构和索引
 */
function createTables(): void {
  if (!db) {
    throw new Error("Database not initialized");
  }

  // 创建 diaries 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS diaries (
      id TEXT PRIMARY KEY,
      event_date TEXT,
      created_at TEXT NOT NULL,
      content TEXT NOT NULL,
      people TEXT,
      locations TEXT,
      emotions TEXT,
      tags TEXT,
      updated_at TEXT
    );
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_diaries_event_date ON diaries(event_date);
    CREATE INDEX IF NOT EXISTS idx_diaries_created_at ON diaries(created_at);
  `);
}

/**
 * 获取数据库连接
 *
 * @throws 如果数据库未初始化
 * @returns 数据库连接实例
 */
export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

/**
 * 关闭数据库连接
 * 主要用于测试场景的清理
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
