# 🎯 Social Listening Platform

Platform giám sát và xử lý khủng hoảng danh tiếng trên mạng xã hội.

## 🚀 Quick Start

### Contribution Workflow

The `main` branch is protected. All changes must go through a Pull Request.
1. Create a new branch from `main`: `git checkout -b <feature-branch>`
2. Make your changes and commit them.
3. Push the branch and create a Pull Request on GitHub.

### Run Backend Locally
```bash
RUN.bat
```

### Create Admin User
```bash
create-admin.bat
```

## 📁 Project Structure

```
SocialListening/
├── backend/           # FastAPI backend
├── frontend/          # Next.js frontend
├── scripts/           # Python scripts (import, test, etc.)
├── docs/              # Documentation
├── data/              # Data files (Excel, JSON)
├── deploy.bat         # Deploy to GitHub
├── RUN.bat            # Run backend locally
└── create-admin.bat   # Create admin user
```

## 🌐 Live URLs

- **Frontend:** https://social-listening-azure.vercel.app
- **Backend:** https://social-listening-backend.onrender.com
- **GitHub:** https://github.com/hung29610/SocialListening

## 📚 Documentation

- [Next Steps](docs/NEXT_STEPS.md) - What to do next
- [Service Catalog Status](docs/SERVICE_CATALOG_STATUS.md) - Current status
- [Workflow Guide](docs/SERVICE_REQUEST_WORKFLOW_GUIDE.md) - How to use
- [Import Guide](docs/IMPORT_EXCEL_SERVICES_GUIDE.md) - Import services

## 🔧 Scripts

Located in `scripts/` folder:

- `check_backend_health.py` - Check backend status
- `import_excel_services_v2.py` - Import services from Excel
- `test_service_request_workflow.py` - Test workflow
- `check_categories.py` - View current data

## 🎯 Features

### ✅ Completed
- Keywords & Sources Management
- Web Crawling & Scanning
- Mentions Detection
- Alerts & Incidents
- Reports & Dashboard
- **Service Catalog Module** (New!)
  - Service management
  - Service request workflow
  - Dashboard metrics
- **Phase 4**: Automated background scanning (implemented and test-backed, requires production activation/configuration)
- **Phase 5**: Real Notifications (SMTP/Webhook) & Delivery Logs + Retries (implemented and test-backed, requires live SMTP/Webhook verification)
- **Phase 6**: Real PDF/Excel exports

### ⏳ Current Production Blockers
- Production migration stability
- AI config persistence verification
- Frontend admin/service UI completion
- Crawler quality for JS-heavy sources

*Note: Production is not fully ready until verified by real production smoke tests.*

## 📞 Support

Check documentation in `docs/` folder for detailed guides.

---

**Last Updated:** 2026-06-23
