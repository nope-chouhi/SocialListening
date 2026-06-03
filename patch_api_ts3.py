import re

api_path = "frontend/src/lib/api.ts"
with open(api_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add collectors object
if "export const collectors = {" not in content:
    content += """
// ─── Collectors ─────────────────────────────────────────────────────────────
export const collectors = {
  run: async (projectId: number) => {
    const response = await api.post('/api/collectors/run', { project_id: projectId });
    return response.data;
  }
};
"""
else:
    # Fix the collectors object to return response.data instead of response if it doesn't already
    content = content.replace(
        "return response;",
        "return response.data;"
    )

with open(api_path, "w", encoding="utf-8") as f:
    f.write(content)

print("api.ts patched for collectors")
