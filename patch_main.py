import re

main_path = "backend/app/main.py"
with open(main_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add to imports
if "from app.api import collectors" not in content:
    content = content.replace(
        "from app.api import (", 
        "from app.api import (\n    collectors,"
    )

# Add router
if "app.include_router(collectors.router" not in content:
    content = content.replace(
        "app.include_router(auth.router,", 
        "app.include_router(collectors.router,       prefix=\"/api/collectors\",      tags=[\"Collectors\"])\napp.include_router(auth.router,"
    )

with open(main_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Main patched")
