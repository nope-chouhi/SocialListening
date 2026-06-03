import re

api_path = "frontend/src/lib/api.ts"
with open(api_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add dashboard.overview
if "overview: (projectId: number)" not in content:
    content = content.replace(
        "summary: (days: number = 30)",
        "overview: (projectId: number) => api.get(`/api/dashboard/overview?project_id=${projectId}`),\n  summary: (days: number = 30)"
    )

# Add collectors
if "export const collectors = {" not in content:
    collectors_block = """
export const collectors = {
  run: (projectId?: number) => api.post(`/api/collectors/run${projectId ? `?project_id=${projectId}` : ''}`),
};
"""
    content += collectors_block

with open(api_path, "w", encoding="utf-8") as f:
    f.write(content)

print("api.ts patched")
