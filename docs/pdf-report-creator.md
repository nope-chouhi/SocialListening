# PDF Report Creator

The PDF Report Creator feature allows users to generate customized, Brand24-style PDF reports. It features dynamic configuration, a live HTML-based preview, and a robust ReportLab-based backend generator.

## Frontend Features
- **Location**: rontend/src/app/dashboard/reports/pdf/page.tsx
- **Preview**: PdfPreviewModal.tsx renders a live, scaled-down HTML representation using echarts for charts.
- **Customization**:
  - Theme (Light/Dark)
  - Accent Color
  - Font Style (Helvetica, Times New Roman, Courier)
  - Font Color
  - Aspect Ratio (A4 Portrait / Landscape)
  - Language (English, Vietnamese - currently disabled pending translation)
  - Logo Upload (Disabled until report asset storage is implemented)

## Backend Features
- **API Endpoints**: 
  - GET /api/reports/summary-data (provides metrics, previous period comparison, daily trend, raw mentions, and sentiment breakdown)
  - POST /api/reports/export (initiates async background job)
- **Generator Core**: ackend/app/services/pdf_generator.py uses ReportLab to dynamically render only enabled sections and apply user-selected customization tokens (theme, colors, fonts).
- **Export Flow**: ExportService parses the ReportBuilderConfig from the export record.

## Available Sections
| Section | Status | Description |
|---|---|---|
| Summary | Supported | Title page with basic project info. |
| Overview | Supported | KPI blocks (mentions, reach, positive sentiment). |
| Executive Summary | Supported | AI-generated summary text. |
| Analysis | Supported | Sentiment breakdown (Pie chart) and Daily Volume (Bar chart). |
| Period Comparison | Supported | Mentions and Reach change compared to previous period. |
| Influencers & Sources | Supported | Top domains list. |
| Top Mentions | Supported | Mentions sorted by reach. |
| Recent Mentions | Supported | Mentions sorted chronologically. |

## Disabled/Deferred Sections
| Section | Reason for Exclusion |
|---|---|
| AI Visibility | AI visibility score is not supported by the current data model. |
| Demographics | Demographics parsing (age/gender) is not fully implemented in the pipeline. |
| Project Comparison | Only single-project reporting is supported currently. |
| Active Sites | Included inside Sources section. |
| Most Influential Sites | Influence scores per site not currently tracked. |
| Mention Tags | Mention tags are not natively supported in the reports endpoint. |
| Sentiment | Included inside Analysis section in this version. |
| Mentions & Reach | Included inside Analysis section in this version. |
| Categories / Sources | Included inside Influencers & Sources section. |
| Trending Hashtags / Links | Hashtag extraction not fully supported by current data model. |
| Emojis / Discussion Context | Emoji extraction is not supported by the current data model. |

## Consistency Rules
The preview and generated PDF share the same state configuration. When a user selects a configuration in the frontend:
1. The PdfPreviewModal reads the active config and immediately updates its styling (CSS variables and inline styles).
2. The config is JSON-serialized and sent to POST /api/reports/export as uilder_config.
3. The background worker parses uilder_config and maps the font name to eportlab standard fonts, translating HEX codes to RGB values for the final document.
4. Any section disabled in the UI will not be rendered in the preview and will not be included in the PDF generation.

## Testing
- Backend Tests: pytest tests/test_reports.py -v verifies config acceptance and parsing.
- Frontend Checks: 
pm run type-check and 
pm run build.

## Production Limitations
- The system currently generates PDFs in English only. 
- Custom logo uploads in the generated PDF are disabled pending file storage implementation.
- Chart generation in the PDF is simplified (using standard eportlab.graphics or basic shapes) and may look visually simpler than the frontend echarts equivalents until full chart drawing is synchronized.
