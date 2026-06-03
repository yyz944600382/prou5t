/**
 * 中文分词工具
 * FTS5 默认 tokenizer 把连续中文当作单个 token，
 * 需要在应用层对中文文本做字符级分词（加空格间隔）
 */

/**
 * 对文本做字符级中文分词
 * 将连续中文字符拆成单字，用空格间隔
 * 非中文字符保持原样
 *
 * "海边旅行很棒" → "海 边 旅 行 很 棒"
 * "Hello世界" → "Hello 世 界"
 * "Apple Store" → "Apple Store"
 */
export function tokenizeChinese(text: string): string {
  if (!text) return "";

  let result = "";
  for (const char of text) {
    const code = char.codePointAt(0)!;
    // CJK 统一汉字范围 + CJK 扩展
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||   // 基本汉字
      (code >= 0x3400 && code <= 0x4dbf) ||   // 扩展A
      (code >= 0xf900 && code <= 0xfaff)      // 兼容汉字
    ) {
      result += ` ${char} `;
    } else {
      result += char;
    }
  }

  // 合并多余空格
  return result.replace(/\s+/g, " ").trim();
}

/**
 * 构建适合分词后文本的 FTS5 查询
 *
 * "海边" → "海 AND 边"（两个字符都要出现）
 * "巴黎 旅行" → "(巴 AND 黎) AND (旅 AND 行)"
 * "Hello" → "Hello"
 * "测试 content" → "(测 AND 试) AND content"
 */
export function buildTokenizedFTSQuery(keyword: string): string {
  const trimmed = keyword.trim();
  if (!trimmed) return "";

  // 高级查询（含 FTS5 运算符）：先分词再拼接运算符
  if (/\b(AND|OR|NOT|NEAR)\b/i.test(trimmed)) {
    // 拆出运算符，对每部分分别处理中文
    const parts = trimmed.split(/\s+/);
    const processed: string[] = [];
    for (const part of parts) {
      if (/^(AND|OR|NOT|NEAR)$/i.test(part)) {
        processed.push(part.toUpperCase());
        continue;
      }
      const hasChinese = /[一-龥]/.test(part);
      if (hasChinese) {
        const chars = part.match(/[一-龥]/g) ?? [];
        processed.push(chars.join(" "));
      } else {
        processed.push(`"${part.replace(/"/g, '""')}"`);
      }
    }
    return processed.join(" ");
  }

  // 引号短语查询直接返回
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed;

  // 前缀查询：对中文先分词再加 *
  if (trimmed.endsWith("*")) {
    const base = trimmed.slice(0, -1).trim();
    const hasChinese = /[一-龥]/.test(base);
    if (hasChinese) {
      const chars = base.match(/[一-龥]/g) ?? [];
      if (chars.length > 0) {
        // 最后一个字加 * 做前缀匹配
        const lastIdx = chars.length - 1;
        return chars.map((c, i) => i === lastIdx ? `${c}*` : c).join(" ");
      }
    }
    return `"${base.replace(/"/g, '""')}"*`;
  }

  // 按空格分词
  const terms = trimmed.split(/\s+/).filter((t) => t.length > 0);
  if (terms.length === 0) return "";

  const processedTerms = terms.map((term) => {
    const hasChinese = /[一-龥]/.test(term);
    if (hasChinese) {
      // 中文：拆成单字，用 AND 连接（所有字都要出现）
      const chars = term.match(/[一-龥]/g) ?? [];
      if (chars.length === 0) return term;
      if (chars.length === 1) return chars[0];
      return `(${chars.join(" AND ")})`;
    }
    // 非中文：直接用
    return `"${term.replace(/"/g, '""')}"`;
  });

  // 多个词用 AND 连接
  if (processedTerms.length === 1) return processedTerms[0];
  return processedTerms.join(" AND ");
}

/**
 * 从分词后的高亮文本中还原原始文本
 * 去掉分词添加的多余空格
 */
export function detokenizeHighlight(text: string, keyword: string): string {
  if (!text) return text;

  // 去掉中文字符之间的多余空格
  let result = text.replace(/([一-鿿])\s+([一-鿿])/g, "$1$2");

  // 去掉高亮标记和中文字符之间的空格
  // 如果用了 \x01/\x02 标记的话需要特殊处理
  return result.replace(/\s{2,}/g, " ").trim();
}
