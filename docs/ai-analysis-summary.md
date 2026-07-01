# AI Analysis Summary

## Overview
The AI Analysis Summary feature provides an automated, AI-generated executive report summarizing the social listening data based on user-defined filters. The generated summary includes sentiment insights, key topics, risks, recommended actions, and notes on data quality.

## Features
- **Contextual Generation**: Generates a summary based on real filtered mentions (up to the 50 most recent).
- **Structured JSON Output**: Returns a strictly structured JSON response for the frontend to render elegantly.
- **Custom AI Configuration**: Relies entirely on the user's personal `AIModelConfig` setting (Gemini, OpenAI, or a Custom Provider).

## Backend Implementation

### Endpoint
`POST /api/mentions/summarize`

### Process Flow
1. **Config Validation**: Queries the `AIModelConfig` table to verify that the `current_user` has configured and enabled an AI model. If missing, it immediately throws a `400 Bad Request` with a user-friendly error message.
2. **Context Gathering**: Applies standard project/date/sentiment filters and fetches the latest mentions (max 50) to use as the context.
3. **Prompt Construction**: Builds a Vietnamese system prompt combined with the retrieved mentions formatted as text.
4. **AI Invocation**: Calls the underlying `_call_ai_provider` from `ai_service.py` to communicate with the user's chosen LLM, ensuring API keys remain securely on the server.
5. **Output Processing**: Extracts the JSON payload from the AI's response (removing any markdown formatting if present) and returns it.

## Fixes Implemented on the Summary Page
- **Sentiment Bug Fixed**: Earlier queries strictly searched for uppercase/lowercase mismatches. The system now counts sentiments case-insensitively using `func.lower(Mention.sentiment)`.
- **7-Day Trend Fixed**: Rather than calculating the last 7 days from `datetime.now()` (which results in 0 if mentions are old), the trend query now computes backwards from the `latest_collected_at` date of the filtered mentions.

## Manual Verification
1. Ensure you have an AI Model Config saved in `Settings -> Cấu hình AI`.
2. Go to `Dashboard -> Summary`.
3. Check that the Sentiment cards are no longer 0 (if mentions exist) and the Trend chart displays data.
4. Click "Tạo AI Summary" and wait for the JSON response to populate the UI.
5. Check browser developer tools (Network tab) to confirm raw API keys are **never** returned to the frontend.
