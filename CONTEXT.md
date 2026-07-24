# SocialListening — Domain Context (Loop V2)

Single-context product glossary for agents. Prefer these terms in issues, specs, tickets, and code review language.

## Product domain

**Keyword**  
A monitored search term or phrase used to discover relevant public content for a tenant/project.

**Source**  
An origin channel or provider of content (e.g. web/news/social connector) from which mentions are collected.

**Scan**  
A bounded collection job that queries sources for one or more keywords and ingests results. Includes scheduled and **manual-scan** flows.

**Mention**  
A single ingested content unit (post, article, comment, etc.) matched to a keyword/scan and stored for review and analysis.

**AI-analysis**  
Model-assisted processing of mentions (sentiment, topics, summaries, risk signals) producing structured analysis outputs.

**Alert**  
A notification triggered when mention/analysis conditions cross a configured threshold or rule.

**Incident**  
A grouped or escalated reputation/crisis situation composed of related mentions, alerts, and response actions.

**Report**  
An exported or dashboard aggregation of mentions/analysis over a time range (tables, charts, downloads).

**Tenant/project isolation**  
Hard boundary ensuring data, credentials, and configuration for one tenant/project never leak into another. All queries and UI scopes must respect this isolation.

## Agent Company / engineering process terms

**Path lock**  
Declared file/directory ownership for a worker so parallel implementers do not edit the same paths.

**Worktree**  
An isolated git working directory checked out from current `origin/main` for one ticket/worker. Not the shared main checkout.

**Merge gate**  
Mandatory local/CI/review checks that must pass before a change can be proposed as merge-ready. Never bypass.

**READY_FOR_EXPLICIT_MERGE_APPROVAL**  
Terminal orchestration state meaning verification is complete and a human must explicitly approve any merge to `main`. Agents must stop here.

## Relationships

- A **tenant/project** owns many **keywords**, **scans**, **mentions**, **alerts**, **incidents**, and **reports**.
- A **scan** uses **keywords** against **sources** and produces **mentions**.
- **AI-analysis** enriches **mentions** and can drive **alerts** / **incidents**.
- **Reports** summarize **mentions** and **AI-analysis** under tenant/project isolation.
- Engineering changes run in a **worktree** with **path locks**, pass the **merge gate**, and stop at **READY_FOR_EXPLICIT_MERGE_APPROVAL**.

## Docs layout

- Domain glossary: this file (`CONTEXT.md`)
- ADRs: `docs/adr/`
- Agent skill config: `docs/agents/`
- Product docs: `docs/`

## Hard constraints (always)

- No direct push/merge to `main` without explicit human approval.
- No production deploy/migration/restart from agent workflows.
- Do not edit `backend/app/schemas/service.py` or `alembic/*` without explicit human approval.
- Base every task worktree on current `origin/main`.
