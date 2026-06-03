import re

layout_path = "frontend/src/app/dashboard/layout.tsx"
with open(layout_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace projectNav to include Dashboard
pattern = r"const projectNav = \[\s*\{ name: 'Mentions'"
replacement = "const projectNav = [\n    { name: 'Dashboard', href: '/dashboard/overview', icon: LayoutDashboard },\n    { name: 'Mentions'"

if "{ name: 'Dashboard'" not in content:
    content = re.sub(pattern, replacement, content)
    
    # Also fix Comparison icon since we used LayoutDashboard for it originally
    content = content.replace(
        "{ name: 'Comparison', href: '/dashboard/comparison', icon: LayoutDashboard }",
        "{ name: 'Comparison', href: '/dashboard/comparison', icon: PieChart }"
    )

with open(layout_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Layout patched")
