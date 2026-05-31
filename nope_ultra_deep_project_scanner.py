#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NOPE ULTRA DEEP PROJECT SCANNER
Quét cực sâu toàn bộ web/app dự án Nope:
- cây thư mục, file index, package/dependency
- frontend routes/pages/layout/components/hooks/stores/services
- backend routers/endpoints/schemas/models/migrations/services
- API calls từ frontend -> backend
- route matrix đối chiếu frontend calls vs backend endpoints
- chức năng/màn hình/buttons/forms/tables/cards/charts/modals
- scan keyword/source/mentions/dashboard/alerts/incidents/settings/auth/AI/worker
- fake/mock/dummy/demo hardcoded risk
- security risk/secrets/env redacted
- build/test config
- optional live probe deployed frontend/backend
Không sửa code, chỉ đọc và tạo báo cáo zip.
"""

from __future__ import annotations

import argparse
import ast
import csv
import datetime as dt
import hashlib
import json
import os
import platform
import re
import sys
import time
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin

try:
    import urllib.request
    import urllib.error
except Exception:
    urllib = None

IGNORE_DIRS = {
    ".git", ".next", "node_modules", ".venv", "venv", "__pycache__", ".pytest_cache",
    "dist", "build", ".turbo", ".vercel", ".idea", ".vscode", "coverage", ".cache",
    "logs", "tmp", "temp", "uploads", "media", "storage", ".mypy_cache", ".ruff_cache",
    "playwright-report", "test-results", "htmlcov"
}

IGNORE_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".mp4", ".mov", ".avi",
    ".zip", ".rar", ".7z", ".gz", ".tar", ".exe", ".dll", ".so", ".dylib", ".db", ".sqlite",
    ".sqlite3", ".lock", ".woff", ".woff2", ".ttf", ".eot", ".pyc", ".pyd", ".class"
}

TEXT_EXTS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".yml", ".yaml", ".toml", ".ini", ".cfg",
    ".env", ".example", ".css", ".scss", ".html", ".md", ".txt", ".sql", ".sh", ".bat", ".ps1",
    ".prisma", ".xml", ".svg", ".mjs", ".cjs"
}

SECRET_PATTERNS = [
    (re.compile(r'(?i)(api[_-]?key|secret|token|password|passwd|pwd|client_secret|private_key|jwt_secret|database_url|db_url|postgres_url)\s*[:=]\s*["\']?([^"\'\s,}]+)'), r'\1=***REDACTED***'),
    (re.compile(r'postgres(?:ql)?://[^\s"\']+'), 'postgresql://***REDACTED***'),
    (re.compile(r'sk-[A-Za-z0-9_\-]{20,}'), 'sk-***REDACTED***'),
    (re.compile(r'AIza[0-9A-Za-z_\-]{20,}'), 'AIza***REDACTED***'),
    (re.compile(r'ghp_[A-Za-z0-9]{20,}'), 'ghp_***REDACTED***'),
    (re.compile(r'xox[baprs]-[A-Za-z0-9\-]{20,}'), 'xox***REDACTED***'),
]

RISK_PATTERNS = {
    "fake_mock_demo": [
        r"\bmock\b", r"\bfake\b", r"\bdummy\b", r"\bdemo\b", r"sampleData", r"sample_data",
        r"generateMock", r"mockData", r"setTimeout\s*\(", r"Math\.random\s*\("
    ],
    "todo_placeholder": [
        r"TODO", r"FIXME", r"placeholder", r"not implemented", r"coming soon",
        r"Chưa tích hợp", r"Chưa cấu hình", r"tạm thời", r"hardcoded"
    ],
    "unsafe_frontend": [
        r"dangerouslySetInnerHTML", r"innerHTML\s*=", r"eval\s*\(", r"new Function\s*\(",
        r"localStorage\.setItem\([^)]*token", r"console\.log\([^)]*(token|secret|password|env)"
    ],
    "security_backend": [
        r"allow_origins=\[\"?\*\"?\]", r"CORSMiddleware", r"debug=True", r"print\([^)]*(token|secret|password|env)",
        r"execute\(\s*f[\"']", r"raw\s*\(", r"literal_column", r"text\(\s*f[\"']"
    ],
    "silent_errors": [
        r"except\s+Exception\s*:\s*pass", r"catch\s*\([^)]*\)\s*{\s*}", r"return\s+\[\]",
        r"return\s+{[^}]*items[^}]*:\s*\[\]"
    ],
    "destructive": [
        r"drop_all", r"DROP TABLE", r"TRUNCATE", r"deleteMany\(\s*{}\s*\)", r"rm\s+-rf",
        r"Base\.metadata\.drop_all"
    ],
}

FEATURE_KEYWORDS = {
    "auth": ["login", "register", "logout", "jwt", "refresh", "current_user", "auth"],
    "dashboard": ["dashboard", "summary", "trend", "sentiment-summary", "hot-keywords", "latest-mentions"],
    "scan_center": ["scan", "crawl", "manual-scan", "worker-status", "scheduler", "crawl_jobs"],
    "keywords": ["keywords", "keyword_groups", "bulk", "matched_keywords"],
    "sources": ["sources", "rss", "website", "source_type", "last_error", "next_crawl"],
    "mentions": ["mentions", "sentiment", "emotion", "influence", "reach", "engagement"],
    "alerts": ["alerts", "acknowledge", "resolve", "severity", "storm"],
    "incidents": ["incidents", "war room", "crisis", "risk"],
    "reports": ["reports", "export", "pdf", "xlsx", "csv", "pptx", "quickshare"],
    "ai": ["AI_PROVIDER", "openai", "gemini", "dummy", "sentiment", "emotion", "intent", "rag"],
    "rbac": ["role", "permission", "403", "admin", "super_admin", "viewer"],
    "settings": ["settings", "profile", "password", "notification", "appearance"],
    "realtime": ["websocket", "socket.io", "sse", "EventSource", "Socket"],
}

def nowstamp() -> str:
    return dt.datetime.now().strftime("%Y%m%d_%H%M%S")

def sha1_text(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()

def rel(path: Path, root: Path) -> str:
    return str(path.relative_to(root)).replace("\\", "/")

def is_ignored(path: Path, root: Path) -> bool:
    parts = set(path.relative_to(root).parts) if path != root else set()
    return any(p in IGNORE_DIRS for p in parts)

def is_text_file(path: Path) -> bool:
    if path.suffix.lower() in IGNORE_EXTS:
        return False
    if path.suffix.lower() in TEXT_EXTS:
        return True
    # allow extensionless common files
    if path.name.lower() in {"dockerfile", "makefile", "procfile", ".env", ".env.example"}:
        return True
    return False

def read_text(path: Path, max_kb: int = 600) -> Optional[str]:
    try:
        if path.stat().st_size > max_kb * 1024:
            return None
        data = path.read_bytes()
        if b"\x00" in data[:4096]:
            return None
        return data.decode("utf-8", errors="replace")
    except Exception:
        return None

def redact(text: str) -> str:
    out = text
    for pat, repl in SECRET_PATTERNS:
        out = pat.sub(repl, out)
    return out

def write_json(outdir: Path, name: str, data: Any) -> None:
    (outdir / name).write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

def write_text(outdir: Path, name: str, data: str) -> None:
    (outdir / name).write_text(data, encoding="utf-8")

def scan_files(root: Path, max_file_kb: int, max_files: int) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    files = []
    collected = {}
    count = 0
    for p in root.rglob("*"):
        if p.is_dir():
            continue
        if is_ignored(p, root):
            continue
        try:
            st = p.stat()
        except Exception:
            continue
        r = rel(p, root)
        item = {
            "path": r,
            "name": p.name,
            "suffix": p.suffix.lower(),
            "size": st.st_size,
            "modified": dt.datetime.fromtimestamp(st.st_mtime).isoformat(),
            "is_text": is_text_file(p),
        }
        files.append(item)
        if item["is_text"] and count < max_files:
            txt = read_text(p, max_file_kb)
            if txt is not None:
                collected[r] = redact(txt)
                count += 1
    files.sort(key=lambda x: x["path"])
    return files, collected

def build_tree(root: Path, max_depth: int = 6, max_items: int = 6000) -> str:
    lines = []
    n = 0
    def walk(d: Path, depth: int):
        nonlocal n
        if n > max_items or depth > max_depth:
            return
        try:
            children = sorted([c for c in d.iterdir() if not is_ignored(c, root)], key=lambda x: (not x.is_dir(), x.name.lower()))
        except Exception:
            return
        for c in children:
            if n > max_items: break
            indent = "  " * depth
            suffix = "/" if c.is_dir() else ""
            lines.append(f"{indent}{c.name}{suffix}")
            n += 1
            if c.is_dir():
                walk(c, depth + 1)
    lines.append(root.name + "/")
    walk(root, 1)
    return "\n".join(lines)

def package_inventory(collected: Dict[str, str]) -> Dict[str, Any]:
    inv = {"package_json": [], "python": [], "docker": [], "ci": [], "env_examples": []}
    for path, txt in collected.items():
        low = path.lower()
        if path.endswith("package.json"):
            try:
                obj = json.loads(txt)
                inv["package_json"].append({
                    "path": path,
                    "scripts": obj.get("scripts", {}),
                    "dependencies": obj.get("dependencies", {}),
                    "devDependencies": obj.get("devDependencies", {}),
                    "name": obj.get("name"),
                    "version": obj.get("version"),
                })
            except Exception as e:
                inv["package_json"].append({"path": path, "error": str(e)})
        if low.endswith(("requirements.txt", "pyproject.toml", "poetry.lock", "pipfile")):
            inv["python"].append({"path": path, "preview": txt[:5000]})
        if "dockerfile" in low or "docker-compose" in low:
            inv["docker"].append({"path": path, "preview": txt[:5000]})
        if ".github/workflows" in low or low.endswith((".yml", ".yaml")) and ("workflow" in low or "ci" in low):
            inv["ci"].append({"path": path, "preview": txt[:4000]})
        if ".env" in low:
            keys = []
            for line in txt.splitlines():
                m = re.match(r"\s*([A-Za-z_][A-Za-z0-9_]*)\s*=", line)
                if m: keys.append(m.group(1))
            inv["env_examples"].append({"path": path, "keys": sorted(set(keys))})
    return inv

def extract_frontend_routes(collected: Dict[str, str]) -> List[Dict[str, Any]]:
    routes = []
    for path, txt in collected.items():
        p = path.replace("\\", "/")
        if not (p.endswith((".tsx", ".ts", ".jsx", ".js"))):
            continue
        if "/app/" in p or p.startswith("app/") or "/pages/" in p or p.startswith("pages/") or "/src/app/" in p:
            if re.search(r"(page|layout|route)\.(tsx|ts|jsx|js)$", p) or "/pages/" in p:
                route = p
                # Next app route inference
                route = re.sub(r"^(frontend/)?(src/)?app/", "/", route)
                route = re.sub(r"^(frontend/)?(src/)?pages/", "/", route)
                route = re.sub(r"/page\.(tsx|ts|jsx|js)$", "", route)
                route = re.sub(r"/layout\.(tsx|ts|jsx|js)$", "", route)
                route = re.sub(r"\.(tsx|ts|jsx|js)$", "", route)
                route = route.replace("/index", "")
                route = re.sub(r"\([^)]*\)/", "", route)  # route groups
                if not route.startswith("/"): route = "/" + route
                routes.append({
                    "path": p,
                    "inferred_route": route or "/",
                    "has_client": '"use client"' in txt or "'use client'" in txt,
                    "exports_metadata": "metadata" in txt,
                    "components_used": sorted(set(re.findall(r"<([A-Z][A-Za-z0-9_]*)", txt)))[:80],
                })
    return sorted(routes, key=lambda x: x["inferred_route"])

HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"]

def extract_backend_routes(collected: Dict[str, str]) -> List[Dict[str, Any]]:
    routes = []
    for path, txt in collected.items():
        if not path.endswith(".py"):
            continue
        # FastAPI decorators
        for m in re.finditer(r"@(?:[A-Za-z0-9_]+\.)?(get|post|put|patch|delete|api_route)\(\s*[\"']([^\"']+)[\"']", txt, flags=re.I):
            method = m.group(1).upper()
            route = m.group(2)
            fn = None
            after = txt[m.end():m.end()+500]
            fm = re.search(r"def\s+([A-Za-z_][A-Za-z0-9_]*)|async\s+def\s+([A-Za-z_][A-Za-z0-9_]*)", after)
            if fm: fn = fm.group(1) or fm.group(2)
            routes.append({"path": path, "method": method, "route": route, "function": fn, "framework": "fastapi"})
        # Express
        for m in re.finditer(r"\b(?:app|router)\.(get|post|put|patch|delete)\(\s*[\"'`]([^\"'`]+)[\"'`]", txt, flags=re.I):
            routes.append({"path": path, "method": m.group(1).upper(), "route": m.group(2), "function": None, "framework": "express"})
    return sorted(routes, key=lambda x: (x["route"], x["method"]))

def extract_api_calls(collected: Dict[str, str]) -> List[Dict[str, Any]]:
    calls = []
    patterns = [
        r"\bfetch\(\s*[`'\"]([^`'\"]+)[`'\"]",
        r"\baxios\.(get|post|put|patch|delete)\(\s*[`'\"]([^`'\"]+)[`'\"]",
        r"\bapi\.(get|post|put|patch|delete)\(\s*[`'\"]([^`'\"]+)[`'\"]",
        r"\bclient\.(get|post|put|patch|delete)\(\s*[`'\"]([^`'\"]+)[`'\"]",
        r"\brequest\(\s*{[^}]*url\s*:\s*[`'\"]([^`'\"]+)[`'\"]",
    ]
    for path, txt in collected.items():
        if not path.endswith((".ts", ".tsx", ".js", ".jsx")):
            continue
        for pat in patterns:
            for m in re.finditer(pat, txt):
                if len(m.groups()) == 1:
                    method, url = None, m.group(1)
                else:
                    method, url = m.group(1).upper(), m.group(2)
                if url.startswith(("http", "/", "${", "`")) or "/api/" in url or url.startswith("api/"):
                    calls.append({"path": path, "method": method, "url": url, "line": txt[:m.start()].count("\n")+1})
    return calls

def extract_components_ui(collected: Dict[str, str]) -> Dict[str, Any]:
    comps = []
    ui_elems = []
    forms = []
    buttons = []
    charts = []
    for path, txt in collected.items():
        if not path.endswith((".tsx", ".jsx", ".ts", ".js")):
            continue
        for m in re.finditer(r"(?:export\s+default\s+function|function|const)\s+([A-Z][A-Za-z0-9_]*)", txt):
            comps.append({"path": path, "component": m.group(1), "line": txt[:m.start()].count("\n")+1})
        # UI tags
        tags = Counter(re.findall(r"<([A-Za-z][A-Za-z0-9_.:-]*)\b", txt))
        if tags:
            ui_elems.append({"path": path, "tags": dict(tags.most_common(30))})
        for m in re.finditer(r"<button\b|<Button\b", txt):
            label = txt[m.start():m.start()+400]
            label_text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", label))[:180]
            buttons.append({"path": path, "line": txt[:m.start()].count("\n")+1, "snippet": label_text})
        if re.search(r"<form\b|useForm|react-hook-form|zodResolver", txt):
            forms.append({"path": path, "signals": sorted(set(re.findall(r"(useForm|zodResolver|<form\b|FormField|Input|Select|Textarea)", txt)))})
        if re.search(r"Recharts|LineChart|BarChart|PieChart|AreaChart|Plotly|ResponsiveContainer|Chart", txt):
            charts.append({"path": path, "signals": sorted(set(re.findall(r"(LineChart|BarChart|PieChart|AreaChart|ResponsiveContainer|Plotly|Recharts)", txt)))})
    return {"components": comps, "ui_elements": ui_elems, "forms": forms, "buttons": buttons, "charts": charts}

def extract_models_schemas_migrations(collected: Dict[str, str]) -> Dict[str, Any]:
    out = {"sqlalchemy_models": [], "pydantic_schemas": [], "alembic_migrations": [], "sql_tables": [], "prisma_models": []}
    for path, txt in collected.items():
        if path.endswith(".py"):
            for m in re.finditer(r"class\s+([A-Za-z_][A-Za-z0-9_]*)\(([^)]*)\):", txt):
                bases = m.group(2)
                if "Base" in bases:
                    table = None
                    tm = re.search(r"__tablename__\s*=\s*[\"']([^\"']+)", txt[m.end():m.end()+1000])
                    if tm: table = tm.group(1)
                    out["sqlalchemy_models"].append({"path": path, "class": m.group(1), "table": table})
                if "BaseModel" in bases:
                    out["pydantic_schemas"].append({"path": path, "class": m.group(1)})
            if "/versions/" in path or "alembic" in path.lower():
                rev = re.search(r"revision\s*=\s*[\"']([^\"']+)", txt)
                down = re.search(r"down_revision\s*=\s*[\"']([^\"']+)", txt)
                out["alembic_migrations"].append({"path": path, "revision": rev.group(1) if rev else None, "down_revision": down.group(1) if down else None})
        if path.endswith(".sql"):
            for m in re.finditer(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_.\"]+)", txt, flags=re.I):
                out["sql_tables"].append({"path": path, "table": m.group(1)})
        if path.endswith(".prisma"):
            for m in re.finditer(r"model\s+([A-Za-z0-9_]+)\s*{", txt):
                out["prisma_models"].append({"path": path, "model": m.group(1)})
    return out

def risk_findings(collected: Dict[str, str]) -> List[Dict[str, Any]]:
    findings = []
    for path, txt in collected.items():
        lines = txt.splitlines()
        for category, pats in RISK_PATTERNS.items():
            for pat in pats:
                rx = re.compile(pat, re.I)
                for i, line in enumerate(lines, 1):
                    if rx.search(line):
                        findings.append({
                            "category": category,
                            "path": path,
                            "line": i,
                            "pattern": pat,
                            "snippet": redact(line.strip())[:300],
                            "severity": severity_for(category, line)
                        })
    return findings

def severity_for(category: str, line: str) -> str:
    if category in {"destructive", "security_backend"}:
        return "high"
    if category in {"unsafe_frontend", "silent_errors"}:
        return "medium"
    if category in {"fake_mock_demo"}:
        if re.search(r"dummy|fake|mock|Math\.random", line, re.I): return "medium"
    return "low"

def feature_matrix(collected: Dict[str, str], routes: List[Dict[str,Any]], calls: List[Dict[str,Any]]) -> Dict[str, Any]:
    matrix = {}
    all_text_by_path = {p: t.lower() for p, t in collected.items()}
    for feat, keys in FEATURE_KEYWORDS.items():
        hits = []
        for path, low in all_text_by_path.items():
            score = sum(low.count(k.lower()) for k in keys)
            if score:
                hits.append({"path": path, "score": score})
        hits = sorted(hits, key=lambda x: x["score"], reverse=True)[:30]
        route_hits = [r for r in routes if any(k.lower() in (r.get("route","")+r.get("path","")).lower() for k in keys)]
        call_hits = [c for c in calls if any(k.lower() in (c.get("url","")+c.get("path","")).lower() for k in keys)]
        matrix[feat] = {
            "detected": bool(hits or route_hits or call_hits),
            "top_files": hits,
            "backend_routes": route_hits[:30],
            "frontend_calls": call_hits[:30],
        }
    return matrix

def normalize_api_path(u: str) -> str:
    u = u.replace("${API_BASE_URL}", "").replace("${baseUrl}", "").replace("${API_URL}", "")
    # strip query and template expressions coarse
    u = u.split("?")[0]
    u = re.sub(r"\$\{[^}]+\}", "{param}", u)
    if u.startswith("http"):
        m = re.search(r"https?://[^/]+(.*)", u)
        u = m.group(1) if m else u
    if not u.startswith("/"):
        u = "/" + u
    return u.rstrip("/") or "/"

def route_matrix(backend_routes: List[Dict[str,Any]], api_calls: List[Dict[str,Any]]) -> Dict[str, Any]:
    backend_paths = set(normalize_api_path(r["route"]) for r in backend_routes)
    backend_by_path = defaultdict(list)
    for r in backend_routes:
        backend_by_path[normalize_api_path(r["route"])].append(r)
    calls = []
    unmatched = []
    for c in api_calls:
        path = normalize_api_path(c["url"])
        # coarse match exact or dynamic matching
        matched = path in backend_paths
        if not matched:
            # replace /123 with /{id}; compare against route patterns like /{source_id}
            simplified = re.sub(r"/\d+", "/{param}", path)
            for bp in backend_paths:
                pattern = re.sub(r"\{[^/]+\}", "{param}", bp)
                if pattern == simplified or bp in path or path in bp:
                    matched = True; break
        item = {**c, "normalized": path, "matched_backend": matched}
        calls.append(item)
        if not matched and "/api/" in path:
            unmatched.append(item)
    unused_backend = []
    for bp, rs in backend_by_path.items():
        if not any(c["matched_backend"] and (c["normalized"] == bp or bp in c["normalized"] or c["normalized"] in bp) for c in calls):
            unused_backend.extend(rs)
    return {"frontend_calls": calls, "unmatched_frontend_api_calls": unmatched, "backend_routes_without_detected_frontend_call": unused_backend[:200]}

def live_probe(base_url: Optional[str], api_url: Optional[str]) -> Dict[str, Any]:
    result = {"base_url": base_url, "api_url": api_url, "probes": []}
    if urllib is None:
        result["error"] = "urllib unavailable"
        return result
    urls = []
    if base_url:
        for p in ["/", "/login", "/dashboard", "/dashboard/mentions", "/dashboard/scan", "/dashboard/keywords", "/dashboard/sources"]:
            urls.append(("frontend", urljoin(base_url.rstrip("/") + "/", p.lstrip("/"))))
    if api_url:
        for p in ["/health", "/api/system/worker-status", "/api/dashboard/summary", "/api/mentions", "/api/sources", "/api/keywords/groups"]:
            urls.append(("api", urljoin(api_url.rstrip("/") + "/", p.lstrip("/"))))
    for kind, u in urls:
        t0 = time.time()
        try:
            req = urllib.request.Request(u, headers={"User-Agent": "NopeDeepScanner/1.0"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                body = resp.read(2000)
                result["probes"].append({
                    "kind": kind, "url": u, "status": resp.status, "ms": int((time.time()-t0)*1000),
                    "content_type": resp.headers.get("content-type"), "preview": redact(body.decode("utf-8", errors="replace")[:1000])
                })
        except urllib.error.HTTPError as e:
            prev = ""
            try: prev = e.read(1000).decode("utf-8", errors="replace")
            except Exception: pass
            result["probes"].append({"kind": kind, "url": u, "status": e.code, "ms": int((time.time()-t0)*1000), "error": redact(prev[:1000])})
        except Exception as e:
            result["probes"].append({"kind": kind, "url": u, "status": None, "ms": int((time.time()-t0)*1000), "error": str(e)})
    return result

def extract_env_keys(collected: Dict[str, str]) -> List[Dict[str, Any]]:
    envs = []
    for path, txt in collected.items():
        if ".env" in path.lower() or "settings" in path.lower() or "config" in path.lower():
            keys = sorted(set(re.findall(r"\b([A-Z][A-Z0-9_]{2,})\b", txt)))
            likely = [k for k in keys if any(x in k.lower() for x in ["url","key","secret","token","provider","database","redis","openai","gemini","frontend","environment","scheduler","jwt","smtp","slack"])]
            if likely:
                envs.append({"path": path, "keys_detected": likely[:200]})
    return envs

def generate_markdown_report(summary: Dict[str, Any], findings: List[Dict[str, Any]], features: Dict[str, Any], matrix: Dict[str, Any]) -> str:
    high = [f for f in findings if f.get("severity") == "high"]
    med = [f for f in findings if f.get("severity") == "medium"]
    lines = []
    lines.append("# NOPE ULTRA DEEP SCAN REPORT\n")
    lines.append(f"- Scan time: {summary['scan_time']}")
    lines.append(f"- Root: {summary['root']}")
    lines.append(f"- Files indexed: {summary['files_indexed']}")
    lines.append(f"- Files collected: {summary['files_collected']}")
    lines.append(f"- Frontend routes: {summary['frontend_routes']}")
    lines.append(f"- Backend routes: {summary['backend_routes']}")
    lines.append(f"- Frontend API calls: {summary['api_calls']}")
    lines.append(f"- Risk findings: {len(findings)} (high={len(high)}, medium={len(med)})\n")
    lines.append("## Feature detection\n")
    for k, v in features.items():
        lines.append(f"- {k}: {'YES' if v['detected'] else 'NO'} | files={len(v['top_files'])} routes={len(v['backend_routes'])} calls={len(v['frontend_calls'])}")
    lines.append("\n## High/Medium risk findings preview\n")
    for f in (high + med)[:80]:
        lines.append(f"- [{f['severity']}] {f['category']} `{f['path']}:{f['line']}` — {f['snippet']}")
    lines.append("\n## API mismatch preview\n")
    for c in matrix.get("unmatched_frontend_api_calls", [])[:80]:
        lines.append(f"- frontend calls unmatched `{c['url']}` in `{c['path']}:{c['line']}`")
    return "\n".join(lines)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".", help="Project root")
    ap.add_argument("--max-file-kb", type=int, default=600)
    ap.add_argument("--max-files", type=int, default=260)
    ap.add_argument("--base-url", default=None, help="Optional deployed frontend URL")
    ap.add_argument("--api-url", default=None, help="Optional deployed backend API URL")
    ap.add_argument("--out", default=None, help="Output directory")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    stamp = nowstamp()
    outdir = Path(args.out or (root / f"nope_ultra_deep_scan_{stamp}")).resolve()
    outdir.mkdir(parents=True, exist_ok=True)

    files, collected = scan_files(root, args.max_file_kb, args.max_files)
    tree = build_tree(root)

    backend_routes = extract_backend_routes(collected)
    frontend_routes = extract_frontend_routes(collected)
    api_calls = extract_api_calls(collected)
    comps = extract_components_ui(collected)
    models = extract_models_schemas_migrations(collected)
    packages = package_inventory(collected)
    risks = risk_findings(collected)
    features = feature_matrix(collected, backend_routes, api_calls)
    matrix = route_matrix(backend_routes, api_calls)
    envs = extract_env_keys(collected)
    live = live_probe(args.base_url, args.api_url) if (args.base_url or args.api_url) else {"skipped": True}

    summary = {
        "scanner": "nope_ultra_deep_project_scanner",
        "version": "2.0",
        "scan_time": dt.datetime.now().isoformat(),
        "system": {"python": sys.version, "platform": platform.platform()},
        "root": str(root),
        "files_indexed": len(files),
        "files_collected": len(collected),
        "frontend_routes": len(frontend_routes),
        "backend_routes": len(backend_routes),
        "api_calls": len(api_calls),
        "risk_findings": len(risks),
        "high_risk_findings": len([r for r in risks if r["severity"] == "high"]),
        "medium_risk_findings": len([r for r in risks if r["severity"] == "medium"]),
        "unmatched_frontend_api_calls": len(matrix.get("unmatched_frontend_api_calls", [])),
    }

    write_json(outdir, "scan_summary.json", summary)
    write_text(outdir, "project_tree.txt", tree)
    write_json(outdir, "files_index.json", files)
    write_json(outdir, "collected_code_redacted.json", collected)
    write_json(outdir, "package_inventory.json", packages)
    write_json(outdir, "env_keys_redacted.json", envs)
    write_json(outdir, "frontend_routes.json", frontend_routes)
    write_json(outdir, "backend_routes.json", backend_routes)
    write_json(outdir, "frontend_api_calls.json", api_calls)
    write_json(outdir, "route_matrix.json", matrix)
    write_json(outdir, "ui_components_forms_buttons_charts.json", comps)
    write_json(outdir, "models_schemas_migrations.json", models)
    write_json(outdir, "risk_findings.json", risks)
    write_json(outdir, "feature_matrix.json", features)
    write_json(outdir, "live_probe.json", live)

    # CSV summaries
    with (outdir / "backend_routes.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["method","route","function","framework","path"])
        w.writeheader(); w.writerows(backend_routes)
    with (outdir / "risk_findings.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["severity","category","path","line","pattern","snippet"])
        w.writeheader(); w.writerows(risks)
    with (outdir / "frontend_api_calls.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["method","url","path","line"])
        w.writeheader(); w.writerows(api_calls)

    report = generate_markdown_report(summary, risks, features, matrix)
    write_text(outdir, "ULTRA_DEEP_SCAN_REPORT.md", report)

    # zip output
    zip_path = root / f"nope_ultra_deep_scan_{stamp}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for p in outdir.rglob("*"):
            if p.is_file():
                z.write(p, p.relative_to(outdir))
    print(json.dumps({"ok": True, "zip": str(zip_path), "summary": summary}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
