---
globs: scripts/levels/**/*.ts
---

# Puzzle Script Rules

- ALL gameplay values (timing, scores, thresholds, counts) MUST come from JSON configs in `resources/configs/` — never hardcode
- Use `dt` (delta time) for all time-dependent logic — frame-rate independence is mandatory
- Each puzzle must implement the `IPuzzle` interface (init, update, checkWin, reset)
- State transitions use explicit state machine pattern (IDLE → ACTIVE → COMPLETED / FAILED)
- No direct UI manipulation — emit events, let UI layer subscribe
- Each puzzle script file should stay under 300 lines; extract helpers if needed
