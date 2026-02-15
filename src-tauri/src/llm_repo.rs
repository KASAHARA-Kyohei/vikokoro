use keyring::Entry;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

const GEMINI_PROVIDER: &str = "gemini";
const GEMINI_DEFAULT_MODEL: &str = "gemini-3-flash-preview";
const GEMINI_MODELS: [&str; 4] = [
    "gemini-3-flash-preview",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
];
const GEMINI_API_KEY_ACCOUNT: &str = "gemini_api_key";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmSettings {
    provider: String,
    model: String,
    has_api_key: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLlmSettingsInput {
    provider: String,
    model: String,
    api_key: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestLlmConnectionInput {
    provider: String,
    model: String,
    api_key: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmSchemaRequestInput {
    request_json: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmConnectionTestResult {
    ok: bool,
    message: String,
    model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LlmSettingsFile {
    provider: String,
    model: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    api_key_fallback: Option<String>,
}

fn default_llm_settings_file() -> LlmSettingsFile {
    LlmSettingsFile {
        provider: GEMINI_PROVIDER.to_string(),
        model: GEMINI_DEFAULT_MODEL.to_string(),
        api_key_fallback: None,
    }
}

fn llm_settings_json_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .resolve("llm_settings.json", tauri::path::BaseDirectory::AppData)
        .map_err(|e| e.to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

fn llm_settings_broken_backup_path(path: &Path) -> PathBuf {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    parent.join(format!("llm_settings.json.broken-{millis}"))
}

fn write_json_atomic(path: &Path, text: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "json path has no parent".to_string())?;
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let tmp_path = parent.join(format!("tmp-{millis}.json"));

    fs::write(&tmp_path, text).map_err(|e| e.to_string())?;
    match fs::rename(&tmp_path, path) {
        Ok(()) => Ok(()),
        Err(_) => {
            if path.exists() {
                let _ = fs::remove_file(path);
            }
            fs::rename(&tmp_path, path).map_err(|e| e.to_string())?;
            Ok(())
        }
    }
}

fn validate_provider_model(provider: &str, model: &str) -> Result<(), String> {
    if provider != GEMINI_PROVIDER {
        return Err(format!(
            "unsupported provider \"{provider}\": expected \"{GEMINI_PROVIDER}\""
        ));
    }
    if !GEMINI_MODELS.contains(&model) {
        return Err(format!("unsupported Gemini model \"{model}\""));
    }
    Ok(())
}

fn normalize_settings_file(settings: &LlmSettingsFile) -> Result<LlmSettingsFile, String> {
    let provider = settings.provider.trim();
    let model = settings.model.trim();
    validate_provider_model(provider, model)?;
    let api_key_fallback = settings
        .api_key_fallback
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string);
    Ok(LlmSettingsFile {
        provider: provider.to_string(),
        model: model.to_string(),
        api_key_fallback,
    })
}

fn read_llm_settings_file(path: &Path) -> Result<LlmSettingsFile, String> {
    if !path.exists() {
        return Ok(default_llm_settings_file());
    }
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    match serde_json::from_str::<LlmSettingsFile>(&text) {
        Ok(settings) => normalize_settings_file(&settings).or_else(|_| {
            let backup_path = llm_settings_broken_backup_path(path);
            let _ = fs::rename(path, &backup_path);
            Ok(default_llm_settings_file())
        }),
        Err(_) => {
            let backup_path = llm_settings_broken_backup_path(path);
            let _ = fs::rename(path, &backup_path);
            Ok(default_llm_settings_file())
        }
    }
}

fn keyring_entry(app: &tauri::AppHandle) -> Result<Entry, String> {
    let service = format!("{}.llm", app.config().identifier);
    Entry::new(&service, GEMINI_API_KEY_ACCOUNT).map_err(|e| e.to_string())
}

fn load_api_key(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    let entry = keyring_entry(app)?;
    match entry.get_password() {
        Ok(value) => {
            if value.trim().is_empty() {
                Ok(None)
            } else {
                Ok(Some(value))
            }
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

fn save_api_key(app: &tauri::AppHandle, api_key: &str) -> Result<(), String> {
    let entry = keyring_entry(app)?;
    entry.set_password(api_key).map_err(|e| e.to_string())
}

fn clear_api_key(app: &tauri::AppHandle) -> Result<(), String> {
    let entry = keyring_entry(app)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

fn load_api_key_with_fallback(
    app: &tauri::AppHandle,
    settings_file: &LlmSettingsFile,
) -> Result<Option<String>, String> {
    if let Some(api_key) = load_api_key(app)? {
        return Ok(Some(api_key));
    }
    Ok(settings_file.api_key_fallback.clone())
}

pub fn load_llm_settings_from_disk(app: &tauri::AppHandle) -> Result<LlmSettings, String> {
    let path = llm_settings_json_path(app)?;
    let settings_file = read_llm_settings_file(&path)?;
    let has_api_key = load_api_key_with_fallback(app, &settings_file)?.is_some();
    Ok(LlmSettings {
        provider: settings_file.provider,
        model: settings_file.model,
        has_api_key,
    })
}

pub fn save_llm_settings_to_disk(
    app: &tauri::AppHandle,
    input: SaveLlmSettingsInput,
) -> Result<LlmSettings, String> {
    let provider = input.provider.trim().to_string();
    let model = input.model.trim().to_string();
    validate_provider_model(&provider, &model)?;
    let path = llm_settings_json_path(app)?;
    let previous = read_llm_settings_file(&path)?;
    let mut api_key_fallback = previous.api_key_fallback.clone();

    if let Some(api_key) = input.api_key.as_deref() {
        let trimmed = api_key.trim();
        if trimmed.is_empty() {
            let _ = clear_api_key(app);
            api_key_fallback = None;
        } else {
            match save_api_key(app, trimmed) {
                Ok(()) => {
                    if load_api_key(app)?.is_some() {
                        api_key_fallback = None;
                    } else {
                        api_key_fallback = Some(trimmed.to_string());
                    }
                }
                Err(_) => {
                    api_key_fallback = Some(trimmed.to_string());
                }
            }
        }
    }

    let settings_file = LlmSettingsFile {
        provider: provider.clone(),
        model: model.clone(),
        api_key_fallback,
    };
    let text = serde_json::to_string_pretty(&settings_file).map_err(|e| e.to_string())?;
    write_json_atomic(&path, &format!("{text}\n"))?;

    let has_api_key = load_api_key_with_fallback(app, &settings_file)?.is_some();
    Ok(LlmSettings {
        provider,
        model,
        has_api_key,
    })
}

fn gemini_error_message(status: StatusCode, detail: String) -> String {
    if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
        "Authentication failed. Check API key and model access.".to_string()
    } else if status == StatusCode::TOO_MANY_REQUESTS {
        "Rate limit exceeded. Retry later.".to_string()
    } else if detail.is_empty() {
        format!("Gemini API returned {status}")
    } else {
        format!("Gemini API returned {status}: {detail}")
    }
}

async fn send_gemini_generate_content(model: &str, api_key: &str, body: Value) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent");
    let response = client
        .post(url)
        .header("x-goog-api-key", api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Gemini request timed out after 60s. Retry later or try a smaller prompt/model.".to_string()
            } else if e.is_connect() {
                format!("Gemini connection failed: {e}")
            } else {
                format!("Gemini request failed: {e}")
            }
        })?;

    if response.status().is_success() {
        return response
            .json::<Value>()
            .await
            .map_err(|e| format!("Gemini response parse failed: {e}"));
    }

    let status = response.status();
    let detail = response
        .text()
        .await
        .unwrap_or_else(|_| "".to_string())
        .chars()
        .take(240)
        .collect::<String>();

    Err(gemini_error_message(status, detail))
}

fn extract_candidate_text(response: &Value) -> Result<String, String> {
    let candidates = response
        .get("candidates")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Gemini response has no candidates array".to_string())?;
    let first = candidates
        .first()
        .ok_or_else(|| "Gemini response returned no candidates".to_string())?;
    let parts = first
        .get("content")
        .and_then(|v| v.get("parts"))
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Gemini response has no content.parts".to_string())?;
    for part in parts {
        if let Some(text) = part.get("text").and_then(|v| v.as_str()) {
            return Ok(text.to_string());
        }
    }
    Err("Gemini response has no text part".to_string())
}

fn strip_markdown_code_fence(text: &str) -> String {
    let trimmed = text.trim();
    if !trimmed.starts_with("```") {
        return trimmed.to_string();
    }

    let after_header = match trimmed.find('\n') {
        Some(index) => &trimmed[index + 1..],
        None => return trimmed.trim_matches('`').trim().to_string(),
    };
    let without_footer = match after_header.rfind("```") {
        Some(index) => &after_header[..index],
        None => after_header,
    };
    without_footer.trim().to_string()
}

fn load_runtime_model_and_api_key(app: &tauri::AppHandle) -> Result<(String, String), String> {
    let path = llm_settings_json_path(app)?;
    let settings = read_llm_settings_file(&path)?;
    validate_provider_model(&settings.provider, &settings.model)?;
    let api_key = load_api_key_with_fallback(app, &settings)?
        .ok_or_else(|| "Gemini API key is not set".to_string())?;
    Ok((settings.model, api_key))
}

fn build_generate_prompt(request_json: &str) -> String {
    format!(
        "You are a planning assistant for mind maps.\n\
Return exactly one valid JSON object.\n\
No markdown. No code fences. No explanations.\n\
Output schema:\n\
{{\"version\":\"1\",\"mode\":\"generate\",\"root\":{{\"tempId\":\"string\",\"text\":\"string\",\"color\":null|\"blue\"|\"green\"|\"yellow\"|\"pink\"|\"gray\",\"children\":[...]}}}}\n\
Use this request JSON as strict constraints:\n{request_json}"
    )
}

fn build_improve_prompt(request_json: &str) -> String {
    format!(
        "You are a planning assistant for mind maps.\n\
Return exactly one valid JSON object.\n\
No markdown. No code fences. No explanations.\n\
Output schema:\n\
{{\"version\":\"1\",\"mode\":\"improve\",\"summary\":\"string\",\"operations\":[{{\"op\":\"add\"|\"updateText\"|\"setColor\"|\"move\"|\"delete\",...}}],\"warnings\":[\"string\"]}}\n\
Use this request JSON as strict constraints:\n{request_json}"
    )
}

async fn run_gemini_json_with_prompt(
    app: &tauri::AppHandle,
    prompt: String,
) -> Result<Value, String> {
    let (model, api_key) = load_runtime_model_and_api_key(app)?;
    let body = serde_json::json!({
      "contents": [
        {
          "role": "user",
          "parts": [{ "text": prompt }]
        }
      ],
      "generationConfig": {
        "temperature": 0.2,
        "maxOutputTokens": 4096,
        "responseMimeType": "application/json"
      }
    });

    let response = send_gemini_generate_content(&model, &api_key, body).await?;
    let text = extract_candidate_text(&response)?;
    let cleaned = strip_markdown_code_fence(&text);
    serde_json::from_str::<Value>(&cleaned)
        .map_err(|e| format!("Gemini returned invalid JSON: {e}. Raw: {cleaned}"))
}

pub async fn llm_generate(
    app: &tauri::AppHandle,
    request: LlmSchemaRequestInput,
) -> Result<Value, String> {
    let request_json = request.request_json.trim();
    if request_json.is_empty() {
        return Err("requestJson is empty".to_string());
    }
    run_gemini_json_with_prompt(app, build_generate_prompt(request_json)).await
}

pub async fn llm_improve(
    app: &tauri::AppHandle,
    request: LlmSchemaRequestInput,
) -> Result<Value, String> {
    let request_json = request.request_json.trim();
    if request_json.is_empty() {
        return Err("requestJson is empty".to_string());
    }
    run_gemini_json_with_prompt(app, build_improve_prompt(request_json)).await
}

pub async fn test_llm_connection(
    app: &tauri::AppHandle,
    input: TestLlmConnectionInput,
) -> Result<LlmConnectionTestResult, String> {
    let provider = input.provider.trim().to_string();
    let model = input.model.trim().to_string();
    validate_provider_model(&provider, &model)?;

    let settings_path = llm_settings_json_path(app)?;
    let settings_file = read_llm_settings_file(&settings_path)?;
    let api_key = match input.api_key {
        Some(key) => {
            let trimmed = key.trim().to_string();
            if trimmed.is_empty() {
                load_api_key_with_fallback(app, &settings_file)?
            } else {
                Some(trimmed)
            }
        }
        None => load_api_key_with_fallback(app, &settings_file)?,
    }
    .ok_or_else(|| "Gemini API key is not set".to_string())?;

    let body = serde_json::json!({
      "contents": [
        {
          "role": "user",
          "parts": [{ "text": "Respond with OK" }]
        }
      ],
      "generationConfig": {
        "temperature": 0,
        "maxOutputTokens": 8
      }
    });
    let _ = send_gemini_generate_content(&model, &api_key, body).await?;

    Ok(LlmConnectionTestResult {
        ok: true,
        message: "Connection successful".to_string(),
        model,
    })
}
