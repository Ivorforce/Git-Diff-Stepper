// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{PathBuf};

use tauri::{Result, CustomMenuItem, Menu, MenuEntry, Manager, Window,};
use tauri::api::dialog;
use serde::Serialize;

pub mod commands;

#[tauri::command(rename_all = "snake_case")]
fn git_diff(file_path: String, before_version: String, after_version: String) -> String {
    commands::get_diff(&PathBuf::from(file_path), &before_version, &after_version)
}

#[tauri::command(rename_all = "snake_case")]
fn git_show(file_path: String, version: String) -> String {
    commands::get_file_at_version(&PathBuf::from(file_path), &version)
}

#[derive(Clone, Serialize)]
pub struct FileInfo {
    pub file_path: PathBuf,
    pub commit_list: Vec<String>,
}

fn open_file(file_path: &PathBuf, window: &Window) -> Result<()> {
    let commit_list = commands::get_commit_list(file_path);

    window.emit_all("openFile", FileInfo { file_path: file_path.clone(), commit_list })?;

    Ok(())
}

fn main() {
    let mut menu = Menu::os_default("Git Diff Stepper");
    for item in menu.items.iter_mut() {
        match item {
            MenuEntry::Submenu(submenu) => {
                if submenu.title == "File" {
                    submenu.inner.items.push(MenuEntry::CustomItem(CustomMenuItem::new("openFile", "Open File")));
                }
            },
            _ => {}
        }
    }

    tauri::Builder::default()
        .menu(menu)
        .setup(|app| {
            // // listen to the `event-name` (emitted on any window)
            // let id = app.listen_global("event-name", |event| {
            //   println!("got event-name with payload {:?}", event.payload());
            // });
            // // unlisten to the event using the `id` returned on the `listen_global` function
            // // a `once_global` API is also exposed on the `App` struct
            // app.unlisten(id);
      
            // // emit the `event-name` event to all webview windows on the frontend
            // app.emit_all("event-name", Payload { message: "Tauri is awesome!".into() }).unwrap();
            Ok(())
          })
        .on_menu_event(|event| {
            let window = event.window();
            let window_name = window.label().to_string();
            let app = window.app_handle();
            
            match event.menu_item_id() {
              "openFile" => {
                dialog::FileDialogBuilder::default()
                    .pick_file(move |path_buf| match path_buf {
                        Some(p) => {
                            open_file(&p, &app.windows()[window_name.as_str()]).expect("Could not open the file.");
                        }
                        _ => {}
                    });
                
                // let docs_window = tauri::WindowBuilder::new(
                //     event.window.app_handle,
                //     "external", /* the unique window label */
                //     tauri::WindowUrl::External("https://tauri.app/".parse().unwrap())
                //   ).build().unwrap(); 
              }
              _ => {}
            }
          })      
          .invoke_handler(tauri::generate_handler![git_diff, git_show])
          .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
