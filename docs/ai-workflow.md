# AI Workflow — liuhui-star-guardian

This document defines the shared execution flow for AI collaborators in this repo.

The goal is simple: make progress depend on files, scope, and evidence instead of chat memory.

---

## 1. Read The Right Inputs

Before substantial work:

1. Read `docs/design/game-design-spec.md`.
2. Read `production/active.md` if it exists.
3. Read only the files needed for the current task.

Do not treat prior chat context as the source of truth if the files say otherwise.

---

## 2. Reframe Before Building

Before changing files, restate the actual problem in a sharper form:

- What is the user asking for on the surface?
- What outcome do they really need?
- What is the smallest useful change that gets them there?

For this repo, a good reframe usually distinguishes between:

- **design work**: changing puzzle behavior, scope, or progression
- **implementation work**: building against an approved design
- **process work**: improving the workflow, templates, or collaboration rules

Example:

- Surface request: "Make the cockpit search puzzle better."
- Better reframe: "Is the problem discoverability, narrative clarity, pacing, or the interaction itself?"

---

## 3. Use The Three-Layer Check

Before deciding on an approach, check three layers:

1. **Existing standard**
   - Is there a known pattern already used in this repo or engine ecosystem?
2. **Current practice**
   - What do people currently do, and why?
3. **First principles**
   - If both of the above are wrong for this project, what follows from the actual constraints here?

The most valuable insight often comes from the disagreement between these layers, not from blindly following one of them.

---

## 4. Decide: Lake Or Ocean

Use this framing before you promise a solution.

### Lake

A **lake** is small enough to solve completely inside one bounded scope.

Examples:

- add a missing validation step for puzzle JSON
- fix one interaction component with clear acceptance criteria
- align one design doc section with the approved spec

When the task is a lake, prefer a complete solution with verification.

### Ocean

An **ocean** is too broad to finish safely in one pass.

Examples:

- redesign the entire puzzle progression system
- rewrite all stage logic and data formats together
- replace the full collaboration workflow across every document at once

When the task is an ocean:

- explicitly narrow scope
- state what is out of scope
- leave a clean next step instead of pretending the whole ocean was boiled

---

## 5. Write The Artifact Chain

`production/active.md` is the cross-session working artifact.

For substantial tasks, update it with:

- current objective
- in-scope work
- out-of-scope work
- important decisions
- blockers or risks
- next recommended step
- verification evidence

Do not scatter key decisions only in chat.

If the task changes product behavior, the long-term source of truth remains `docs/design/game-design-spec.md`.  
`production/active.md` tracks active execution state, not final product truth.

---

## 6. Build With Explicit Scope

Before editing, know which files or directories are in scope.

When debugging or implementing:

- state the intended impact scope
- avoid opportunistic cleanup outside that scope
- only widen scope when the evidence forces it

This keeps bug fixes from turning into accidental refactors.

---

## 7. Review Through Three Lenses

Before calling work done, review it through these lenses:

### Product

- Does this solve the user-facing problem?
- Is it aligned with the approved design?
- Does it preserve the intended player experience?

### Engineering

- Is the change scoped and maintainable?
- Does it fit the repo structure and existing patterns?
- Did we avoid unnecessary coupling and hidden regressions?

### Design

- Is the interaction understandable?
- Is the cognitive action still the one we intended to teach?
- Does this improve clarity rather than just add complexity?

---

## 8. Verify Before Claiming Success

Never claim "fixed" or "done" without evidence.

Use the strongest available verification for the task:

- targeted command or script
- typecheck or test run
- doc consistency check
- manual reproduction steps

If the task deserves automated tests and none exist yet:

- add the smallest useful test scaffold, or
- explain concretely why that could not be done

---

## 9. Stop After Three Failed Attempts

If the same issue has resisted three materially different attempts:

- stop patching
- reassess the root cause
- check whether the problem is architectural, not local
- ask for a decision if the next move has meaningful tradeoffs

Three failed attempts is a signal, not a challenge.

---

## 10. Finish With A Clean Handoff

At the end of substantial work:

1. Update `production/active.md`.
2. Record the decision or outcome in the relevant source-of-truth doc if needed.
3. Leave the next step obvious for the next session.

Good handoff beats perfect memory.
