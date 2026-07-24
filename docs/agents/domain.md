# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root (single-context layout).
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.
- Agent Company policy (outside this repo): `D:/desktop_file/agent-company/configs/AGENT_COMPANY_POLICY.md` for orchestration safety gates.

If any of these files don't exist, **proceed silently** only for optional ADRs. `CONTEXT.md` is required for Loop V2 work once seeded.

## File structure

Single-context repo:

```
/
├── CONTEXT.md
├── docs/
│   ├── adr/
│   └── agents/
│       ├── issue-tracker.md
│       ├── triage-labels.md
│       └── domain.md
└── ...
```

Docs location for product documentation: `docs/`.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.
