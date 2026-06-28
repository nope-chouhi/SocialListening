# AI Chat & Model Configuration

This document outlines the architecture, setup, and usage of the AI Chat feature in the Social Listening platform.

## Architecture & Persistence

The platform supports a persistent, billing-ready AI chat experience.

1. **`ai_model_config`**: A global (or organization-scoped) configuration table storing the active AI provider, model, API key, and rules (tokens/temperature).
2. **`ai_chat_sessions`**: Chat session persistence, allowing users to return to previous conversations.
3. **`ai_chat_messages`**: Individual messages within a session, including user inputs and AI responses.
4. **`ai_usage_logs`**: Tracks token usage and success/failure of each request. This forms the foundation for future customer billing.

## Supported Providers

The system dynamically routes requests based on the administrator's configuration. Supported options:

- **OpenAI / GPT**: Uses the official `openai` SDK. Supports extracting prompt and completion token counts.
- **Google Gemini**: Uses `google.generativeai` SDK. Supports extracting token counts via `usage_metadata`.
- **Custom Provider**: Any provider exposing an OpenAI-compatible API endpoint (e.g., Ollama, LM Studio, Together, Groq). Requires specifying the `Base URL`. Token counts are parsed via the standard OpenAI response format.

## API Key Security

- The API key is securely stored in the database.
- Read operations (GET `/api/admin/settings/ai-model`) automatically mask the API key (e.g., `sk-o...1234`).
- The frontend UI never exposes the raw API key back to the user.
- During updates (PUT), if the frontend sends the masked string, the backend ignores it and preserves the existing key.

## Context Injection & Safety

To provide relevant answers, the AI system injects project context into the System Prompt before calling the provider.
- **Verifiable Context Only**: Unverifiable mentions (those lacking original URLs) are explicitly excluded from the count.
- **Limits**: To prevent exorbitant token costs, only summary data (e.g., counts, sentiment distribution) and a limited window of recent messages are injected into the context.

## Usage Tracking

Each message sent triggers a corresponding write to the `ai_usage_logs` table.
- **Tokens**: Captures `input_tokens`, `output_tokens`, and `total_tokens` directly parsed from the provider's API response.
- **Fallback**: If a provider doesn't return exact tokens, the value remains `null` to avoid faking usage data for billing.
- **Errors**: Failed API calls are logged with `success=false` and their error string to aid troubleshooting.

## Admin Features

Administrators can navigate to **Cài đặt -> Cấu hình AI** on the frontend to:
1. Turn the entire AI Assistant feature on or off.
2. Switch between providers.
3. Update API Keys.
4. **Test Connection**: Pings the provider to verify validity before enabling for customers.
5. View basic usage statistics (total requests, success rate, token usage).
