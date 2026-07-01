# Mentions Verifiable Source Policy

## Purpose
This document outlines the data-quality behavior rules for mentions within the platform to maintain the highest level of trust ("Trust > Fancy UI, Data Quality > Data Quantity"). 

## Verifiable Mentions Rule
A mention is considered **valid and verifiable** for production consumption ONLY if it possesses at least one verifiable canonical source link. The platform identifies the following fields as valid original URLs:
- `url`
- `original_url`
- `canonical_url`

## Core Data Quality Policies

1. **Exclusion by Default:** Mentions without any verifiable URL (meaning `url`, `original_url`, and `canonical_url` are all NULL or empty) are treated as incomplete/unverifiable. By default, they are strictly excluded from:
   - The main mentions list (`/dashboard/mentions`)
   - Dashboard count statistics and pagination
   - Filtered source lists and summary charts
   - Analytics, Reports, and Excel/PDF Exports

2. **No Invented Context:** The platform must never fake, mock, or invent URLs, author names, descriptions, or domain names to appease the UI. If fields are absent, the platform must gracefully fallback to existing available fields, or display legitimate identifiers without fabricating paths.
   
3. **Admin and Diagnostic Opt-In:** Verifiable filtering is enforced securely at the SQLAlchemy level via the `apply_tenant_filter` hook. However, specific administrative, debugging, or direct-lookup operations (e.g. detail views, bulk delete routes) explicitly opt-in by passing `include_unverifiable=True`. This prevents the system from "losing" orphaned database rows entirely, while ensuring normal project analysts do not process unverifiable data.
