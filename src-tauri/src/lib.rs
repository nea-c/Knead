#[cfg(not(debug_assertions))]
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::{
    collections::HashMap,
    env, fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
#[cfg(not(debug_assertions))]
use std::{io::Write, process::Command};
#[cfg(not(debug_assertions))]
use tauri::window::{ProgressBarState, ProgressBarStatus};
use tauri::{AppHandle, Manager, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
#[cfg(not(debug_assertions))]
use tauri_plugin_dialog::{MessageDialogButtons, MessageDialogKind};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Sound {
    id: String,
    sounds: Vec<SoundName>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SoundName {
    path: String,
    hash: String,
    pitch: f64,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum SoundEntry {
    Name(String),
    Detail(SoundDetail),
}

#[derive(Debug, Deserialize)]
struct SoundDetail {
    name: String,
    pitch: Option<f64>,
    #[serde(rename = "type")]
    kind: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SoundEvent {
    sounds: Vec<SoundEntry>,
}

#[derive(Default)]
struct AppState {
    selected_sound: Mutex<String>,
    current_sounds: Mutex<Vec<Sound>>,
    timeline_paths: Mutex<HashMap<String, PathBuf>>,
}

#[cfg(not(debug_assertions))]
#[derive(Debug, Deserialize)]
struct ReleaseAsset {
    name: String,
    browser_download_url: String,
}

#[cfg(not(debug_assertions))]
#[derive(Debug, Deserialize)]
struct ReleaseInfo {
    tag_name: String,
    assets: Vec<ReleaseAsset>,
}

#[cfg(not(debug_assertions))]
struct UpdaterText {
    title: &'static str,
    message: &'static str,
    update: &'static str,
    later: &'static str,
    downloading: &'static str,
    launching: &'static str,
    error: &'static str,
    missing: &'static str,
}

#[cfg(not(debug_assertions))]
fn updater_text(language: &str) -> UpdaterText {
    if language == "ja" {
        UpdaterText {
            title: "アップデートが利用可能です",
            message: "新しいバージョン ({latest}) が見つかりました。アップデートしますか？\n現在のバージョン: {current}",
            update: "アップデート",
            later: "後で",
            downloading: "アップデートファイルをダウンロードしています...",
            launching: "アップデーターを起動しています...",
            error: "アップデートエラー",
            missing: "アップデーターが見つかりません",
        }
    } else {
        UpdaterText {
            title: "Update Available",
            message: "New version ({latest}) is available. Would you like to update?\nCurrent version: {current}",
            update: "Update",
            later: "Later",
            downloading: "Downloading update files...",
            launching: "Launching updater...",
            error: "Update Error",
            missing: "Updater not found",
        }
    }
}

fn minecraft_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        return env::var_os("APPDATA")
            .map(PathBuf::from)
            .map(|path| path.join(".minecraft"))
            .ok_or_else(|| "APPDATA is not set".to_string());
    }
    #[cfg(target_os = "macos")]
    {
        return env::var_os("HOME")
            .map(PathBuf::from)
            .map(|path| path.join("Library/Application Support/minecraft"))
            .ok_or_else(|| "HOME is not set".to_string());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        return env::var_os("HOME")
            .map(PathBuf::from)
            .map(|path| path.join(".minecraft"))
            .ok_or_else(|| "HOME is not set".to_string());
    }
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let target = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&target).map_err(|error| error.to_string())?;

    // Electron stored data under %APPDATA%/knead (or the platform equivalent).
    // Copy the two user files once so the desktop migration is lossless.
    if let Ok(config_root) = app.path().config_dir() {
        let legacy = config_root.join("knead");
        for name in ["settings.json", "ratingStar.json"] {
            let from = legacy.join(name);
            let to = target.join(name);
            if !to.exists() && from.is_file() {
                let _ = fs::copy(from, to);
            }
        }
    }
    Ok(target)
}

fn default_settings() -> Value {
    json!({
        "volume": 0.5,
        "language": "en",
        "theme": "system",
        "selectedVersion": null,
        "playbackCategory": "player",
        "holdSoundsSort": false,
        "holdRatingFilter": false,
        "lastSoundsSort": { "id": "ascending", "rating": "none" },
        "lastRatingFilter": []
    })
}

fn load_json(path: &Path, fallback: Value) -> Value {
    match fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
    {
        Some(value) => value,
        None => {
            let _ = fs::write(
                path,
                serde_json::to_string_pretty(&fallback).unwrap_or_default(),
            );
            fallback
        }
    }
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("settings.json"))
}

fn rating_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("ratingStar.json"))
}

