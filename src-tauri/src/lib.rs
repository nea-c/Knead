use futures_util::{stream, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use sha1::{Digest, Sha1};
use std::{
    collections::{HashMap, HashSet},
    env, fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::{Duration, SystemTime},
};
#[cfg(not(debug_assertions))]
use std::{io::Write, process::Command};
#[cfg(not(debug_assertions))]
use tauri::window::{ProgressBarState, ProgressBarStatus};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
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

#[derive(Debug, Clone, Deserialize, Serialize)]
struct VersionManifest {
    versions: Vec<ManifestVersion>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct ManifestVersion {
    id: String,
    url: String,
    sha1: String,
    #[serde(rename = "type")]
    kind: String,
}

#[derive(Debug, Clone, Deserialize)]
struct AssetIndexReference {
    id: String,
    url: String,
    sha1: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VersionMetadata {
    asset_index: AssetIndexReference,
}

#[derive(Debug, Clone, Deserialize)]
struct AssetIndex {
    objects: HashMap<String, AssetObject>,
}

#[derive(Debug, Clone, Deserialize)]
struct AssetObject {
    hash: String,
    size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AssetDownloadResult {
    version: String,
    asset_index: String,
    downloaded_assets: usize,
    reused_assets: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AssetDownloadProgress {
    version: String,
    completed_assets: usize,
    total_assets: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MinecraftVersion {
    id: String,
    downloaded: bool,
}

const VERSION_MANIFEST_URL: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const ASSET_OBJECT_BASE_URL: &str = "https://resources.download.minecraft.net";
const ASSET_DOWNLOAD_CONCURRENCY: usize = 12;
const VERSION_MANIFEST_CACHE_MAX_AGE: Duration = Duration::from_secs(6 * 60 * 60);
static DOWNLOAD_TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Default)]
struct AppState {
    selected_sound: Mutex<String>,
    current_sounds: Mutex<Vec<Sound>>,
    timeline_paths: Mutex<HashMap<String, PathBuf>>,
    pending_timeline_path: Mutex<Option<PathBuf>>,
}

const TIMELINE_OPEN_REQUESTED_EVENT: &str = "timeline-open-requested";

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

fn validate_version(version: &str) -> Result<(), String> {
    if version.is_empty()
        || version.contains(['/', '\\'])
        || version == "."
        || version == ".."
        || version.chars().any(char::is_control)
    {
        return Err("Invalid Minecraft version".to_string());
    }
    Ok(())
}

fn version_json_path(root: &Path, version: &str) -> PathBuf {
    root.join("versions")
        .join(version)
        .join(format!("{version}.json"))
}

fn asset_index_path(root: &Path, asset_index: &str) -> PathBuf {
    root.join("assets/indexes")
        .join(format!("{asset_index}.json"))
}

fn sha1_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha1::digest(bytes))
}

fn verify_download(bytes: &[u8], expected_sha1: &str, label: &str) -> Result<(), String> {
    if sha1_hex(bytes) != expected_sha1.to_ascii_lowercase() {
        return Err(format!("SHA-1 verification failed for {label}"));
    }
    Ok(())
}

fn write_download(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Invalid download path: {}", path.display()))?;
    fs::create_dir_all(parent).map_err(|error| format!("{}: {error}", parent.display()))?;
    let file_name = path
        .file_name()
        .ok_or_else(|| format!("Invalid download path: {}", path.display()))?
        .to_string_lossy();
    let temporary = parent.join(format!(
        "{file_name}.{}.{}.part",
        std::process::id(),
        DOWNLOAD_TEMP_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::write(&temporary, bytes).map_err(|error| format!("{}: {error}", temporary.display()))?;
    if let Err(error) = fs::rename(&temporary, path) {
        // Another request may have completed the same content-addressed download.
        if path.is_file() {
            let _ = fs::remove_file(&temporary);
            return Ok(());
        }
        let _ = fs::remove_file(&temporary);
        return Err(format!("{}: {error}", path.display()));
    }
    Ok(())
}

async fn download_bytes(
    client: &reqwest::Client,
    url: &str,
    label: &str,
) -> Result<Vec<u8>, String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Failed to download {label}: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Failed to download {label}: {error}"))?;
    Ok(response
        .bytes()
        .await
        .map_err(|error| format!("Failed to read {label}: {error}"))?
        .to_vec())
}

async fn fetch_version_manifest(client: &reqwest::Client) -> Result<VersionManifest, String> {
    client
        .get(VERSION_MANIFEST_URL)
        .send()
        .await
        .map_err(|error| format!("Failed to download the Minecraft version list: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Failed to download the Minecraft version list: {error}"))?
        .json::<VersionManifest>()
        .await
        .map_err(|error| format!("Invalid Minecraft version list: {error}"))
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T, String> {
    let raw = fs::read(path).map_err(|error| format!("{}: {error}", path.display()))?;
    serde_json::from_slice(&raw).map_err(|error| format!("{}: {error}", path.display()))
}

fn manifest_cache_path(root: &Path) -> PathBuf {
    root.join("assets/knead/version_manifest_v2.json")
}

async fn version_manifest(
    client: &reqwest::Client,
    root: &Path,
) -> Result<VersionManifest, String> {
    let cache_path = manifest_cache_path(root);
    let cached = read_json::<VersionManifest>(&cache_path).ok();
    let cache_is_fresh = cache_path
        .metadata()
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| SystemTime::now().duration_since(modified).ok())
        .map(|age| age <= VERSION_MANIFEST_CACHE_MAX_AGE)
        .unwrap_or(false);
    if cache_is_fresh {
        if let Some(manifest) = cached.clone() {
            return Ok(manifest);
        }
    }

    match fetch_version_manifest(client).await {
        Ok(manifest) => {
            if let Ok(bytes) = serde_json::to_vec(&manifest) {
                let _ = write_download(&cache_path, &bytes);
            }
            Ok(manifest)
        }
        Err(_) if cached.is_some() => Ok(cached.expect("cached manifest should exist")),
        Err(error) => Err(error),
    }
}

fn download_marker_path(root: &Path, version: &str) -> PathBuf {
    root.join("assets/knead/downloaded")
        .join(format!("{}.complete", sha1_hex(version.as_bytes())))
}

fn mark_version_downloaded(root: &Path, version: &str) -> Result<(), String> {
    write_download(&download_marker_path(root, version), b"complete\n")
}

fn local_versions(root: &Path) -> Result<Vec<String>, String> {
    let versions = root.join("versions");
    if !versions.is_dir() {
        return Ok(Vec::new());
    }
    let mut result = Vec::new();
    for entry in
        fs::read_dir(&versions).map_err(|error| format!("{}: {error}", versions.display()))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let version = entry.file_name().to_string_lossy().into_owned();
        if entry.path().is_dir() && version_json_path(root, &version).is_file() {
            result.push(version);
        }
    }
    Ok(result)
}

fn is_version_downloaded(root: &Path, version: &str) -> bool {
    if download_marker_path(root, version).is_file() {
        return true;
    }

    // Compatibility for versions installed before completion markers existed.
    // Checking one required object keeps startup fast; selecting the version still
    // verifies and repairs every sound asset before marking it complete.
    let metadata = match read_json::<VersionMetadata>(&version_json_path(root, version)) {
        Ok(metadata) => metadata,
        Err(_) => return false,
    };
    let index = match read_json::<AssetIndex>(&asset_index_path(root, &metadata.asset_index.id)) {
        Ok(index) => index,
        Err(_) => return false,
    };
    let object = match index
        .objects
        .iter()
        .find(|(name, _)| name.ends_with("sounds.json"))
        .map(|(_, object)| object)
    {
        Some(object)
            if object.hash.len() == 40
                && object.hash.chars().all(|value| value.is_ascii_hexdigit()) =>
        {
            object
        }
        _ => return false,
    };
    root.join("assets/objects")
        .join(&object.hash[..2])
        .join(&object.hash)
        .metadata()
        .map(|metadata| metadata.is_file() && metadata.len() == object.size)
        .unwrap_or(false)
}

fn sound_asset_objects(index: &AssetIndex) -> Result<Vec<AssetObject>, String> {
    let mut hashes = HashSet::new();
    let mut result = Vec::new();
    for (name, object) in &index.objects {
        if !(name.ends_with("sounds.json") || name.ends_with(".ogg")) {
            continue;
        }
        if object.hash.len() != 40 || !object.hash.chars().all(|value| value.is_ascii_hexdigit()) {
            return Err(format!("Invalid asset hash for {name}"));
        }
        if hashes.insert(object.hash.clone()) {
            result.push(object.clone());
        }
    }
    if !index
        .objects
        .keys()
        .any(|name| name.ends_with("sounds.json"))
    {
        return Err("sounds.json is missing from the asset index".to_string());
    }
    Ok(result)
}

async fn ensure_version_metadata(
    client: &reqwest::Client,
    root: &Path,
    version: &str,
) -> Result<VersionMetadata, String> {
    let path = version_json_path(root, version);
    if path.is_file() {
        return read_json(&path);
    }

    let manifest = version_manifest(client, root).await?;
    let entry = manifest
        .versions
        .into_iter()
        .find(|entry| entry.id == version)
        .ok_or_else(|| format!("Minecraft version {version} was not found"))?;
    let bytes =
        download_bytes(client, &entry.url, &format!("Minecraft {version} metadata")).await?;
    verify_download(
        &bytes,
        &entry.sha1,
        &format!("Minecraft {version} metadata"),
    )?;
    let metadata = serde_json::from_slice::<VersionMetadata>(&bytes)
        .map_err(|error| format!("Invalid Minecraft {version} metadata: {error}"))?;
    write_download(&path, &bytes)?;
    Ok(metadata)
}

async fn ensure_asset_index(
    client: &reqwest::Client,
    root: &Path,
    reference: &AssetIndexReference,
) -> Result<AssetIndex, String> {
    let path = asset_index_path(root, &reference.id);
    if path.is_file() {
        return read_json(&path);
    }

    let bytes = download_bytes(
        client,
        &reference.url,
        &format!("asset index {}", reference.id),
    )
    .await?;
    verify_download(
        &bytes,
        &reference.sha1,
        &format!("asset index {}", reference.id),
    )?;
    let index = serde_json::from_slice::<AssetIndex>(&bytes)
        .map_err(|error| format!("Invalid asset index {}: {error}", reference.id))?;
    write_download(&path, &bytes)?;
    Ok(index)
}

async fn download_sound_object(
    client: reqwest::Client,
    root: PathBuf,
    object: AssetObject,
) -> Result<bool, String> {
    let path = root
        .join("assets/objects")
        .join(&object.hash[..2])
        .join(&object.hash);
    if path
        .metadata()
        .map(|metadata| metadata.len() == object.size)
        .unwrap_or(false)
    {
        return Ok(false);
    }
    if path.exists() {
        fs::remove_file(&path).map_err(|error| format!("{}: {error}", path.display()))?;
    }
    let url = format!(
        "{ASSET_OBJECT_BASE_URL}/{}/{}",
        &object.hash[..2],
        object.hash
    );
    let bytes = download_bytes(&client, &url, &format!("asset {}", object.hash)).await?;
    if bytes.len() as u64 != object.size {
        return Err(format!(
            "Size verification failed for asset {}",
            object.hash
        ));
    }
    verify_download(&bytes, &object.hash, &format!("asset {}", object.hash))?;
    write_download(&path, &bytes)?;
    Ok(true)
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
async fn get_versions() -> Result<Vec<MinecraftVersion>, String> {
    let root = minecraft_dir()?;
    let local = local_versions(&root)?;
    let mut versions = local
        .iter()
        .map(|version| (version.clone(), is_version_downloaded(&root, version)))
        .collect::<HashMap<_, _>>();
    let client = reqwest::Client::new();
    match version_manifest(&client, &root).await {
        Ok(manifest) => {
            for entry in manifest
                .versions
                .into_iter()
                .filter(|entry| entry.kind == "release" || entry.kind == "snapshot")
            {
                versions.entry(entry.id).or_insert(false);
            }
        }
        Err(error) if versions.is_empty() => return Err(error),
        Err(_) => {}
    }
    let mut result = versions
        .into_iter()
        .map(|(id, downloaded)| MinecraftVersion { id, downloaded })
        .collect::<Vec<_>>();
    result.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(result)
}

#[tauri::command]
async fn download_version_assets(
    app: AppHandle,
    version: String,
) -> Result<AssetDownloadResult, String> {
    validate_version(&version)?;
    let root = minecraft_dir()?;
    let client = reqwest::Client::new();
    let metadata = ensure_version_metadata(&client, &root, &version).await?;
    let index = ensure_asset_index(&client, &root, &metadata.asset_index).await?;
    let objects = sound_asset_objects(&index)?;
    let total = objects.len();
    app.emit(
        "asset-download-progress",
        AssetDownloadProgress {
            version: version.clone(),
            completed_assets: 0,
            total_assets: total,
        },
    )
    .map_err(|error| error.to_string())?;

    let mut downloads = stream::iter(
        objects
            .into_iter()
            .map(|object| download_sound_object(client.clone(), root.clone(), object)),
    )
    .buffer_unordered(ASSET_DOWNLOAD_CONCURRENCY);

    let mut downloaded_assets = 0;
    let mut completed_assets = 0;
    while let Some(download) = downloads.next().await {
        if download? {
            downloaded_assets += 1;
        }
        completed_assets += 1;
        if completed_assets % 25 == 0 || completed_assets == total {
            app.emit(
                "asset-download-progress",
                AssetDownloadProgress {
                    version: version.clone(),
                    completed_assets,
                    total_assets: total,
                },
            )
            .map_err(|error| error.to_string())?;
        }
    }
    mark_version_downloaded(&root, &version)?;
    Ok(AssetDownloadResult {
        version,
        asset_index: metadata.asset_index.id,
        downloaded_assets,
        reused_assets: total - downloaded_assets,
    })
}

#[tauri::command]
fn get_mc_sounds(version: String, state: State<'_, AppState>) -> Result<Vec<Sound>, String> {
    validate_version(&version)?;
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
fn get_mc_sound_data(hash: String) -> Result<tauri::ipc::Response, String> {
    if hash.len() < 2 || !hash.chars().all(|character| character.is_ascii_hexdigit()) {
        return Err("Invalid sound hash".to_string());
    }
    let path = minecraft_dir()?
        .join("assets/objects")
        .join(&hash[..2])
        .join(hash);
    let bytes = fs::read(&path).map_err(|error| format!("{}: {error}", path.display()))?;
    Ok(tauri::ipc::Response::new(bytes))
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

fn is_knead_project_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("kp"))
}

fn validate_timeline_path(path: PathBuf) -> Result<PathBuf, String> {
    if !is_knead_project_path(&path) {
        return Err("Knead Project (.kp) を選択してください".to_string());
    }
    let path = if path.is_absolute() {
        path
    } else {
        env::current_dir()
            .map_err(|error| error.to_string())?
            .join(path)
    };
    if !path.is_file() {
        return Err(format!(
            "プロジェクトファイルが見つかりません: {}",
            path.display()
        ));
    }
    path.canonicalize().map_err(|error| error.to_string())
}

fn project_path_from_args(args: &[String], cwd: &Path) -> Option<PathBuf> {
    args.iter().skip(1).find_map(|argument| {
        let path = PathBuf::from(argument);
        let path = if path.is_absolute() {
            path
        } else {
            cwd.join(path)
        };
        validate_timeline_path(path).ok()
    })
}

fn queue_timeline_open(app: &AppHandle, path: PathBuf) -> bool {
    let Ok(path) = validate_timeline_path(path) else {
        return false;
    };
    let Some(state) = app.try_state::<AppState>() else {
        return false;
    };
    let Ok(mut pending) = state.pending_timeline_path.lock() else {
        return false;
    };
    *pending = Some(path);
    drop(pending);

    if let Some(window) = app.get_webview_window("sub") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit(TIMELINE_OPEN_REQUESTED_EVENT, ());
    }
    true
}

fn read_timeline_path(path: PathBuf) -> Value {
    let path = match validate_timeline_path(path) {
        Ok(path) => path,
        Err(error) => return json!({ "ok": false, "error": error }),
    };
    match fs::read_to_string(&path) {
        Ok(contents) => {
            json!({ "ok": true, "path": path.to_string_lossy(), "json": contents })
        }
        Err(error) => json!({ "ok": false, "error": error.to_string() }),
    }
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
        .set_file_name(default_path.as_deref().unwrap_or("untitled.kp"));
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
async fn timeline_open_dialog(app: AppHandle, window: WebviewWindow) -> Result<Value, String> {
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
    Ok(read_timeline_path(path))
}

#[tauri::command]
fn timeline_open_path(path: String) -> Value {
    read_timeline_path(PathBuf::from(path))
}

#[tauri::command]
fn timeline_set_current_path(
    window: WebviewWindow,
    path: String,
    state: State<'_, AppState>,
) -> Value {
    let path = match validate_timeline_path(PathBuf::from(path)) {
        Ok(path) => path,
        Err(error) => return json!({ "ok": false, "error": error }),
    };
    match state.timeline_paths.lock() {
        Ok(mut paths) => {
            paths.insert(window.label().to_string(), path.clone());
            ok_path(&path)
        }
        Err(error) => json!({ "ok": false, "error": error.to_string() }),
    }
}

#[tauri::command]
fn timeline_take_open_request(state: State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(state
        .pending_timeline_path
        .lock()
        .map_err(|error| error.to_string())?
        .take()
        .map(|path| path.to_string_lossy().into_owned()))
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
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            if project_path_from_args(&args, Path::new(&cwd))
                .is_some_and(|path| queue_timeline_open(app, path))
            {
                return;
            }
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
            let args: Vec<String> = env::args().collect();
            if let Ok(cwd) = env::current_dir() {
                if let Some(path) = project_path_from_args(&args, &cwd) {
                    queue_timeline_open(app.handle(), path);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_versions,
            download_version_assets,
            get_mc_sounds,
            get_mc_sound_hash,
            get_mc_sound_data,
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
            timeline_open_path,
            timeline_set_current_path,
            timeline_take_open_request,
        ])
        .build(tauri::generate_context!())
        .expect("error while running Knead");

    app.run(|app, event| {
        #[cfg(target_os = "macos")]
        {
            if let tauri::RunEvent::Opened { urls } = event {
                if let Some(path) = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .find(|path| is_knead_project_path(path))
                {
                    queue_timeline_open(app, path);
                }
            }
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (app, event);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn object(hash_character: char, size: u64) -> AssetObject {
        AssetObject {
            hash: std::iter::repeat(hash_character).take(40).collect(),
            size,
        }
    }

    #[test]
    fn sound_assets_only_include_the_sound_manifest_and_audio() {
        let shared_audio = object('a', 10);
        let index = AssetIndex {
            objects: HashMap::from([
                ("minecraft/sounds.json".to_string(), object('b', 20)),
                (
                    "minecraft/sounds/ui/click.ogg".to_string(),
                    shared_audio.clone(),
                ),
                (
                    "minecraft/sounds/ui/click-copy.ogg".to_string(),
                    shared_audio,
                ),
                ("minecraft/textures/gui.png".to_string(), object('c', 30)),
            ]),
        };

        let assets = sound_asset_objects(&index).expect("sound assets should be valid");
        assert_eq!(assets.len(), 2);
        assert!(assets.iter().any(|asset| asset.hash == "a".repeat(40)));
        assert!(assets.iter().any(|asset| asset.hash == "b".repeat(40)));
    }

    #[test]
    fn sound_assets_require_sounds_json() {
        let index = AssetIndex {
            objects: HashMap::from([(
                "minecraft/sounds/ui/click.ogg".to_string(),
                object('a', 10),
            )]),
        };
        assert!(sound_asset_objects(&index).is_err());
    }

    #[test]
    fn minecraft_version_cannot_escape_the_cache_directory() {
        assert!(validate_version("1.21.8").is_ok());
        assert!(validate_version("26.3-snapshot-4").is_ok());
        assert!(validate_version("../assets").is_err());
        assert!(validate_version("folder\\version").is_err());
    }

    #[test]
    fn knead_project_extension_is_case_insensitive() {
        assert!(is_knead_project_path(Path::new("project.kp")));
        assert!(is_knead_project_path(Path::new("PROJECT.KP")));
        assert!(!is_knead_project_path(Path::new("project.json")));
        assert!(!is_knead_project_path(Path::new("project.kp.json")));
    }

    #[test]
    fn project_path_is_found_in_file_association_arguments() {
        let root = std::env::temp_dir().join(format!(
            "knead-project-args-test-{}-{}",
            std::process::id(),
            DOWNLOAD_TEMP_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("test directory should be created");
        let project = root.join("example.kp");
        fs::write(&project, "{}").expect("test project should be written");
        let args = vec!["knead".to_string(), "example.kp".to_string()];

        assert_eq!(
            project_path_from_args(&args, &root),
            Some(project.canonicalize().expect("project should resolve"))
        );

        fs::remove_dir_all(&root).expect("test directory should be removed");
    }

    #[test]
    fn timeline_path_reader_returns_project_contents() {
        let root = std::env::temp_dir().join(format!(
            "knead-project-read-test-{}-{}",
            std::process::id(),
            DOWNLOAD_TEMP_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).expect("test directory should be created");
        let project = root.join("example.kp");
        fs::write(&project, "{\"format\":\"knead-project\"}")
            .expect("test project should be written");

        let result = read_timeline_path(project);
        assert_eq!(result.get("ok").and_then(Value::as_bool), Some(true));
        assert_eq!(
            result.get("json").and_then(Value::as_str),
            Some("{\"format\":\"knead-project\"}")
        );

        fs::remove_dir_all(&root).expect("test directory should be removed");
    }

    #[test]
    fn downloaded_version_supports_legacy_cache_and_completion_marker() {
        let root = std::env::temp_dir().join(format!(
            "knead-assets-test-{}-{}",
            std::process::id(),
            DOWNLOAD_TEMP_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let version = "test-version";
        let hash = "d".repeat(40);
        let metadata_path = version_json_path(&root, version);
        let index_path = asset_index_path(&root, "test-index");
        fs::create_dir_all(
            metadata_path
                .parent()
                .expect("metadata parent should exist"),
        )
        .expect("metadata directory should be created");
        fs::create_dir_all(index_path.parent().expect("index parent should exist"))
            .expect("index directory should be created");
        fs::write(
            &metadata_path,
            serde_json::to_vec(&json!({
                "assetIndex": {
                    "id": "test-index",
                    "url": "https://example.invalid/index.json",
                    "sha1": "0".repeat(40)
                }
            }))
            .expect("metadata should serialize"),
        )
        .expect("metadata should be written");
        fs::write(
            &index_path,
            serde_json::to_vec(&json!({
                "objects": {
                    "minecraft/sounds.json": { "hash": hash.clone(), "size": 4 }
                }
            }))
            .expect("index should serialize"),
        )
        .expect("index should be written");

        assert!(!is_version_downloaded(&root, version));
        let object_path = root.join("assets/objects").join(&hash[..2]).join(&hash);
        fs::create_dir_all(object_path.parent().expect("object parent should exist"))
            .expect("object directory should be created");
        fs::write(&object_path, [0_u8; 4]).expect("object should be written");
        assert!(is_version_downloaded(&root, version));
        fs::remove_file(&object_path).expect("legacy object should be removed");
        assert!(!is_version_downloaded(&root, version));
        mark_version_downloaded(&root, version).expect("completion marker should be written");
        assert!(is_version_downloaded(&root, version));

        fs::remove_dir_all(&root).expect("test cache should be removed");
    }
}
