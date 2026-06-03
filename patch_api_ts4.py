import re

api_path = "frontend/src/lib/api.ts"
with open(api_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "run: async (projectId: number) => {",
    "run: async (projectId: number): Promise<any> => {"
)
content = content.replace(
    "overview: async (projectId: number) => {",
    "overview: async (projectId: number): Promise<any> => {"
)

with open(api_path, "w", encoding="utf-8") as f:
    f.write(content)

print("api.ts patched with Promise<any>")
