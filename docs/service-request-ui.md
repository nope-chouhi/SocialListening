# Service Request UI

This document describes the implementation of the Service Request UI in the Social Listening platform.

## Overview
The Service Request feature allows users to request specific crisis handling or reputation management services, and allows administrators to review, approve, reject, and complete these requests.

## Key Features

1. **Service Requests Dashboard (`/dashboard/services`)**
   - Displays a summary of active services and pending requests.
   - Standard users can view the catalog of available services and create new service requests.
   - Admin controls are hidden from standard users to enforce Role-Based Access Control (RBAC).

2. **Service Request Details (`/dashboard/service-requests/[id]`)**
   - A dedicated page providing a comprehensive view of a single request.
   - **Overview Tab**: Shows current status, desired outcomes, real-time pricing, and deadlines.
   - **Activity Logs**: Displays the chronological history of state changes and admin actions.
   - **Deliverables**: Displays attached documents, reports, and other finalized artifacts for the service.

3. **Role-Based Workflows**
   - **Standard Users**: Can submit draft requests and cancel requests before they are approved.
   - **Administrators**: Can approve requests, reject them, provide final pricing, and mark them as completed with a result summary.

## Technical Details
- **Frontend Stack**: Next.js (App Router), React, TailwindCSS, Lucide React (Icons).
- **Backend APIs**:
  - `GET /api/service-requests`: List all requests.
  - `POST /api/service-requests/{id}/submit`: Submit a draft.
  - `POST /api/service-requests/{id}/approve`: Approve a request.
  - `POST /api/service-requests/{id}/reject`: Reject a request.
  - `POST /api/service-requests/{id}/complete`: Complete a request.
  - `POST /api/service-requests/{id}/cancel`: Cancel a request.
  - `GET /api/service-requests/{id}/logs`: Fetch activity logs.
  - `GET /api/service-requests/{id}/deliverables`: Fetch final deliverables.

## State Management
The UI removes reliance on native `prompt()` calls by implementing robust local component state (e.g., `showRejectModal`, `showCompleteModal`) to capture admin notes and result summaries dynamically.
