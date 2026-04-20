---
globs: shaders/**/*.effect
---

# Shader Rules

- Target performance: >= 30fps on low-end mobile (no complex branching in fragment shaders)
- All tunable parameters exposed as uniforms, configured via JSON or Cocos material properties
- Include fallback path for devices without required GL extensions
- Comment the visual intent at the top of each shader file (what it looks like, not how it works)
- Name convention: `fx_[visual-effect].effect` (e.g., `fx_starfield-glow.effect`)
