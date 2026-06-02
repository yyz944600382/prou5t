/**
 * 日记提取的用户交互界面
 * 使用 @clack/prompts 展示提取结果并收集用户确认
 */

import * as p from "@clack/prompts";
import type { DiaryEntry } from "./types";

/**
 * 用户确认结果
 */
export interface UserConfirmation {
  /** 动作：confirm/modify/skip */
  action: "confirm" | "modify" | "skip";
  /** 修改后的日记（action=modify 时有效） */
  diary?: Omit<DiaryEntry, "id">;
}

/**
 * 展示日记提取结果并收集用户确认
 *
 * @param diary - 提取的日记
 * @returns 用户确认结果
 */
export async function confirmExtraction(
  diary: Omit<DiaryEntry, "id">,
): Promise<UserConfirmation> {
  p.note("检测到回忆内容，已为你提炼成日记：", "回忆助手");

  // 展示提取结果
  const sections: string[] = [];

  if (diary.eventDate) {
    sections.push(`📅 事件时间: ${diary.eventDate}`);
  } else {
    sections.push(`📅 事件时间: 未知`);
  }

  sections.push(`\n${diary.content}`);

  if (diary.people && diary.people.length > 0) {
    sections.push(`\n👥 人物: ${diary.people.join(", ")}`);
  }

  if (diary.locations && diary.locations.length > 0) {
    sections.push(`\n📍 地点: ${diary.locations.join(", ")}`);
  }

  if (diary.emotions && diary.emotions.length > 0) {
    sections.push(`\n❤️  情感: ${diary.emotions.join(", ")}`);
  }

  if (diary.tags && diary.tags.length > 0) {
    sections.push(`\n🏷️  标签: ${diary.tags.join(", ")}`);
  }

  p.note(sections.join("\n"));

  const action = (await p.select({
    message: "请选择操作：",
    options: [
      { value: "confirm", label: "✅ 确认保存" },
      { value: "modify", label: "✏️  修改内容" },
      { value: "skip", label: "⏭️  跳过本次" },
    ],
  })) as "confirm" | "modify" | "skip" | symbol;

  if (p.isCancel(action)) {
    return { action: "skip" };
  }

  if (action === "confirm") {
    return { action: "confirm" };
  }

  if (action === "skip") {
    return { action: "skip" };
  }

  // 修改模式
  return await modifyDiary(diary);
}

/**
 * 修改日记内容
 *
 * @param diary - 原始日记
 * @returns 用户确认结果
 */
async function modifyDiary(
  diary: Omit<DiaryEntry, "id">,
): Promise<UserConfirmation> {
  p.note("请修改日记内容（留空保持原值）：");

  const modifiedEventDate = await p.text({
    message: "事件时间 (YYYY-MM-DD)",
    placeholder: diary.eventDate ?? "未知",
    initialValue: diary.eventDate ?? "",
  });

  if (p.isCancel(modifiedEventDate)) {
    return { action: "skip" };
  }

  const modifiedContent = await p.text({
    message: "日记内容",
    placeholder: diary.content,
    initialValue: diary.content,
  });

  if (p.isCancel(modifiedContent)) {
    return { action: "skip" };
  }

  const modifiedPeople = await p.text({
    message: "人物（逗号分隔）",
    placeholder: diary.people?.join(", ") ?? "",
    initialValue: diary.people?.join(", ") ?? "",
  });

  if (p.isCancel(modifiedPeople)) {
    return { action: "skip" };
  }

  const modifiedLocations = await p.text({
    message: "地点（逗号分隔）",
    placeholder: diary.locations?.join(", ") ?? "",
    initialValue: diary.locations?.join(", ") ?? "",
  });

  if (p.isCancel(modifiedLocations)) {
    return { action: "skip" };
  }

  const modifiedEmotions = await p.text({
    message: "情感（逗号分隔）",
    placeholder: diary.emotions?.join(", ") ?? "",
    initialValue: diary.emotions?.join(", ") ?? "",
  });

  if (p.isCancel(modifiedEmotions)) {
    return { action: "skip" };
  }

  const modifiedTags = await p.text({
    message: "标签（逗号分隔）",
    placeholder: diary.tags?.join(", ") ?? "",
    initialValue: diary.tags?.join(", ") ?? "",
  });

  if (p.isCancel(modifiedTags)) {
    return { action: "skip" };
  }

  // 构建修改后的日记
  const modifiedDiary: Omit<DiaryEntry, "id"> = {
    eventDate:
      modifiedEventDate && modifiedEventDate.trim()
        ? modifiedEventDate.trim()
        : diary.eventDate,
    createdAt: diary.createdAt,
    content:
      modifiedContent && modifiedContent.trim()
        ? modifiedContent.trim()
        : diary.content,
    people:
      modifiedPeople && modifiedPeople.trim()
        ? modifiedPeople.split(",").map((s) => s.trim()).filter(Boolean)
        : diary.people,
    locations:
      modifiedLocations && modifiedLocations.trim()
        ? modifiedLocations.split(",").map((s) => s.trim()).filter(Boolean)
        : diary.locations,
    emotions:
      modifiedEmotions && modifiedEmotions.trim()
        ? modifiedEmotions.split(",").map((s) => s.trim()).filter(Boolean)
        : diary.emotions,
    tags:
      modifiedTags && modifiedTags.trim()
        ? modifiedTags.split(",").map((s) => s.trim()).filter(Boolean)
        : diary.tags,
  };

  // 再次确认
  const finalAction = (await p.select({
    message: "修改完成，请选择：",
    options: [
      { value: "confirm", label: "✅ 确认保存" },
      { value: "skip", label: "⏭️  跳过本次" },
    ],
  })) as "confirm" | "skip" | symbol;

  if (p.isCancel(finalAction) || finalAction === "skip") {
    return { action: "skip" };
  }

  return { action: "confirm", diary: modifiedDiary };
}
