// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{PathBuf};

use tauri::{Result, CustomMenuItem, Menu, MenuEntry, Manager, Window, Submenu,};
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
    window.set_title(file_path.file_name().unwrap().to_str().unwrap())?;

    Ok(())
}

fn find_menu_idx(menu: &Menu, name: &str) -> Option<usize> {
    for (idx, item) in menu.items.iter().enumerate() {
        match item {
            MenuEntry::Submenu(submenu) => {
                if submenu.title == name {
                    return Some(idx)
                }
            },
            _ => continue,
        }
    }

    None
}

fn main() {
    let mut menu = Menu::os_default("Git Diff Stepper");
    for item in menu.items.iter_mut() {
        match item {
            MenuEntry::Submenu(submenu) => {
                if submenu.title == "File" {
                    submenu.inner.items.insert(0, MenuEntry::CustomItem(CustomMenuItem::new("openFile", "Open...").accelerator("CmdOrControl+O")));
                    submenu.inner.items.insert(1, MenuEntry::NativeItem(tauri::MenuItem::Separator));
                    submenu.inner.items.insert(2, MenuEntry::CustomItem(CustomMenuItem::new("saveFile", "Save").accelerator("CmdOrControl+S")));
                    submenu.inner.items.insert(3, MenuEntry::NativeItem(tauri::MenuItem::Separator));
                }
            },
            _ => {}
        }
    }

    let transition_item_idx = find_menu_idx(&menu, "Edit")
        .or_else(|| find_menu_idx(&menu, "File"))
        .map(|x| x + 1)
        .unwrap_or(menu.items.len());
    menu.items.insert(transition_item_idx,
        MenuEntry::Submenu(Submenu::new(
            "Transition".to_string(),
             Menu::new()
                .add_item(CustomMenuItem::new("stepNext", "Next Commit").accelerator("CommandOrControl+Alt+Right"))
                .add_item(CustomMenuItem::new("stepPrev", "Previous Commit").accelerator("CommandOrControl+Alt+Left"))
        ))
    );

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
                            app.fs_scope().allow_file(&p).expect("Wanted to add the file to scope.");
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
                "saveFile" => {
                    window.emit_all("saveFile", ()).expect("Could not save file.");
                }
                "stepNext" => {
                    window.emit_all("stepNext", ()).expect("Could not transition.");
                }
                "stepPrev" => {
                    window.emit_all("stepPrev", ()).expect("Could not transition.");
                }
                _ => {}
            }
          })      
          .invoke_handler(tauri::generate_handler![git_diff, git_show])
          .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
