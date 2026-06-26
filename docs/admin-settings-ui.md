# Admin Settings UI Complete

## Goal
Complete the missing Admin Settings UI areas (Organization, Email, Notifications, Webhooks, API, Security, Sessions, Appearance) by migrating them to use the centralized `api` Axios instance instead of raw `fetch` calls. This ensures proper token injection, automatic 401/403 redirects, and local development compatibility.

## Changes Made
1. **Refactored Components**:
   - `RoleManagement.tsx`
   - `OrganizationSettings.tsx`
   - `EmailSettings.tsx`
   - `NotificationSettings.tsx`
   - `NotificationDeliveries.tsx`
   - `PersonalProfile.tsx`
   - `PersonalNotifications.tsx`
   - `SecuritySettings.tsx`
   - `SessionsSettings.tsx`
   - `AppearanceSettings.tsx`
   - `BrandingSettings.tsx`
   - `AuditLogs.tsx`

2. **API Updates**:
   - Replaced all hardcoded production URLs (`https://social-listening-backend.onrender.com/...`) with relative API endpoints (e.g., `/api/admin/settings/...`).
   - Removed manual `localStorage.getItem('access_token')` and manual `Authorization` headers.
   - Updated response handling to use `response.data` instead of `response.json()`.
   - Updated error handling to extract error details using `error.response?.data?.detail`.

## Verification Done
1. `npm run type-check` in `frontend` completed without errors.
2. `npm run build` in `frontend` completed without errors.
3. No fake mock data or fake API flows were created.
4. Preserved existing UI styling.

## Risks & Considerations
- Components no longer have hardcoded API URLs. They rely on Axios base URL logic which supports both development and production.
- Make sure standard users cannot access Admin Settings. The API logic itself enforces RBAC with `403 Forbidden`, which is gracefully handled by the global interceptor.