fn merged_settings(app: &AppHandle) -> Result<Value, String> {
    let defaults = default_settings();
    let stored = load_json(&settings_path(app)?, defaults.clone());
    let mut merged = defaults.as_object().cloned().unwrap_or_default();
    if let Some(values) = stored.as_object() {
        merged.extend(values.clone());
    }
    Ok(Value::Object(merged))
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    let contents = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    fs::write(path, contents).map_err(|error| error.to_string())
}

fn hash_for(objects: &Map<String, Value>, name: &str) -> String {
    [
        format!("minecraft/sounds/{name}.ogg"),
        format!("sounds/{name}.ogg"),
        format!("sound/{name}.ogg"),
    ]
    .iter()
    .find_map(|key| objects.get(key)?.get("hash")?.as_str())
    .unwrap_or_default()
    .to_string()
}

fn append_entry(
    output: &mut Vec<SoundName>,
    entry: &SoundEntry,
    inherited_pitch: f64,
    events: &HashMap<String, SoundEvent>,
    objects: &Map<String, Value>,
    depth: usize,
) {
    if depth > 32 {
        return;
    }
    match entry {
        SoundEntry::Name(name) => output.push(SoundName {
            path: name.clone(),
            hash: hash_for(objects, name),
            pitch: inherited_pitch.clamp(0.5, 2.0),
        }),
        SoundEntry::Detail(detail) if detail.kind.as_deref() == Some("event") => {
            if let Some(event) = events.get(&detail.name) {
                let pitch = inherited_pitch * detail.pitch.unwrap_or(1.0);
                for nested in &event.sounds {
                    append_entry(output, nested, pitch, events, objects, depth + 1);
                }
            }
        }
        SoundEntry::Detail(detail) => output.push(SoundName {
            path: detail.name.clone(),
            hash: hash_for(objects, &detail.name),
            pitch: (inherited_pitch * detail.pitch.unwrap_or(1.0)).clamp(0.5, 2.0),
        }),
    }
}

#[tauri::command]
fn get_versions() -> Result<Vec<String>, String> {
    let versions = minecraft_dir()?.join("versions");
    // Minecraft is optional. A first launch on a machine where it is not installed
    // should show an empty selector instead of surfacing a filesystem error dialog.
    if !versions.is_dir() {
        return Ok(Vec::new());
    }
    let mut result = Vec::new();
    for entry in
        fs::read_dir(&versions).map_err(|error| format!("{}: {error}", versions.display()))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_dir()
            && fs::read_dir(&path)
                .map(|items| {
                    items.filter_map(Result::ok).any(|item| {
                        item.path().extension().and_then(|ext| ext.to_str()) == Some("json")
                    })
                })
                .unwrap_or(false)
        {
            result.push(entry.file_name().to_string_lossy().into_owned());
        }
    }
    result.sort();
    Ok(result)
}

