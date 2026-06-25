# Phase 3: Mention Trust & Source Coherence Redesign

## Summary
The Mentions UI in the Social Listening dashboard has been redesigned to be "Trust-First" and "Source-Centric". Phase 3 refines the way mentions are displayed to users by providing more transparency around source integrity, visit safety, and data provenance, following strict "No-Fake" data rules.

## Core Features Implemented

1. **Source Integrity Visualization**
   - The UI now prominently displays source domains instead of just the raw author or generic source names.
   - Introduced `ShieldCheck` (high trust) and `ShieldAlert` (low trust) badges to indicate confidence levels based on `source_confidence` or `source_integrity_level`.
   - Distinctive coloring (Emerald for trusted, Amber for low trust) visually separates high-quality sources from questionable ones.

2. **Safe Visit Logic**
   - The "Visit" button is now protected by strict integrity checks.
   - It is disabled if the source has a `visit_url_invalid_reason` or low integrity level, replacing the "Visit Nguồn" button with a disabled "Không thể Visit" button and an explanatory tooltip.
   - The raw canonical URL is also evaluated for `sediment://` or invalid structures before enabling visits.

3. **Safer Media Rendering**
   - Implemented `isValidImageUrl` checks to discard `sediment://` and internal `image_asset_pointer` placeholders.
   - Fallback strictly to text-only mode when valid media isn't available. We do not inject fake or placeholder imagery.
   - Audio and video embeds (e.g. `mp4`, `mp3`, `webm`) continue to work seamlessly if valid URLs are provided.

4. **Component Refactoring**
   - Enhanced `MentionCard.tsx` (used in dashboard overview/RecentMentions) with all the new Trust-First UI elements.
   - Replaced and aligned the inline-rendered Mentions list inside `page.tsx` (`app/dashboard/mentions/page.tsx`) to match the new source-centric layout and behavior perfectly.
   - Ensured all filtering, tagging, review, and AI analysis buttons work safely with the new layout structure without breaking underlying workflows.

## Technical Details
- **Files Modified:**
  - `frontend/src/app/dashboard/mentions/page.tsx`
  - `frontend/src/components/dashboard/MentionCard.tsx`
- **TypeScript:** Adjusted `MentionItem` in `page.tsx` to formally support `source_confidence` typings. Fixed `lucide-react` import and props inconsistencies.
- **Verification:** Completed successful compilation and Next.js static generation via `npm run type-check` and `npm run build`.

## Strict Rule Adherence
- Real data mapping only: `source_confidence`, `source_integrity_level`, `sentiment`, `risk_score`, and `matched_keywords` use strict real properties from the API types.
- No fake AI analysis: We render literal values or fallbacks (e.g. "Chưa phân tích" or "Nguồn chưa xác định").
- No fake mentions: Handled null values properly with standard Next.js conditional rendering.
