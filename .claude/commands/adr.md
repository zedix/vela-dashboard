---
description: Record an architecture decision (choice / alternatives / why) in docs/decisions.md
argument-hint: <the decision, in a few words>
---

Add a new decision entry to `docs/decisions.md` — the versioned ADR journal (in
English) — for: **$ARGUMENTS**

This encodes the repo's "decide → record" method: significant choices are argued
and written down as they happen, clearly enough to explain to a future
maintainer.

This command only **records** a decision that is already settled, in this repo's
single decision log (`docs/decisions.md`). To _sharpen_ a decision that isn't
settled yet, run the grilling flow (`grill-with-docs`); its native output is
per-file ADRs under `docs/adr/`, but here we keep one journal — fold the outcome
into `docs/decisions.md` via this command.

Steps:

1. **Read the surrounding entries first** so the numbering, tone, and structure
   match the existing journal. Pick the right `## N.` section and the next free
   `### N.M` heading under it.
2. Write the entry in **English**, with these bold labels:
   - **Choice**: what was decided, concretely.
   - **Alternatives**: the options considered and rejected, and their downside.
   - **Why**: the rationale in 2–3 sentences, sayable out loud.
   - _(optional)_ **In one line**: a one-line soundbite.
3. Keep it concise and honest — no padding.

Scope: this command edits **only** `docs/decisions.md`. Do not touch source
code. If the decision is already recorded, update that entry instead of
duplicating it.
