import { invoke } from "@tauri-apps/api/core";
import type { GenerateRequest, ImproveRequest, ReviewRequest } from "./schema";

export type LlmProvider = "gemini";

export type LlmSettings = {
  provider: LlmProvider;
  model: string;
  hasApiKey: boolean;
};

export type SaveLlmSettingsInput = {
  provider: LlmProvider;
  model: string;
  apiKey?: string;
};

export type TestLlmConnectionInput = {
  provider: LlmProvider;
  model: string;
  apiKey?: string;
};

export type LlmConnectionTestResult = {
  ok: boolean;
  message: string;
  model: string;
};

export const GEMINI_MODEL_OPTIONS = [
  "gemini-3-flash-preview",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
] as const;

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  provider: "gemini",
  model: GEMINI_MODEL_OPTIONS[0],
  hasApiKey: false,
};

function isProvider(value: unknown): value is LlmProvider {
  return value === "gemini";
}

function normalizeSettings(value: unknown): LlmSettings {
  if (!value || typeof value !== "object") {
    throw new Error("invalid settings payload");
  }
  const record = value as Record<string, unknown>;
  const provider = record.provider;
  const model = record.model;
  const hasApiKey = record.hasApiKey;

  if (!isProvider(provider)) {
    throw new Error("invalid provider");
  }
  if (typeof model !== "string" || model.trim() === "") {
    throw new Error("invalid model");
  }
  if (typeof hasApiKey !== "boolean") {
    throw new Error("invalid hasApiKey");
  }

  return {
    provider,
    model,
    hasApiKey,
  };
}

function normalizeConnectionTest(value: unknown): LlmConnectionTestResult {
  if (!value || typeof value !== "object") {
    throw new Error("invalid connection test payload");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.ok !== "boolean") {
    throw new Error("invalid test result: ok");
  }
  if (typeof record.message !== "string") {
    throw new Error("invalid test result: message");
  }
  if (typeof record.model !== "string") {
    throw new Error("invalid test result: model");
  }
  return {
    ok: record.ok,
    message: record.message,
    model: record.model,
  };
}

export async function loadLlmSettings(): Promise<LlmSettings> {
  const value = await invoke("load_llm_settings");
  return normalizeSettings(value);
}

export async function saveLlmSettings(input: SaveLlmSettingsInput): Promise<LlmSettings> {
  const value = await invoke("save_llm_settings", { settings: input });
  return normalizeSettings(value);
}

export async function testLlmConnection(
  input: TestLlmConnectionInput,
): Promise<LlmConnectionTestResult> {
  const value = await invoke("test_llm_connection", { request: input });
  return normalizeConnectionTest(value);
}

export async function runLlmGenerate(request: GenerateRequest): Promise<unknown> {
  return invoke("llm_generate", { request: { requestJson: JSON.stringify(request) } });
}

export async function runLlmImprove(request: ImproveRequest): Promise<unknown> {
  return invoke("llm_improve", { request: { requestJson: JSON.stringify(request) } });
}

export async function runLlmReview(request: ReviewRequest): Promise<unknown> {
  return invoke("llm_review", { request: { requestJson: JSON.stringify(request) } });
}

export function parseErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }
  return "Unknown error";
}
