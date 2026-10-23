use std::path::PathBuf;

fn main() {
    let home = PathBuf::from(std::env::args().nth(1).expect("demo home path")).canonicalize().expect("demo home exists");
    let inventory = app_lib::util::inventory::build(&home);
    let files = inventory.claude_global.iter().chain(inventory.cursor_global.iter()).chain(inventory.projects.iter().flat_map(|p| p.files.iter()));
    let contents: serde_json::Map<String, serde_json::Value> = files
        .filter_map(|f| app_lib::util::config_paths::resolve(&home, std::path::Path::new(&f.path)).map(|t| (f.path.clone(), t)))
        .filter_map(|(path, target)| std::fs::read_to_string(target).ok().map(|c| (path, serde_json::Value::String(c))))
        .collect();
    let alerts = app_lib::util::alerts::current_alerts(&inventory);
    let snapshot = serde_json::json!({ "inventory": inventory, "contents": contents, "alerts": alerts });
    println!("{}", serde_json::to_string(&snapshot).expect("json"));
}
