# Agent workflow

> Deliverable #2 of the brief — _“the .md files used when working with an
> agent (skills, planning, etc.)”_. This page maps those artifacts and the
> method that ties them together; the artifacts themselves are in the repo.

## The artifacts

- **[`AGENTS.md`](../AGENTS.md)** — the agent's **standing instructions**:
  architecture, hard rules (zoneless, immutability, single RxJS→signals seam),
  UI and language conventions. Written like a production app guide, not an
  exercise script. Vendor-neutral ([agents.md](https://agents.md)); `CLAUDE.md`
  symlinks to it for Claude Code.
- **[`.agents/skills/`](../.agents/skills/)** — **skills**, specialized
  capabilities loaded by the agent (symlinked into `.claude/skills/`). See the
  list below.
- **[`docs/decisions.md`](decisions.md)** — **planning / decision journal
  (ADR)**: every significant choice with the alternatives considered and the
  why, recorded as the work happened. In English, like the code and this doc.
- **[`.claude/`](../.claude/)** — **agent control center** (committed):
  `settings.json` (a permissions allowlist for the project's safe commands — anyone
  opening the repo gets a frictionless agent), `commands/adr.md` (`/adr` — record
  a decision into `docs/decisions.md`), `agents/vela-reviewer.md` (a project
  reviewer persona that holds a diff to AGENTS.md's hard rules), `launch.json`
  (dev/prod preview servers).
- **`README.md` + `docs/`** — the human-facing documentation (English).

## The method

1. **Conventions before code.** `AGENTS.md` states the architecture and the
   hard rules; agent output is reviewed against it. This is the structural
   answer to the brief's disqualifier — _mass-generated code without
   understanding_: the agent is driven by written conventions, and nothing
   lands without a recorded rationale.
2. **Decide → record → then build.** Significant choices are argued
   (alternatives + trade-offs) and written to `docs/decisions.md` at decision
   time, not reconstructed afterwards. Entries are deliberately phrased to be
   defensible out loud.
3. **Verify before every commit.** `ng build` + `ng test` green, plus the
   behaviour exercised in a real browser — on the dev server **and on the
   production bundle**. A component-library bug that only broke the prod build
   (see the [UI post-mortem](ui.md#why-no-ui-library)) made prod verification
   a hard rule.
4. **Green history.** Atomic commits in dependency order (testable core first,
   UI second, bonus last); the app builds and tests pass at every commit.

## Skills

One skill is **authored for this project**; the rest are imported references
that shaped the result:

- **`vela-verify`** (project) — the repo's own verify workflow: green build +
  tests + Prettier, then exercise the change on the **prod** bundle in the
  browser (the Luxen bug was prod-only).
- **`angular-developer`** — Angular v22 reference (signals, DI, routing, a11y,
  styling); the framework guardrails throughout.
- **`vitest`** — test authoring and configuration.
- **`grill-with-docs`** ([aihero.dev](https://www.aihero.dev/grill-with-docs)) —
  adversarial interrogation of a plan/design that produces ADRs as it goes; feeds
  the decision journal. It drives the `/grilling` + `/domain-modeling` commands from
  the aihero plugin (not vendored here).
- **`frontend-design`, `emil-design-eng`** — direction for the hand-made design
  system (tokens, primitives, polish).
- **`improve-animations`** — review of the drawer in/out animation
  (`@starting-style`, `allow-discrete`).
