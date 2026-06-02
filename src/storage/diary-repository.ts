/**
 * 日记仓储
 * 提供日记的 CRUD 操作
 */

import type { DiaryEntry, DiaryFilter } from "../diary/types";
import { getDb } from "./database";

/**
 * JSON 字段序列化
 */
function serializeArray(arr: string[] | undefined): string | null {
  if (!arr || arr.length === 0) {
    return null;
  }
  return JSON.stringify(arr);
}

/**
 * JSON 字段反序列化
 */
function deserializeArray(json: string | null | undefined): string[] {
  if (!json) {
    return [];
  }
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 生成 ISO 时间戳
 */
function nowTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 日记仓储类
 */
export class DiaryRepository {
  /**
   * 保存日记
   *
   * @param diary - 要保存的日记（不含 id）
   * @returns 新日记的 ID
   */
  save(diary: Omit<DiaryEntry, "id" | "createdAt" | "updatedAt">): string {
    const db = getDb();
    const id = crypto.randomUUID();
    const timestamp = nowTimestamp();

    const stmt = db.prepare(`
      INSERT INTO diaries (
        id, event_date, created_at, content,
        people, locations, emotions, tags, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      diary.eventDate ?? null,
      timestamp,
      diary.content,
      serializeArray(diary.people),
      serializeArray(diary.locations),
      serializeArray(diary.emotions),
      serializeArray(diary.tags),
      timestamp,
    );

    return id;
  }

  /**
   * 按 ID 查找日记
   *
   * @param id - 日记 ID
   * @returns 日记条目，不存在时返回 null
   */
  findById(id: string): DiaryEntry | null {
    const db = getDb();
    const stmt = db.prepare("SELECT * FROM diaries WHERE id = ?");
    const row = stmt.get(id) as Row | undefined;

    if (!row) {
      return null;
    }

    return rowToEntry(row);
  }

  /**
   * 按条件查询日记列表
   *
   * @param filter - 查询过滤条件
   * @returns 日记列表（空数据库时返回空数组）
   */
  list(filter?: DiaryFilter): DiaryEntry[] {
    const db = getDb();

    let query = "SELECT * FROM diaries WHERE 1=1";
    const params: unknown[] = [];

    if (filter?.startDate) {
      query += " AND event_date >= ?";
      params.push(filter.startDate);
    }

    if (filter?.endDate) {
      query += " AND event_date <= ?";
      params.push(filter.endDate);
    }

    if (filter?.limit) {
      query += " LIMIT ?";
      params.push(filter.limit);
    }

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as Row[];

    // 内存中过滤 JSON 字段（tags, people, locations）
    let entries = rows.map(rowToEntry);

    if (filter) {
      entries = this.filterByArrayFields(entries, filter);
    }

    return entries;
  }

  /**
   * 在内存中过滤数组字段（tags, people, locations）
   *
   * @param entries - 日记列表
   * @param filter - 过滤条件
   * @returns 过滤后的日记列表
   */
  private filterByArrayFields(entries: DiaryEntry[], filter: DiaryFilter): DiaryEntry[] {
    return entries.filter((entry) => {
      // 标签过滤（OR 匹配）
      if (filter.tags && filter.tags.length > 0) {
        const entryTags = entry.tags ?? [];
        if (!filter.tags.some((tag) => entryTags.includes(tag))) {
          return false;
        }
      }

      // 人物过滤（OR 匹配）
      if (filter.people && filter.people.length > 0) {
        const entryPeople = entry.people ?? [];
        if (!filter.people.some((person) => entryPeople.includes(person))) {
          return false;
        }
      }

      // 地点过滤（OR 匹配）
      if (filter.locations && filter.locations.length > 0) {
        const entryLocations = entry.locations ?? [];
        if (!filter.locations.some((loc) => entryLocations.includes(loc))) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 更新日记
   *
   * @param id - 日记 ID
   * @param updates - 要更新的字段
   * @returns 是否更新成功
   */
  update(id: string, updates: Partial<DiaryEntry>): boolean {
    const db = getDb();

    // 检查日记是否存在
    const existing = this.findById(id);
    if (!existing) {
      return false;
    }

    // 构建更新语句
    const fields: string[] = [];
    const params: unknown[] = [];

    if (updates.content !== undefined) {
      fields.push("content = ?");
      params.push(updates.content);
    }
    if (updates.eventDate !== undefined) {
      fields.push("event_date = ?");
      params.push(updates.eventDate);
    }
    if (updates.people !== undefined) {
      fields.push("people = ?");
      params.push(serializeArray(updates.people));
    }
    if (updates.locations !== undefined) {
      fields.push("locations = ?");
      params.push(serializeArray(updates.locations));
    }
    if (updates.emotions !== undefined) {
      fields.push("emotions = ?");
      params.push(serializeArray(updates.emotions));
    }
    if (updates.tags !== undefined) {
      fields.push("tags = ?");
      params.push(serializeArray(updates.tags));
    }

    // 更新 updated_at
    fields.push("updated_at = ?");
    params.push(nowTimestamp());

    params.push(id);

    const stmt = db.prepare(`
      UPDATE diaries SET ${fields.join(", ")} WHERE id = ?
    `);

    const result = stmt.run(...params);
    return result.changes > 0;
  }

  /**
   * 删除日记
   *
   * @param id - 日记 ID
   * @returns 是否删除成功
   */
  delete(id: string): boolean {
    const db = getDb();
    const stmt = db.prepare("DELETE FROM diaries WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

/**
 * 数据库行类型
 */
interface Row {
  id: string;
  event_date: string | null;
  created_at: string;
  content: string;
  people: string | null;
  locations: string | null;
  emotions: string | null;
  tags: string | null;
  updated_at: string | null;
}

/**
 * 将数据库行转换为 DiaryEntry
 */
function rowToEntry(row: Row): DiaryEntry {
  return {
    id: row.id,
    eventDate: row.event_date ?? undefined,
    createdAt: row.created_at,
    content: row.content,
    people: deserializeArray(row.people),
    locations: deserializeArray(row.locations),
    emotions: deserializeArray(row.emotions),
    tags: deserializeArray(row.tags),
    updatedAt: row.updated_at ?? undefined,
  };
}
