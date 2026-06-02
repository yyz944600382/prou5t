/**
 * 日记相关类型定义
 * 由 S002 和 S003 共享使用
 */

/**
 * 日记条目
 */
export interface DiaryEntry {
  /** 唯一标识符（UUID） */
  id: string;
  /** 事件日期（YYYY-MM-DD），用户回忆的时间 */
  eventDate?: string;
  /** 创建时间（ISO 时间戳），记录创建时间 */
  createdAt: string;
  /** 日记完整内容 */
  content: string;
  /** 相关人物（数组） */
  people?: string[];
  /** 相关地点（数组） */
  locations?: string[];
  /** 情感标签（数组） */
  emotions?: string[];
  /** 其他标签（数组） */
  tags?: string[];
  /** 最后修改时间（ISO 时间戳） */
  updatedAt?: string;
}

/**
 * 日记查询过滤器
 */
export interface DiaryFilter {
  /** 开始日期（YYYY-MM-DD） */
  startDate?: string;
  /** 结束日期（YYYY-MM-DD） */
  endDate?: string;
  /** 标签筛选（OR 匹配：匹配任一标签即可） */
  tags?: string[];
  /** 人物筛选（OR 匹配：匹配任一人物即可） */
  people?: string[];
  /** 地点筛选（OR 匹配：匹配任一地点即可） */
  locations?: string[];
  /** 结果数量限制 */
  limit?: number;
}