#[tauri::command]
fn get_mc_sounds(version: String, state: State<'_, AppState>) -> Result<Vec<Sound>, String> {
    if version.contains(['/', '\\']) || version == "." || version == ".." {
        return Err("Invalid Minecraft version".to_string());
    }
    let root = minecraft_dir()?;
    let version_json = root
        .join("versions")
        .join(&version)
        .join(format!("{version}.json"));
    let version_value: Value = serde_json::from_str(
        &fs::read_to_string(&version_json)
            .map_err(|error| format!("{}: {error}", version_json.display()))?,
    )
    .map_err(|error| error.to_string())?;
    let asset_index = version_value
        .pointer("/assetIndex/id")
        .and_then(Value::as_str)
        .ok_or_else(|| "assetIndex.id is missing".to_string())?;
    let index_path = root
        .join("assets/indexes")
        .join(format!("{asset_index}.json"));
    let index: Value = serde_json::from_str(
        &fs::read_to_string(&index_path)
            .map_err(|error| format!("{}: {error}", index_path.display()))?,
    )
    .map_err(|error| error.to_string())?;
    let objects = index
        .get("objects")
        .and_then(Value::as_object)
        .ok_or_else(|| "Asset index objects are missing".to_string())?;
    let sounds_hash = objects
        .iter()
        .find(|(key, _)| key.ends_with("sounds.json"))
        .and_then(|(_, value)| value.get("hash"))
        .and_then(Value::as_str)
        .ok_or_else(|| "sounds.json is missing from the asset index".to_string())?;
    if sounds_hash.len() < 2
        || !sounds_hash
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Err("sounds.json has an invalid asset hash".to_string());
    }
    let sounds_path = root
        .join("assets/objects")
        .join(&sounds_hash[..2])
        .join(sounds_hash);
    let events: HashMap<String, SoundEvent> = serde_json::from_str(
        &fs::read_to_string(&sounds_path)
            .map_err(|error| format!("{}: {error}", sounds_path.display()))?,
    )
    .map_err(|error| error.to_string())?;

    let mut result = Vec::with_capacity(events.len());
    for (id, event) in &events {
        let mut sounds = Vec::new();
        for entry in &event.sounds {
            append_entry(&mut sounds, entry, 1.0, &events, objects, 0);
        }
        result.push(Sound {
            id: id.clone(),
            sounds,
        });
    }
    result.sort_by(|a, b| a.id.cmp(&b.id));
    *state
        .current_sounds
        .lock()
        .map_err(|error| error.to_string())? = result.clone();
    Ok(result)
}

#[tauri::command]
fn get_mc_sound_hash(hash: String) -> Result<String, String> {
    if hash.is_empty() {
        return Ok(String::new());
    }
    if hash.len() < 2 || !hash.chars().all(|character| character.is_ascii_hexdigit()) {
        return Err("Invalid sound hash".to_string());
    }
    Ok(minecraft_dir()?
        .join("assets/objects")
        .join(&hash[..2])
        .join(hash)
        .to_string_lossy()
        .into_owned())
}

#[tauri::command]
fn load_settings(app: AppHandle) -> Result<Value, String> {
    merged_settings(&app)
}

#[tauri::command]
fn update_settings(app: AppHandle, partial: Value) -> Result<(), String> {
    let mut settings = merged_settings(&app)?;
    let target = settings
        .as_object_mut()
        .ok_or_else(|| "Invalid settings".to_string())?;
    let values = partial
        .as_object()
        .ok_or_else(|| "Settings update must be an object".to_string())?;
    target.extend(values.clone());
    write_json(&settings_path(&app)?, &settings)
}

#[tauri::command]
fn get_setting(app: AppHandle, key: String) -> Result<Value, String> {
    Ok(merged_settings(&app)?
        .get(&key)
        .cloned()
        .unwrap_or(Value::Null))
}

#[tauri::command]
fn set_setting(app: AppHandle, key: String, value: Value) -> Result<(), String> {
    let mut settings = merged_settings(&app)?;
    settings
        .as_object_mut()
        .ok_or_else(|| "Invalid settings".to_string())?
        .insert(key, value);
    write_json(&settings_path(&app)?, &settings)
}

#[tauri::command]
fn load_rating_star(app: AppHandle) -> Result<Value, String> {
    Ok(load_json(&rating_path(&app)?, json!({})))
}

#[tauri::command]
fn save_rating_star(app: AppHandle, data: String) -> Result<(), String> {
    save_rating_star_as_string(app, data)
}

#[tauri::command]
fn save_rating_star_as_string(app: AppHandle, data: String) -> Result<(), String> {
    let value: Value = serde_json::from_str(&data).map_err(|error| error.to_string())?;
    write_json(&rating_path(&app)?, &value)
}

#[tauri::command]
fn update_rating_star(app: AppHandle, key: String, value: f64) -> Result<(), String> {
    let mut ratings = load_json(&rating_path(&app)?, json!({}));
    ratings
        .as_object_mut()
        .ok_or_else(|| "Invalid rating data".to_string())?
        .insert(key, json!(value));
    write_json(&rating_path(&app)?, &ratings)
}

#[tauri::command]
fn set_selected_sound(id: String, state: State<'_, AppState>) -> Result<(), String> {
    *state
        .selected_sound
        .lock()
        .map_err(|error| error.to_string())? = id;
    Ok(())
}

#[tauri::command]
fn get_main_selected_sound(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state
        .selected_sound
        .lock()
        .map_err(|error| error.to_string())?
        .clone())
}

