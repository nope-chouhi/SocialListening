# Playwright Testing Setup

This document describes the Playwright end-to-end (E2E) testing framework setup for the Nope Social Listening Platform.

## Why Root-Level Playwright was Added

1. **Cross-Stack Capability**: Playwright acts as an integration and E2E testing framework. Placing it at the root enables test suites to span across the React/Next.js frontend and the FastAPI backend without coupling test execution strictly to frontend UI unit dependencies.
2. **Dynamic Ingestion Prep**: The project's crawler architecture will eventually require JavaScript-heavy parsing capabilities (e.g., dynamic page loading). Centralizing Playwright dependencies at the root makes the packages accessible for future dynamic crawler connectors.

## Added Files

* **`package.json` & `package-lock.json`**: Root-level node package files specifying devDependencies for Playwright.
* **`playwright.config.ts`**: The main Playwright settings file configuring target environments, worker configurations, output reporters, and project browsers (Chromium, Firefox, WebKit).
* **`tests/dev_only_setup_check.spec.ts`**: An environment and setup validation check.
* **`docs/playwright-setup.md`**: This documentation file detailing the setup.

## DEV_ONLY Setup Verification Test

The file `tests/dev_only_setup_check.spec.ts` is strictly a **setup verification test** (`DEV_ONLY`) used to confirm that Playwright can successfully launch browser contexts and assert behaviors in the local execution environment. 

> [!WARNING]
> This test is **not** a production or coverage test for the Nope Social Listening Platform. It validates *external* capabilities only (e.g. loading `playwright.dev`) and must not be used to signify product correctness.

### How to Replace it with Real E2E Smoke Tests

To replace this with real integration checks:
1. Ensure the backend FastAPI and Next.js frontend are running locally (`npm run dev` and `RUN.bat`).
2. Create Nope-specific specs (e.g., `tests/auth.spec.ts` or `tests/dashboard.spec.ts`).
3. Set the `baseURL` in `playwright.config.ts` to point to the local frontend instance (usually `http://localhost:3000`).
4. Write test scenarios that interact with actual Nope elements (e.g. logging in, navigating keywords).
5. Remove or keep `tests/dev_only_setup_check.spec.ts` disabled once real test coverage is added.

## Verification Run

* **Installed Version**: Verified using `npx playwright --version`.
* **Test Discoverability**: Verified test listing using `npx playwright test --list`.

### What Was Not Verified Yet

* **Runtime E2E Verification**: The actual execution of tests in headless/headed browsers has not been run against the local server environment.
* **Staging/Production Tests**: No production endpoints have been hit or tested under this setup.
* **Dynamic Crawling integration**: Playwright integration with the backend BeautifulSoup/RSS ingestion system has not yet been implemented.
