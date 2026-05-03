import type { Document } from "../../editor/types";
import type { AppLanguage } from "../../hooks/useAppPreferences";
import { getEmptyNodeLabel } from "../../i18n/uiText";

type LlmResponseMode = "generate" | "improve" | "review";

function nodeLabel(doc: Document, nodeId: string, language: AppLanguage): string {
  const node = doc.nodes[nodeId];
  if (!node) return `ID:${nodeId}`;
  const text = node.text.trim();
  if (text === "") return getEmptyNodeLabel(language);
  return language === "ja" ? `「${text}」` : `"${text}"`;
}

function humanizeDocumentError(doc: Document, error: string, language: AppLanguage): string {
  const cursorMatch = error.match(/^input\.document\.cursorId "(.+)" does not exist in nodes$/);
  if (cursorMatch) {
    return language === "ja"
      ? `選択中ノードが見つかりません。以前の編集状態が残っている可能性があります。（nodeId: ${cursorMatch[1]}）`
      : `The selected node could not be found. A stale cursor reference may remain. (nodeId: ${cursorMatch[1]})`;
  }

  const childMatch = error.match(
    /^input\.document\.nodes\.([^.]+)\.childrenIds\[(\d+)\] references missing node "(.+)"$/,
  );
  if (childMatch) {
    const [, parentId, index, childId] = childMatch;
    return language === "ja"
      ? `${nodeLabel(doc, parentId, language)} の子ノード参照が壊れています。${Number(index) + 1}番目の子 "${childId}" が存在しません。`
      : `A child reference under ${nodeLabel(doc, parentId, language)} is broken. Child #${Number(index) + 1} ("${childId}") does not exist.`;
  }

  const parentMatch = error.match(
    /^input\.document\.nodes\.([^.]+)\.parentId references missing node "(.+)"$/,
  );
  if (parentMatch) {
    const [, nodeId, parentId] = parentMatch;
    return language === "ja"
      ? `${nodeLabel(doc, nodeId, language)} の親ノード参照が壊れています。親 "${parentId}" が存在しません。`
      : `The parent reference for ${nodeLabel(doc, nodeId, language)} is broken. Parent "${parentId}" does not exist.`;
  }

  const incomingMatch = error.match(
    /^input\.document\.nodes\.([^.]+) must have incoming count (\d+) \(got (\d+)\)$/,
  );
  if (incomingMatch) {
    const [, nodeId] = incomingMatch;
    return language === "ja"
      ? `${nodeLabel(doc, nodeId, language)} の親子関係が重複または欠落しています。`
      : `The parent/child links around ${nodeLabel(doc, nodeId, language)} are duplicated or missing.`;
  }

  if (error.startsWith("input.document.")) {
    return language === "ja"
      ? `マインドマップ構造に整合性の問題があります。(${error.replace(/^input\.document\./, "")})`
      : `The mind map structure has an integrity problem. (${error.replace(/^input\.document\./, "")})`;
  }

  return error;
}

export function formatLlmDocumentIntegrityError(
  doc: Document,
  errors: string[],
  language: AppLanguage = "ja",
): string {
  const details = errors
    .slice(0, 3)
    .map((error) => `- ${humanizeDocumentError(doc, error, language)}`);
  if (language === "ja") {
    return [
      "現在のマインドマップに整合性の問題があるため、AI を実行できません。",
      "原因候補: 保存済みデータの不整合、または削除済みノード参照の残りです。",
      "詳細:",
      ...details,
    ].join("\n");
  }
  return [
    "AI cannot run because the current mind map has integrity issues.",
    "Possible causes: inconsistent saved data or leftover references to deleted nodes.",
    "Details:",
    ...details,
  ].join("\n");
}

export function formatLlmValidationErrors(
  errors: string[],
  _language: AppLanguage = "ja",
): string {
  return errors.slice(0, 3).join("\n");
}

