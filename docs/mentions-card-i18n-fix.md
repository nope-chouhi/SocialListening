# Mentions Card I18n Fix

## Issue
The mentions cards in the dashboard were displaying missing translation keys:
- `mentions.missingUrl`
- `mentions.card.analyzeAi`
- `mentions.card.influence`

## Fix
Added the missing translation keys to all supported locales (`vi`, `en`, `ja`, `ko`, `th`, `zh`) under `frontend/src/i18n/locales/`.

- `missingUrl`: Indicates a mention has no original URL available.
- `card.analyzeAi`: Button to analyze the mention using AI.
- `card.influence`: Label for the influencer score inside the mention card.
