import re

page_path = "frontend/src/app/dashboard/overview/page.tsx"
with open(page_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "const res = await collectors.run(activeProject.id);",
    "const res = await collectors.run(activeProject.id) as any;"
)

with open(page_path, "w", encoding="utf-8") as f:
    f.write(content)

print("page.tsx patched with as any")
