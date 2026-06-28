# Report Export Style Polish Notes

## 1. Excel Sample Structure (`free_fire_report_2026-06-28_06.11.xlsx`)

### General Observations
- The workbook has 5 main sheets, ordered logically from raw data to analytics:
  1. `Mentions`
  2. `Sentiment`
  3. `Categories`
  4. `Numerical data`
  5. `Analytics data`

### Sheet-Specific Details
**A. Mentions**
- **Columns**: ID, Date, Hrs, Title, Content, Source, Domain, Category, Sentiment, Tags.
- **Layout**: Headers on row 2 (row 1 is empty or title).
- **Styling**: Frozen panes for headers. Columns have sensible widths (Title, Content, Source, Domain are wide, e.g., 25+).
- **Format**: Mentions content wraps text. Dates and times are properly formatted strings. IDs are handled as numbers but should probably be strings to prevent scientific notation in larger values.
- **Data**: Detailed, raw data row per mention. Sentiment is numeric (-1, 0, 1) or mapped to string in other formats.

**B. Sentiment**
- **Columns**: Empty col A, then `[SentimentLabel, Count, Percentage]`.
- **Layout**: Simple 3-row table (`Positive`, `Neutral`, `Negative`) with basic percentage formatting (`0.00%`).

**C. Categories**
- **Columns**: Empty col A, then `[Category, Number of mentions]`.
- **Layout**: Displays breakdown of source types/domains.

**D. Numerical data**
- **Columns**: Date, Mentions count, Positive mentions count, Negative mentions count, Social Media Reach, Nonsocial Media Reach.
- **Layout**: Daily aggregation of metrics.

**E. Analytics data**
- **Columns**: Metric, Value.
- **Layout**: Key metrics overview (Total Mentions, Social mentions, Non-social, Positives, etc.).

---

## 2. PDF Sample Structure (`report-1397554919.pdf`)

### Overall Flow
The PDF is a 23-page detailed report with clear section breaks and a distinct visual hierarchy.

### Sections
1. **Cover Page**: Project name, date range.
2. **Summary Card**: Big "Summary" title page.
3. **Overview KPIs**: Total results, Total reach with large percentage changes.
4. **Executive Summary**: Text-heavy summary paragraph of the period's performance.
5. **Analysis Card**: Big "Analysis" title page.
6. **Top Mentions**: Selected top posts by reach, styled with views, followers, date, domain.
7. **Recent Mentions**: Selected recent posts.
8. **From top public profiles**: Mentions from high-profile sources.
9. **Mentions & Reach Trend**: Line charts showing mentions/reach over time.
10. **Sentiment by Categories**: Stacked bar or breakdowns.
11. **Most Share of Voice**: Table of profiles with the highest reach/mentions.
12. **Trending Hashtags/Links**: Simple tables of top tags/links.
13. **Most Active Sites**: Table of domains.
14. **Popular Emojis / Context**: Word clouds or emoji lists.
15. **Period Comparison Card**: Title page.
16. **Comparison Details**: Charts comparing Current vs Previous periods for Mentions, Reach, Sentiment.
17. **Influencers & Sources Card**: Title page.
18. **Top 10 Influencers / Sources**: Detailed tables with Site, Mentions, Reach, Visits, Influence Score.
19. **Closing Page**: "Thank You!".

### Styling Notes
- Distinct separator pages for major sections (Summary, Analysis, Period Comparison, Influencers).
- Clean, airy layout with prominent headers.
- Consistent color coding (e.g., green for positive, red for negative, blue for neutral/metrics).
- "No data available" gracefully handled when certain categories are empty.