function responseFieldLabel(
  field: string,
  mode: LlmResponseMode,
  language: AppLanguage,
): string {
  const jaImprove: Record<string, string> = {
    op: "操作種別(op)",
    parentId: "親ノード(parentId)",
    index: "位置(index)",
    node: "追加ノード(node)",
    nodeId: "対象ノード(nodeId)",
    newParentId: "移動先親ノード(newParentId)",
    text: "テキスト(text)",
    color: "色(color)",
    strategy: "削除戦略(strategy)",
  };

  if (language === "ja" && mode === "improve") {
    return jaImprove[field] ?? `${field}`;
  }
  return field;
}

function humanizeResponseError(
  mode: LlmResponseMode,
  error: string,
  language: AppLanguage,
): string {
  const opFieldMatch = error.match(/^input\.operations\[(\d+)\]\.([^. ]+) .+$/);
  if (mode === "improve" && opFieldMatch) {
    const index = Number(opFieldMatch[1]) + 1;
    const field = responseFieldLabel(opFieldMatch[2], mode, language);
    return language === "ja"
      ? `改善案の ${index} 件目で ${field} が欠けているか不正です。`
      : `Improve operation ${index} is missing or has an invalid ${field}.`;
  }

  if (mode === "improve" && error === "input.operations must be an array") {
    return language === "ja"
      ? "改善案の operations が配列になっていません。"
      : "The improve response does not contain an operations array.";
  }

  if (mode === "review" && error === "input.findings must be an array") {
    return language === "ja"
      ? "レビュー結果の findings が配列になっていません。"
      : "The review response does not contain a findings array.";
  }

  if (language === "ja" && error.startsWith("input.")) {
    return `AI 応答の形式が想定と異なります。(${error.replace(/^input\./, "")})`;
  }
  if (language === "en" && error.startsWith("input.")) {
    return `The AI response format did not match the expected schema. (${error.replace(/^input\./, "")})`;
  }
  return error;
}

export function formatLlmResponseValidationError(
  mode: LlmResponseMode,
  errors: string[],
  language: AppLanguage = "ja",
): string {
  const details = errors
    .slice(0, 3)
    .map((error) => `- ${humanizeResponseError(mode, error, language)}`);

  if (language === "ja") {
    const header =
      mode === "generate"
        ? "AI がマップ生成結果を正しい形式で返せませんでした。"
        : mode === "improve"
          ? "AI が改善案を正しい形式で返せなかったため、結果を適用できませんでした。"
          : "AI がレビュー結果を正しい形式で返せませんでした。";
    return [
      header,
      "一時的な応答崩れの可能性があります。もう一度試すと直ることがあります。",
      "詳細:",
      ...details,
    ].join("\n");
  }

  const header =
    mode === "generate"
      ? "The AI did not return a valid generate response."
      : mode === "improve"
        ? "The AI did not return a valid improve response, so the changes could not be applied."
        : "The AI did not return a valid review response.";
  return [
    header,
    "This can happen when the model returns malformed JSON. Retrying may fix it.",
    "Details:",
    ...details,
  ].join("\n");
}

export function formatLlmRuntimeError(
  message: string,
  language: AppLanguage = "ja",
): string {
  if (message.startsWith("Gemini response was cut off before the JSON finished.")) {
    return language === "ja"
      ? "AI の応答が途中で切れたため、結果を読み取れませんでした。\nマップが大きいか、改善内容が多すぎる可能性があります。もう一度試すか、改善方針を少し絞ってください。"
      : "The AI response was cut off before the JSON completed.\nThe map may be large or the requested changes may be too broad. Retry, or narrow the improve goal.";
  }

  if (message.startsWith("Gemini returned invalid JSON:")) {
    return language === "ja"
      ? "AI が壊れた JSON を返したため、結果を読み取れませんでした。\n一時的な応答崩れの可能性があります。もう一度試してください。"
      : "The AI returned malformed JSON, so the result could not be read.\nThis is usually a temporary response-format issue. Please retry.";
  }

  if (message.startsWith("Gemini request timed out")) {
    return language === "ja"
      ? "AI 応答がタイムアウトしました。少し時間をおいて再試行してください。"
      : "The AI request timed out. Please wait a moment and try again.";
  }

  return message;
}
