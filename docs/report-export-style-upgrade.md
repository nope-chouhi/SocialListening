# Report Export Style Upgrade (Brand24 Style)

This document outlines the changes made to align the PDF and Excel report exports with the Brand24 style requirements, utilizing real database records.

## Export Generation Flow
1. **Data Fetching**: The `ExportService` now fetches data for the **current period** (based on `date_from` and `date_to` filters) and the **previous equivalent period** (calculating the delta and shifting back) to support comparison analytics.
2. **Data Aggregation**: The `report_helpers.py` module processes the raw `Mention` objects into comprehensive metrics:
   - `total_mentions`, `total_reach` (summing `reach_estimate`), `interactions` (likes + shares + comments + views).
   - Sentiment and Source distribution.
   - Top 10 mentions sorted by reach.
   - Daily trends across the period.
   - Heuristic AI Executive Summary generation based on metrics (avoids blocking synchronous generation while guaranteeing professional language).

## PDF Export Structure
The PDF has been overhauled using `reportlab`, featuring:
1. **Cover Page**: Displays project name, generated date, and reporting period.
2. **Executive Summary**: A concise heuristic summary generated from real metrics indicating sentiment shifts and total reach.
3. **KPI Overview**: Card-like tables showing Total Mentions, Reach, and Interactions alongside percentage changes against the previous period.
4. **Analysis & Trends**: 
   - Uses `reportlab.graphics.charts` (no external `matplotlib` dependency) to display a **Pie Chart** for Sentiment and a **Bar Chart** for Daily Mention Volume.
5. **Sources & Context**: Displays side-by-side tables for the top domains and top tags/keywords extracted from the project data.
6. **Top Mentions**: Displays the top 10 most influential mentions (sorted by reach) with snippets, domains, and sentiment.

## Excel Export Structure
The Excel export (`xlsx`) uses `openpyxl` with styled headers, custom column widths, and text wrapping:
1. **Analytics Data**: Project info and a period comparison table.
2. **Mentions**: The raw data export, including new columns (Content snippet, Domain, Reach, Interactions, URL, Sentiment).
3. **Sentiment**: Counts and percentage breakdown.
4. **Sources**: Top domains and their percentage share of the conversation.
5. **Numerical Data**: Daily date rows outlining mentions, sentiment count, and reach.

## Real Data Constraints
* All data strictly comes from `Mention` and `AIAnalysis` models.
* Reach is derived directly from `m.reach_estimate`.
* Interactions are derived directly from social counts (`m.likes_count`, `m.shares_count`, `m.comments_count`).
* "Social" vs "Non-Social" relies on a heuristic mapping of the `source_type` field.
* Word Clouds are implemented as Frequency Tables for better PDF parsing compatibility without requiring heavy graphical libraries like `Pillow/wordcloud`.


## Runtime Safety and Null/Empty Data Behavior

To ensure robust production generation without exceptions:
- **Excel Styling**: Excel styling utilizes full `openpyxl.styles` including `Alignment`, `Font`, `Border`, and `Side`.
- **PDF Export Null Safety**: The PDF generator normalizes `None` numeric metrics to `0` instead of crashing string formatters.
- **Empty Data Handling**: Empty sections in the PDF (such as no mentions, no trends, or no sentiment) render honest fallback text (`"No data available for this section."`) instead of throwing indexing errors or drawing empty charts.
- **Data Integrity**: No fake data is used in fallback cases. Reports authentically represent exactly what the platform collected during the requested period.
