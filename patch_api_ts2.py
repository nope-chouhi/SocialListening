import re

api_path = "frontend/src/lib/api.ts"
with open(api_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add dashboard.overview
if "overview: async (projectId: number)" not in content:
    content = content.replace(
        "summary: async () => {",
        "overview: async (projectId: number) => { const response = await api.get('/api/dashboard/overview', { params: { project_id: projectId } }); return response.data; },\n  summary: async () => {"
    )

with open(api_path, "w", encoding="utf-8") as f:
    f.write(content)

print("api.ts patched again")
