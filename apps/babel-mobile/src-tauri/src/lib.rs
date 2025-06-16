// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
// Add this line at the top
mod translation_bridge;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// --- New Commands ---
#[tauri::command]
async fn extract_content_command(window: tauri::Window) -> Result<String, String> {
    // For simplicity in this mock, we're passing the main window.
    // In a multi-webview setup, you might need to get a handle to a specific webview.
    translation_bridge::extract_text_from_webview(&window)
}

#[tauri::command]
async fn translate_content_command(text: String) -> Result<String, String> {
    Ok(translation_bridge::mock_translate(text))
}

#[tauri::command]
async fn inject_content_command(window: tauri::Window, text_content: String) -> Result<(), String> {
    // text_content here is expected to be an HTML string from the (mock) translation service
    translation_bridge::inject_html_content_into_webview(&window, text_content)
}
// --- End New Commands ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            extract_content_command,
            translate_content_command,
            inject_content_command // Add new commands here
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
