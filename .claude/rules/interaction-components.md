---
globs: scripts/interaction/**/*.ts
---

# Interaction Component Rules

- Components must be reusable across multiple puzzles — no puzzle-specific logic
- Each component handles one interaction type (drag, rotate, slider, toggle, etc.)
- Expose configuration via public properties, not constructor params
- Emit standardized events: `onInteractionStart`, `onInteractionUpdate`, `onInteractionEnd`
- Include touch and mouse support (Cocos Creator unified input)
- Accessibility: provide visual + audio feedback for every interaction state change
