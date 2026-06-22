# Phase 6: Real Reports and Exports

## Overview
Phase 6 implements direct real-time data export endpoints, allowing users to securely download their projects' data directly from the system database into standard analytical formats (CSV and XLSX).

## Available Endpoints
- `GET /api/reports/mentions/export?format=csv`: Exports mention details including AI analysis sentiment and risk score.
- `GET /api/reports/alerts/export?format=csv`: Exports alert tracking and severity states.
- `GET /api/reports/incidents/export?format=csv`: Exports incident resolution states.
- `GET /api/reports/project-summary/export?format=xlsx`: Generates a multi-sheet Microsoft Excel workbook providing a complete snapshot of Mentions, Alerts, and Incidents tied to a specific project.

## Supported Formats
1. **CSV (Comma Separated Values)**
   - Returns a `StreamingResponse` for minimal memory overhead.
   - Encoded in UTF-8.
2. **XLSX (Microsoft Excel)**
   - Utilizes `openpyxl` to build multiple worksheets natively.
   - Returns binary application payload via `Response`.

## Filters Supported
- `project_id`: Restricts results exclusively to a specific project.
- `date_from` / `date_to`: Temporal range bounding.
- `sentiment` / `risk_level`: Granular AI properties filter (Mentions).
- `severity` / `status`: State flow filters (Alerts, Incidents).

## Scoping & Permissions
Each API leverages `apply_tenant_filter` via `current_user` to automatically scope down data requests. It correctly prevents cross-tenant access to unowned mentions and incidents.

## Future Limitations / Exclusions
- **PDF Exporting**: Currently flagged as optional/future. The previous `report_service.py` structure allows file-write PDF generation with `reportlab`, but real-time synchronous streaming of PDF binaries is skipped for this phase to prioritize raw data (CSV/Excel).
- **Asynchronous Queues**: The streams block HTTP threads linearly. For extremely large exports (> 1,000,000 rows), a Celery task returning a download link will be needed in a future phase.

Phase 6 real reports and exports implemented and locally verified.
