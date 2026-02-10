---
name: vikokoro-current-spec
description: Ensure implementation and proposals stay aligned with Vikokoro's latest agreed behavior. Use when starting any feature, refactor, bug fix, UX change, shortcut change, or documentation update in this repository.
---

# Vikokoro Current Spec

Read `docs/CURRENT_SPEC.md` first, then execute work without drifting from it.

## Workflow

1. Read `docs/CURRENT_SPEC.md` before making plans, code changes, or recommendations.
2. Extract constraints relevant to the request (keyboard behavior, mode rules, persistence, themes, search/palette behavior).
3. Implement changes that preserve existing behavior unless the user explicitly requests a spec change.
4. If the request conflicts with `docs/CURRENT_SPEC.md`, ask which should be the new source of truth before implementing.
5. When behavior changes, update `docs/CURRENT_SPEC.md` in the same change set.

## Guardrails

- Do not change key bindings silently. Reflect shortcut changes in help text and docs.
- Keep tree-edit invariants: root deletion protection, subtree-preserving reparent behavior, and undo/redo consistency.
- Treat `docs/CURRENT_SPEC.md` as canonical for current behavior and `docs/milestones/*.md` as historical context.

## Output Checklist

Before finishing a task:
1. Verify implementation matches the current spec or explicitly records a spec change.
2. Verify user-facing docs are updated when shortcuts/themes/behavior changed.
3. Verify build/type-check still pass when code was changed.
