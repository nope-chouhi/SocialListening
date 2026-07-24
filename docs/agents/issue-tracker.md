# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues on `nope-chouhi/SocialListening`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments`
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Stream labels (Agent Company Loop V2)

In addition to triage roles, issues should carry stream/type labels when applicable:

- `bug`, `feature`, `debt`, `investigation`, `blocked`
- `needs-grilling`, `ready`
- `manual-scan`, `public-experience`, `tooling`

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding / blocking edges

Prefer GitHub native issue dependencies when available (`blocked_by`). Where unavailable, put `Blocked by: #<n>` at the top of the child body and close blockers before claiming dependents.

## Agent Company merge gate

Never merge to `main` without explicit human approval. Stop at `READY_FOR_EXPLICIT_MERGE_APPROVAL`.
