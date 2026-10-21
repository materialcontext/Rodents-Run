//! Build tasks, run with `cargo xtask <task>`:
//!
//! * `dist`: builds the WebAssembly core and writes
//!   - `web/rodent.wasm` (so `web/` can be served as-is while developing),
//!   - `dist/site/` (the static site, as deployed to GitHub Pages),
//!   - `dist/rodents-revenge.html` (one self-contained file: styles, scripts
//!     and the wasm inlined; opens from disk or any host).

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{exit, Command};

/// Script modules in dependency order (each only imports earlier ones).
const MODULES: [&str; 7] = ["sprites", "core", "store", "input", "render", "ui", "main"];
const WASM_TARGET: &str = "wasm32-unknown-unknown";

type Result<T> = std::result::Result<T, String>;

fn main() {
    let task = std::env::args().nth(1).unwrap_or_default();
    let result = match task.as_str() {
        "dist" => dist(),
        _ => Err("usage: cargo xtask dist".into()),
    };
    if let Err(e) = result {
        eprintln!("xtask: {e}");
        exit(1);
    }
}

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).parent().expect("workspace root").to_path_buf()
}

fn read(path: &Path) -> Result<String> {
    fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))
}

fn write(path: &Path, data: impl AsRef<[u8]>) -> Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    }
    fs::write(path, data).map_err(|e| format!("{}: {e}", path.display()))
}

fn dist() -> Result<()> {
    let root = root();
    let web = root.join("web");
    let out = root.join("dist");

    let status = Command::new(std::env::var("CARGO").unwrap_or_else(|_| "cargo".into()))
        .args(["build", "--release", "-p", "rodent-wasm", "--target", WASM_TARGET])
        .current_dir(&root)
        .status()
        .map_err(|e| format!("cargo: {e}"))?;
    if !status.success() {
        return Err(format!("wasm build failed (is the target installed? `rustup target add {WASM_TARGET}`)"));
    }
    let wasm_path = root.join("target").join(WASM_TARGET).join("release/rodent_wasm.wasm");
    let wasm = fs::read(&wasm_path).map_err(|e| format!("{}: {e}", wasm_path.display()))?;
    write(&web.join("rodent.wasm"), &wasm)?;

    let site = out.join("site");
    if site.exists() {
        fs::remove_dir_all(&site).map_err(|e| format!("{}: {e}", site.display()))?;
    }
    copy_dir(&web, &site)?;

    let single = single_file(&web, &wasm)?;
    write(&site.join("rodents-revenge.html"), &single)?;
    write(&out.join("rodents-revenge.html"), &single)?;

    println!("wasm      {:>7} bytes", wasm.len());
    println!("site      {}", site.display());
    println!("one file  {} ({} bytes)", out.join("rodents-revenge.html").display(), single.len());
    Ok(())
}

fn copy_dir(from: &Path, to: &Path) -> Result<()> {
    fs::create_dir_all(to).map_err(|e| format!("{}: {e}", to.display()))?;
    for entry in fs::read_dir(from).map_err(|e| format!("{}: {e}", from.display()))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let (src, dst) = (entry.path(), to.join(entry.file_name()));
        if src.is_dir() {
            copy_dir(&src, &dst)?;
        } else {
            fs::copy(&src, &dst).map_err(|e| format!("{}: {e}", src.display()))?;
        }
    }
    Ok(())
}

/// Inlines the stylesheet, the icon, the wasm and every script module into
/// `index.html`. Each module becomes an async function returning its
/// exports; `import { a, b } from "./x.js"` becomes a destructuring of
/// module `x`'s exports, so modules keep their own scopes.
fn single_file(web: &Path, wasm: &[u8]) -> Result<String> {
    let mut html = read(&web.join("index.html"))?;
    let css = read(&web.join("style.css"))?;
    let icon = read(&web.join("icon.svg"))?;

    let mut bundle = String::from("const __modules = {};\n");
    for name in MODULES {
        let source = read(&web.join("js").join(format!("{name}.js")))?;
        bundle.push_str(&wrap_module(name, &source)?);
    }

    let icon_uri = format!("data:image/svg+xml;base64,{}", base64(icon.as_bytes()));
    let replacements: BTreeMap<&str, String> = BTreeMap::from([
        ("<link rel=\"manifest\" href=\"manifest.webmanifest\">\n", String::new()),
        ("<link rel=\"stylesheet\" href=\"style.css\">", format!("<style>\n{css}</style>")),
        (
            "<link rel=\"icon\" href=\"icon.svg\" type=\"image/svg+xml\">",
            format!("<link rel=\"icon\" href=\"{icon_uri}\" type=\"image/svg+xml\">"),
        ),
        ("<link rel=\"apple-touch-icon\" href=\"icon.svg\">\n", String::new()),
        (
            "<script type=\"module\" src=\"js/main.js\"></script>",
            format!(
                "<script>globalThis.RODENT_WASM = \"{}\";</script>\n<script type=\"module\">\n{bundle}</script>",
                base64(wasm)
            ),
        ),
    ]);
    for (from, to) in &replacements {
        if !html.contains(from) {
            return Err(format!("index.html no longer contains {from:?}"));
        }
        html = html.replacen(from, to, 1);
    }
    Ok(html)
}

fn wrap_module(name: &str, source: &str) -> Result<String> {
    let mut body = String::new();
    let mut exports = Vec::new();
    for line in source.lines() {
        if let Some(rest) = line.strip_prefix("import ") {
            // import { a, b } from "./x.js";
            let (names, from) = rest.split_once(" from ").ok_or(format!("{name}.js: unsupported import: {line}"))?;
            let module =
                from.trim().trim_end_matches(';').trim_matches('"').trim_start_matches("./").trim_end_matches(".js");
            body.push_str(&format!("const {names} = __modules[\"{module}\"];\n"));
        } else if let Some(rest) = line.strip_prefix("export ") {
            let decl = rest.trim_start_matches("async ");
            let ident = decl
                .split_whitespace()
                .nth(1)
                .map(|w| w.trim_end_matches(|c: char| !(c.is_alphanumeric() || c == '_' || c == '$')))
                .ok_or(format!("{name}.js: unsupported export: {line}"))?;
            let ident = ident.split('(').next().unwrap_or(ident);
            exports.push(ident.to_string());
            body.push_str(rest);
            body.push('\n');
        } else {
            body.push_str(line);
            body.push('\n');
        }
    }
    Ok(format!("__modules[\"{name}\"] = await (async () => {{\n{body}return {{ {} }};\n}})();\n", exports.join(", ")))
}

fn base64(data: &[u8]) -> String {
    const ABC: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        let n = (b[0] as u32) << 16 | (b[1] as u32) << 8 | b[2] as u32;
        for i in 0..4 {
            if i <= chunk.len() {
                out.push(ABC[(n >> (18 - 6 * i) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}