#[tauri::command]
fn get_current_sounds(state: State<'_, AppState>) -> Result<Vec<Sound>, String> {
    Ok(state
        .current_sounds
        .lock()
        .map_err(|error| error.to_string())?
        .clone())
}

#[tauri::command]
fn make_sub_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("sub")
        .ok_or_else(|| "Timeline window is not initialized".to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

fn ok_path(path: &Path) -> Value {
    json!({ "ok": true, "path": path.to_string_lossy() })
}

#[tauri::command]
fn timeline_save(window: WebviewWindow, json: String, state: State<'_, AppState>) -> Value {
    let path = state
        .timeline_paths
        .lock()
        .ok()
        .and_then(|paths| paths.get(window.label()).cloned());
    match path {
        Some(path) => match fs::write(&path, json) {
            Ok(()) => ok_path(&path),
            Err(error) => json!({ "ok": false, "error": error.to_string() }),
        },
        None => json!({ "ok": false, "error": "上書き先が未選択です" }),
    }
}

#[tauri::command]
async fn timeline_save_dialog(
    app: AppHandle,
    window: WebviewWindow,
    default_path: Option<String>,
    json: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let mut dialog = app
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("Knead Project を保存")
        .add_filter("Knead Project", &["kp"])
        .set_file_name(default_path.as_deref().unwrap_or("timeline.kp"));
    if let Some(parent) = default_path
        .as_deref()
        .map(Path::new)
        .and_then(Path::parent)
    {
        if parent.is_dir() {
            dialog = dialog.set_directory(parent);
        }
    }
    let Some(file) = dialog.blocking_save_file() else {
        return Ok(json!({ "ok": false, "canceled": true }));
    };
    let path = match file.into_path() {
        Ok(path) => path,
        Err(error) => return Ok(json!({ "ok": false, "error": error.to_string() })),
    };
    Ok(match fs::write(&path, json) {
        Ok(()) => {
            if let Ok(mut paths) = state.timeline_paths.lock() {
                paths.insert(window.label().to_string(), path.clone());
            }
            ok_path(&path)
        }
        Err(error) => json!({ "ok": false, "error": error.to_string() }),
    })
}

#[tauri::command]
async fn timeline_open_dialog(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let file = app
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("Knead Project を開く")
        .add_filter("Knead Project", &["kp"])
        .blocking_pick_file();
    let Some(file) = file else {
        return Ok(json!({ "ok": false, "canceled": true }));
    };
    let path = match file.into_path() {
        Ok(path) => path,
        Err(error) => return Ok(json!({ "ok": false, "error": error.to_string() })),
    };
    Ok(match fs::read_to_string(&path) {
        Ok(contents) => {
            if let Ok(mut paths) = state.timeline_paths.lock() {
                paths.insert(window.label().to_string(), path.clone());
            }
            json!({ "ok": true, "path": path.to_string_lossy(), "json": contents })
        }
        Err(error) => json!({ "ok": false, "error": error.to_string() }),
    })
}

#[cfg(not(debug_assertions))]
fn show_update_error(app: &AppHandle, title: &str, message: impl Into<String>) {
    app.dialog()
        .message(message.into())
        .title(title)
        .kind(MessageDialogKind::Error)
        .show(|_| {});
}

#[cfg(not(debug_assertions))]
fn updater_executable_name() -> Option<&'static str> {
    #[cfg(target_os = "windows")]
    return Some("Knead-Updater.exe");
    #[cfg(target_os = "macos")]
    return Some("Knead-Updater-macos");
    #[cfg(all(unix, not(target_os = "macos")))]
    return Some("Knead-Updater-linux");
    #[allow(unreachable_code)]
    None
}

