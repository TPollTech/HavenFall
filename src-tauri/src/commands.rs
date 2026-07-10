use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FileSystemExt;
use tauri_plugin_store::StoreExt;
use serde::{Deserialize, Serialize};
use crate::paths::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPaths {
    pub user_data: String,
    pub saves: String,
    pub backups: String,
    pub logs: String,
    pub config: String,
    pub window_state: String,
    pub default_saves: String,
    pub custom_saves: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DesktopConfig {
    pub save_root: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[tauri::command]
pub async fn get_desktop_paths<R: Runtime>(app: tauri::AppHandle<R>) -> Result<DesktopPaths, String> {
    let paths = get_paths(&app).await?;
    Ok(paths)
}

#[tauri::command]
pub async fn choose_save_root<R: Runtime>(
    app: tauri::AppHandle<R>,
    migrate: Option<bool>,
) -> Result<DesktopPaths, String> {
    let migrate = migrate.unwrap_or(true);
    let before = get_paths(&app).await?;
    let before_saves = PathBuf::from(&before.saves);

    let folder = app.dialog()
        .file()
        .set_title("Escolher pasta dos saves do HavenFall")
        .pick_folder()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("cancelado")?;

    let new_root = folder.to_string_lossy().to_string();
    let new_root_path = PathBuf::from(&new_root);

    if migrate {
        copy_saves(&before_saves, &new_root_path).await?;
    }

    let mut config = read_config(&app).await?;
    config.save_root = Some(new_root);
    config.updated_at = Some(chrono::Utc::now().to_rfc3339());
    write_config(&app, &config).await?;

    get_paths(&app).await
}

#[tauri::command]
pub async fn reset_save_root<R: Runtime>(
    app: tauri::AppHandle<R>,
    migrate: Option<bool>,
) -> Result<DesktopPaths, String> {
    let migrate = migrate.unwrap_or(true);
    let before = get_paths(&app).await?;
    let before_saves = PathBuf::from(&before.saves);
    let default_root = get_default_saves_dir(&app)?;

    if migrate {
        copy_saves(&before_saves, &default_root).await?;
    }

    let mut config = read_config(&app).await?;
    config.save_root = None;
    config.updated_at = Some(chrono::Utc::now().to_rfc3339());
    write_config(&app, &config).await?;

    get_paths(&app).await
}

#[tauri::command]
pub async fn open_path<R: Runtime>(
    app: tauri::AppHandle<R>,
    target: String,
) -> Result<(), String> {
    let paths = get_paths(&app).await?;
    let path = match target.as_str() {
        "logs" => paths.logs,
        "backups" => paths.backups,
        "userData" => paths.user_data,
        _ => paths.saves,
    };
    app.shell().open(path, None).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_desktop_config<R: Runtime>(app: tauri::AppHandle<R>) -> Result<DesktopConfig, String> {
    read_config(&app).await
}

#[tauri::command]
pub async fn set_desktop_config<R: Runtime>(
    app: tauri::AppHandle<R>,
    config: DesktopConfig,
) -> Result<DesktopConfig, String> {
    let mut cfg = config;
    cfg.updated_at = Some(chrono::Utc::now().to_rfc3339());
    write_config(&app, &cfg).await?;
    Ok(cfg)
}

#[tauri::command]
pub fn quit_app<R: Runtime>(app: tauri::AppHandle<R>) {
    app.exit(0);
}

async fn get_paths<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<DesktopPaths, String> {
    let user_data = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("HavenFall");
    std::fs::create_dir_all(&user_data).map_err(|e| e.to_string())?;

    let config = read_config(app).await?;
    let default_saves = user_data.join("saves");
    std::fs::create_dir_all(&default_saves).map_err(|e| e.to_string())?;

    let saves = config.save_root
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or(default_saves.clone());
    std::fs::create_dir_all(&saves).map_err(|e| e.to_string())?;

    let backups = saves.join("backups");
    std::fs::create_dir_all(&backups).map_err(|e| e.to_string())?;

    let logs = user_data.join("logs");
    std::fs::create_dir_all(&logs).map_err(|e| e.to_string())?;

    Ok(DesktopPaths {
        user_data: user_data.to_string_lossy().to_string(),
        saves: saves.to_string_lossy().to_string(),
        backups: backups.to_string_lossy().to_string(),
        logs: logs.to_string_lossy().to_string(),
        config: user_data.join("desktop-config.json").to_string_lossy().to_string(),
        window_state: user_data.join("window-state.json").to_string_lossy().to_string(),
        default_saves: default_saves.to_string_lossy().to_string(),
        custom_saves: config.save_root.is_some(),
    })
}

fn get_default_saves_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let user_data = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("HavenFall")
        .join("saves");
    Ok(user_data)
}

async fn copy_saves(from: &Path, to: &Path) -> Result<(), String> {
    if !from.exists() { return Ok(()); }
    std::fs::create_dir_all(to).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(from).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().extension().and_then(|s| s.to_str()) == Some("json") {
            let dest = to.join(entry.file_name());
            if !dest.exists() {
                std::fs::copy(entry.path(), dest).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

async fn read_config<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<DesktopConfig, String> {
    let store = app.store("desktop-config.json").map_err(|e| e.to_string())?;
    let config = store.get("config")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or(DesktopConfig {
            save_root: None,
            created_at: Some(chrono::Utc::now().to_rfc3339()),
            updated_at: Some(chrono::Utc::now().to_rfc3339()),
        });
    Ok(config)
}

async fn write_config<R: Runtime>(app: &tauri::AppHandle<R>, config: &DesktopConfig) -> Result<(), String> {
    let store = app.store("desktop-config.json").map_err(|e| e.to_string())?;
    store.set("config", serde_json::to_value(config).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}