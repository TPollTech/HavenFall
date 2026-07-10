#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod paths;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_os_info::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("HavenFall").ok();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::save_game,
            commands::load_game,
            commands::list_saves,
            commands::delete_save,
            commands::choose_save_root,
            commands::reset_save_root,
            commands::open_path,
            commands::quit_app,
            commands::get_desktop_config,
            commands::set_desktop_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}