#[cfg(not(debug_assertions))]
async fn check_for_updates(app: AppHandle) -> Result<(), String> {
    let current = app.package_info().version.clone();
    let settings = merged_settings(&app)?;
    let language = settings
        .get("language")
        .and_then(Value::as_str)
        .unwrap_or("en");
    let text = updater_text(language);
    let client = reqwest::Client::builder()
        .user_agent(format!("Knead/{current}"))
        .build()
        .map_err(|error| error.to_string())?;
    let release: ReleaseInfo = client
        .get("https://api.github.com/repos/nea-c/Knead/releases/latest")
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json()
        .await
        .map_err(|error| error.to_string())?;
    let latest = semver::Version::parse(release.tag_name.trim_start_matches('v'))
        .map_err(|error| error.to_string())?;
    if latest <= current {
        return Ok(());
    }

    let Some(main) = app.get_webview_window("main") else {
        return Err("Main window not found".to_string());
    };
    let message = text
        .message
        .replace("{latest}", &latest.to_string())
        .replace("{current}", &current.to_string());
    let accepted = app
        .dialog()
        .message(message)
        .title(text.title)
        .parent(&main)
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCancelCustom(
            text.update.to_string(),
            text.later.to_string(),
        ))
        .blocking_show();
    if !accepted {
        return Ok(());
    }

    let updater_name = updater_executable_name()
        .ok_or_else(|| "The current platform is not supported by the updater".to_string())?;
    let executable = env::current_exe().map_err(|error| error.to_string())?;
    let executable_dir = executable
        .parent()
        .ok_or_else(|| "Application directory not found".to_string())?;
    let updater = executable_dir.join(updater_name);
    if !updater.is_file() {
        show_update_error(
            &app,
            text.error,
            format!("{}: {}", text.missing, updater.display()),
        );
        return Ok(());
    }
    let asset = release
        .assets
        .iter()
        .find(|asset| asset.name.ends_with(".zip"))
        .ok_or_else(|| "No ZIP asset found in the latest release".to_string())?;
    let zip_path = executable_dir.join(&asset.name);
    let response = client
        .get(&asset.browser_download_url)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    let total = response.content_length();
    let mut downloaded = 0_u64;
    let mut stream = response.bytes_stream();
    let mut output = fs::File::create(&zip_path).map_err(|error| error.to_string())?;
    let _ = main.set_title(text.downloading);
    let _ = main.set_progress_bar(ProgressBarState {
        status: Some(ProgressBarStatus::Normal),
        progress: Some(0),
    });
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| error.to_string())?;
        output
            .write_all(&chunk)
            .map_err(|error| error.to_string())?;
        downloaded += chunk.len() as u64;
        if let Some(total) = total.filter(|total| *total > 0) {
            let percent = (downloaded.saturating_mul(100) / total).min(100);
            let _ = main.set_title(&format!("{} {percent}%", text.downloading));
            let _ = main.set_progress_bar(ProgressBarState {
                status: Some(ProgressBarStatus::Normal),
                progress: Some(percent),
            });
        }
    }
    output.flush().map_err(|error| error.to_string())?;
    let _ = main.set_title(text.launching);
    let _ = main.set_progress_bar(ProgressBarState {
        status: Some(ProgressBarStatus::None),
        progress: None,
    });

    Command::new(&updater)
        .arg("--zip")
        .arg(&zip_path)
        .arg("--appExe")
        .arg(&executable)
        .arg("--called-from-parent")
        .current_dir(executable_dir)
        .spawn()
        .map_err(|error| error.to_string())?;
    app.exit(0);
    Ok(())
}

fn start_update_check(app: AppHandle) {
    #[cfg(not(debug_assertions))]
    tauri::async_runtime::spawn(async move {
        if let Err(error) = check_for_updates(app.clone()).await {
            let language = merged_settings(&app)
                .ok()
                .and_then(|settings| settings.get("language").cloned())
                .and_then(|value| value.as_str().map(ToOwned::to_owned))
                .unwrap_or_else(|| "en".to_string());
            let text = updater_text(&language);
            show_update_error(&app, text.error, error);
        }
    });
    #[cfg(debug_assertions)]
    let _ = app;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } if window.label() == "sub" => {
                api.prevent_close();
                let _ = window.hide();
                if let Some(main) = window.app_handle().get_webview_window("main") {
                    let _ = main.set_focus();
                }
            }
            tauri::WindowEvent::CloseRequested { .. } if window.label() == "main" => {
                window.app_handle().exit(0);
            }
            _ => {}
        })
        .setup(|app| {
            start_update_check(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_versions,
            get_mc_sounds,
            get_mc_sound_hash,
            make_sub_window,
            load_settings,
            update_settings,
            get_setting,
            set_setting,
            load_rating_star,
            save_rating_star,
            save_rating_star_as_string,
            update_rating_star,
            get_current_sounds,
            set_selected_sound,
            get_main_selected_sound,
            timeline_save,
            timeline_save_dialog,
            timeline_open_dialog,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Knead");
}
