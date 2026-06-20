# Meta (Facebook/Instagram) Integration Foundation

## Purpose
This document outlines the foundation for integrating official Meta APIs into the Social Listening Platform. The goal is to prepare the system for OAuth-based connection with Facebook and Instagram, enabling the collection of real, authorized mentions, posts, and comments strictly adhering to Meta’s Developer Policies. It ensures robust credential storage, explicit scopes validation, and lays out service interfaces for future content ingestion.

## Required Environment Variables
For the Meta OAuth flow to work correctly and securely in production, ensure the following environment variables are properly configured within the backend environment (`.env` or Render settings):
- `META_APP_ID`: The unique Application ID provided by the Facebook Developer Portal.
- `META_APP_SECRET`: The corresponding Application Secret.
- `META_REDIRECT_URI`: The authorized OAuth redirect callback URL (e.g., `https://api.nope.com/api/integrations/meta/callback`).
- `CRYPTO_KEY`: The base cryptographic key used by `app.core.crypto` to safely encrypt and decrypt the stored `token_encrypted` values in the database.

## OAuth Flow Overview
1. **Initiation**: User clicks the "Kết nối" button from the integration dashboard. The frontend redirects to `GET /api/integrations/meta/auth-url`.
2. **State Generation**: The backend generates a secure `oauth_states` record for CSRF protection and provides the Meta Login URL requesting explicit scopes (e.g., `pages_show_list`, `pages_read_engagement`, `instagram_basic`).
3. **Authorization**: The user approves the requested scopes on Facebook.
4. **Callback**: Facebook redirects back to `GET /api/integrations/meta/callback` with a temporary code.
5. **Token Exchange**: The backend exchanges the code for a long-lived Access Token, encrypts it, and stores it securely within the `social_integrations` table.
6. **Account Selection**: The user selects which specific Facebook Pages or Instagram Business Accounts they want to monitor. These selections are stored within the `social_integration_accounts` table.

## Implemented Files and Services
- **`backend/alembic/versions/*_add_meta_integrations.py`**: The underlying schema creation, isolating new tracking structures without disrupting existing ones.
- **`backend/app/services/meta_integration_service.py`**: A foundational service mapping capabilities. It centralizes logic for token expiry checking, decryption, and scope validation (`has_capability()`).
- **`backend/app/services/facebook_ingestion_service.py`**: The skeletal orchestration layer for Facebook engagement monitoring. Intercepts fetch requests if proper permissions are lacking.
- **`backend/app/services/instagram_ingestion_service.py`**: Equivalent skeletal orchestration layer handling Instagram Business scopes (`instagram_basic`).
- **`frontend/src/app/dashboard/mentions/page.tsx`**: Dynamic, capability-aware UI mapping. Connectors gracefully adapt states (from "Kết nối" to "Đã kết nối") using the `integrations.capabilities()` endpoint.

## What Is NOT Implemented Yet
- Automated background worker jobs invoking these ingestion services.
- Real-time mapping of ingested Meta posts into the unified `mentions` table schema.
- Data synchronization pipelines handling rate limiting, Webhook updates, or continuous polling.
- Bypassing Meta's official API constraints (no scraping scripts or headless browsers are utilized).

## Meta App Review Limitations
Depending on the final product goal, certain ingestion endpoints will strictly fail unless proper Meta App Reviews are cleared:
- **Instagram Hashtag Search**: Reaching out to the Graph API's `/ig_hashtag_search` endpoint requires **Public Content Access**. This dictates a stringent App Review and often mandatory Business Verification. The skeleton (`search_instagram_hashtag`) explicitly raises exceptions if the app is unapproved.
- **Pages Engagement**: Fetching broad engagement metrics via the `pages_read_engagement` and `pages_read_user_content` scopes requires explicit reviews if the app operates publicly beyond the initial developer/admin roles. 
- Ensure that the App Dashboard is reviewed thoroughly before moving the environment to 'Live' mode.

## Next Steps
- Implement real sync/ingestion background jobs integrating with the newly developed service interfaces to pipe actual Mentions to the UI securely.
- Integrate App Webhooks to allow Meta to push realtime engagements, eliminating pure polling constraints.
