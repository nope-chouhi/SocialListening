# Application Rebranding to Nope360

This document records the branding name update from "Nope" (later "Nope24") to "Nope360" across the Social Listening Platform.

## Scope of Changes

### 1. Frontend Changes
- **Metadata and Configuration**:
  - `frontend/src/app/layout.tsx`: Updated page title, applicationName, and creator metadata to "Nope360".
  - `frontend/public/manifest.json`: Updated PWA application `name` and `short_name` to "Nope360".
- **Dashboard and Layout**:
  - `frontend/src/app/dashboard/layout.tsx`: Updated main sidebar top-left text label header to "Nope360". Updated copyright text in the footer to "Nope360, Inc.".
  - `frontend/src/app/dashboard/page.tsx`: Updated dashboard welcome message header to "Chào mừng đến với Nope360".
- **Integrations**:
  - `frontend/src/app/dashboard/integrations/meta/page.tsx`: Updated instruction text to "Nope360 sử dụng Meta OAuth...".
- **Reports and Exports**:
  - `frontend/src/app/dashboard/reports/page.tsx`: Updated report branding elements `Nope Intelligence` -> `Nope360 Intelligence` and `NOPE INTELLIGENCE` -> `NOPE360 INTELLIGENCE`.
  - `frontend/src/app/dashboard/reports/infographic/page.tsx`: Updated infographic footer to "NOPE360 INTELLIGENCE".
  - `frontend/src/app/dashboard/reports/excel/page.tsx`: Updated default export file name prefix for csv mentions export to "Nope360_Mentions_Export_".
  - `frontend/src/components/reports/ExportHistoryTable.tsx`: Updated report download filename structure from `Nope_Export_` to `Nope360_Export_`.
- **Settings**:
  - `frontend/src/app/dashboard/settings/EmailSettings.tsx`: Updated "From Name" setting text input placeholder to "Nope360".
- **Webinars**:
  - `frontend/src/app/dashboard/webinar/page.tsx`: Updated main webinar page heading.
  - `frontend/src/components/dashboard/WebinarRegistrationModal.tsx`: Updated modal title and register payload fields to "Nope360".
- **Authentication**:
  - `frontend/src/app/login/page.tsx`: Updated login page title to "Đăng nhập Nope360".
- **Localization (i18n)**:
  - Updated key `webinarDesc` in translation files (`en.ts`, `ja.ts`, `ko.ts`, `th.ts`, `vi.ts`, `zh.ts`) to use "Nope360".

### 2. Backend Changes
- **Configuration settings**:
  - `backend/app/core/config.py`: Updated fallback `APP_NAME` from `"Nope"` (previously updated to `"Nope24"`) to `"Nope360"`.
- **System Prompts / Dynamic responses**:
  - `backend/app/api/ai_chat.py`: Updated system prompt for AI chatbot to refer to "Nope360".
  - `backend/app/api/integrations.py`: Updated Meta integration limitation info string to "Nope360".
  - `backend/app/api/reports.py`: Updated dynamic export filename to `Nope360_Export_`.
  - `backend/app/services/email_report_service.py`: Updated email report footer text to refer to "Nope360 Social Listening Platform".

---

## Intentionally Unchanged

The following purely technical/internal identifiers were preserved to ensure system stability and avoid breaking backward compatibility:
- **LocalStorage Keys**: Keys like `nope_auth_storage_version` and `nope_active_project_id` in `frontend/src/contexts/` were preserved.
- **Crypto Salts**: `salt = b"nope_saas_encryption_salt"` in `backend/app/core/crypto.py` was preserved.
- **Scraper / Bot User Agent**: Bot identifier in `backend/app/services/rss_collector.py` was preserved.
- **Support Email**: The support address `support@nope.com` was kept unchanged per direct instructions.
- **Database / API Route Naming**: Internal database files (e.g. `nope.db`) and local developer script references.

---

## Verification Run

The following commands were run locally to ensure no syntax/type-checking errors were introduced:
1. `cd frontend && npm run type-check` (Frontend TypeScript verification)
2. `cd frontend && node scripts/check-i18n-keys.mjs` (i18n locale file key consistency)
3. `python -m compileall backend/app` (Backend compilation check)
