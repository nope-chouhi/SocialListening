#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Project Scanner for Social Listening App
Creates a compact project snapshot for debugging with ChatGPT.

Usage:
  python project_scanner.py
  python project_scanner.py --root "C:\\path\\to\\SocialListening"
  python project_scanner.py --max-file-kb 220
"""

import argparse
import json
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

SKIP_DIRS = {
    ".git", ".venv", "venv", "env", "__pycache__", ".next", "node_modules",
    "dist", "build", ".turbo", ".cache", ".pytest_cache", ".mypy_cache",
    "coverage", ".idea", ".vscode", "logs", "uploads", "media", "tmp", "temp",
    "pgsql", "data"
}

SKIP_FILES = {
    ".env", ".env.local", ".env.production", ".env.development",
    "social_listening.db", "database.db", "db.sqlite", "db.sqlite3",
    "logfile"
}

CODE_EXTS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".yml", ".yaml",
    ".toml", ".ini", ".cfg", ".txt", ".sql", ".mako",
    ".css", ".scss", ".html"
}

IMPORTANT_PATTERNS = [
    "main.py", "worker.py", "api.ts", "package.json", "requirements.txt",
    "alembic.ini", "render.yaml", "runtime.txt", "Dockerfile",
]

SECRET_PATTERNS = [
    (re.compile(r'(?i)(api[_-]?key|secret|token|password|database_url|private[_-]?key)\s*[:=]\s*["\']?[^"\'\s,]+'), r'\1=***REDACTED***'),
    (re.compile(r'postgres(ql)?://[^"\'>\s]+', re.I), 'postgresql://***REDACTED***'),
    (re.compile(r'sk-[A-Za-z0-9_\-]{20,}'), 'sk-***REDACTED***'),
    (re.compile(r'AIza[0-9A-Za-z_\-]{20,}'), 'AIza***REDACTED***'),
    (re.compile(r'eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+'), 'JWT_***REDACTED***'),
]

FOCUS_KEYWORDS = [
    "dashboard", "worker", "scheduler", "crawl", "rss", "mention", "mentions",
    "alert", "incident", "source", "keyword", "system", "worker-status",
    "auth", "settings", "ai", "openai", "gemini", "dummy", "sentiment"
]

def redact(text: str) -> str:
    for pattern, repl in SECRET_PATTERNS:
        text = pattern.sub(repl, text)
    return text

def should_skip(path: Path, root: Path) -> bool:
    try:
        parts = set(path.relative_to(root).parts)
    except ValueError:
        return True
    if parts & SKIP_DIRS:
        return True
    if path.name in SKIP_FILES:
        return True
    return False

def is_probably_important(path: Path) -> bool:
    name = path.name.lower()
    s = str(path).lower().replace("\\", "/")
    if name in [p.lower() for p in IMPORTANT_PATTERNS]:
        return True
    if path.suffix.lower() not in CODE_EXTS:
        return False
    return any(k in s for k in FOCUS_KEYWORDS)

def safe_read(path: Path, max_bytes: int):
    try:
        data = path.read_bytes()
    except Exception as e:
        return None, f"READ_ERROR: {e}"
    truncated = len(data) > max_bytes
    if truncated:
        data = data[:max_bytes]
    text = data.decode("utf-8", errors="replace")
    text = redact(text)
    return text, ("TRUNCATED" if truncated else None)

def collect_tree(root: Path, max_items=3000):
    lines = []
    count = 0
    for path in sorted(root.rglob("*")):
        if should_skip(path, root):
            continue
        rel = path.relative_to(root)
        depth = len(rel.parts) - 1
        if depth > 5:
            continue
        prefix = "  " * depth + ("- " if path.is_file() else "+ ")
        if path.is_dir():
            lines.append(prefix + path.name + "/")
        else:
            size = path.stat().st_size if path.exists() else 0
            lines.append(prefix + f"{path.name} ({size} bytes)")
        count += 1
        if count >= max_items:
            lines.append("... tree truncated ...")
            break
    return "\n".join(lines)

def extract_routes_from_text(text: str):
    routes = []
    patterns = [
        r'@router\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']',
        r'@app\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']',
        r'(GET|POST|PUT|DELETE|PATCH)\s+(/api/[A-Za-z0-9_\-/{}?=&.]+)',
    ]
    for pat in patterns:
        for m in re.finditer(pat, text, flags=re.I):
            routes.append({"method": m.group(1).upper(), "path": m.group(2)})
    return routes

def extract_frontend_api_calls(text: str):
    calls = set()
    for m in re.finditer(r'["\'`](/api/[A-Za-z0-9_\-/{}/?=&.:]+)["\'`]', text):
        calls.add(m.group(1))
    for m in re.finditer(r'(?:get|post|put|delete|patch)\s*\(\s*["\'`]([^"\'`]+)["\'`]', text, flags=re.I):
        val = m.group(1)
        if "/api/" in val or val.startswith("/"):
            calls.add(val)
    return sorted(calls)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="Project root path")
    parser.add_argument("--max-file-kb", type=int, default=220, help="Max KB per collected file")
    parser.add_argument("--output", default=None, help="Output zip path")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.exists():
        print(f"ERROR: root not found: {root}")
        sys.exit(1)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_zip = Path(args.output).resolve() if args.output else root / f"project_scan_{timestamp}.zip"
    max_bytes = args.max_file_kb * 1024

    files_info = []
    routes = []
    api_calls = []
    collected_files = []

    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if should_skip(path, root):
            continue
        rel = path.relative_to(root)
        size = path.stat().st_size
        ext = path.suffix.lower()
        important = is_probably_important(path)

        if ext in CODE_EXTS:
            files_info.append({
                "path": str(rel).replace("\\", "/"),
                "size": size,
                "important": important
            })

        if important or (ext in CODE_EXTS and size <= 60 * 1024 and any(k in str(rel).lower() for k in FOCUS_KEYWORDS)):
            text, status = safe_read(path, max_bytes)
            if text is not None:
                rel_str = str(rel).replace("\\", "/")
                collected_files.append((rel_str, text, status))
                routes.extend([dict(r, file=rel_str) for r in extract_routes_from_text(text)])
                for c in extract_frontend_api_calls(text):
                    api_calls.append({"file": rel_str, "call": c})

    summary = {
        "scanned_at_utc": datetime.now(timezone.utc).isoformat(),
        "root": str(root),
        "total_code_files_indexed": len(files_info),
        "collected_files_count": len(collected_files),
        "routes_found_count": len(routes),
        "frontend_api_calls_count": len(api_calls),
        "note": "Secrets are redacted. node_modules, venv, .git, .env, database files are skipped."
    }

    overview = []
    overview.append("PROJECT SCAN OVERVIEW")
    overview.append("=" * 80)
    overview.append(json.dumps(summary, ensure_ascii=False, indent=2))
    overview.append("\n\nPROJECT TREE")
    overview.append("=" * 80)
    overview.append(collect_tree(root))
    overview.append("\n\nBACKEND ROUTES FOUND")
    overview.append("=" * 80)
    overview.append(json.dumps(routes, ensure_ascii=False, indent=2))
    overview.append("\n\nFRONTEND API CALLS FOUND")
    overview.append("=" * 80)
    overview.append(json.dumps(api_calls, ensure_ascii=False, indent=2))

    with zipfile.ZipFile(out_zip, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("scan_overview.txt", "\n".join(overview))
        z.writestr("files_index.json", json.dumps(files_info, ensure_ascii=False, indent=2))
        z.writestr("backend_routes.json", json.dumps(routes, ensure_ascii=False, indent=2))
        z.writestr("frontend_api_calls.json", json.dumps(api_calls, ensure_ascii=False, indent=2))
        for rel, text, status in collected_files:
            header = f"FILE: {rel}\nSTATUS: {status or 'OK'}\n" + "=" * 80 + "\n"
            z.writestr("collected_code/" + rel.replace(":", "_"), header + text)

    print(f"OK: created {out_zip}")
    print(f"Files collected: {len(collected_files)}")
    print(f"Routes found: {len(routes)}")
    print(f"Frontend API calls found: {len(api_calls)}")
    print("\nSend this zip file to ChatGPT:")
    print(out_zip)

if __name__ == "__main__":
    main()
