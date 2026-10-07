# Skill sources

Third-party skills are vendored (copied) here, pinned to a commit, after review on 2026-10-07.
Only Markdown/reference files plus one local-only QA script were taken; no install scripts were run.
To update: re-clone the repo, diff against these folders, review, then copy.

| Skill(s) | Source | Commit | License |
|---|---|---|---|
| r3f-fundamentals, r3f-animation, r3f-lighting, r3f-materials, r3f-shaders, r3f-postprocessing, r3f-geometry, r3f-loaders | https://github.com/EnzeD/r3f-skills | 4a11805 | MIT (stated in README) |
| game-feel, camera-systems, game-ui-ux, audio-design, game-ai, survival-crafting, fps-shooter | https://github.com/gamedev-skills/awesome-gamedev-agent-skills | d4b0e35 | Apache-2.0 |
| threejs-game-ui-designer, threejs-debug-profiler, threejs-qa-release, threejs-aaa-graphics-builder | https://github.com/majidmanzarpour/threejs-game-skills | 8286774 | MIT |
| colyseus, game-testing | Written for this project | — | — |

## Local overrides (also stated in CLAUDE.md)

- gamedev-skills code samples are Godot/Unity: apply the principles, rewrite for Three.js/R3F.
- threejs-aaa-graphics-builder: art direction is **stylized low-poly**, not realism. The sibling
  `threejs-game-director`, `threejs-3d-generator`, `threejs-image-generator` and `threejs-audio-generator`
  skills were intentionally NOT vendored (paid external APIs), so its credential-probe step does not apply:
  asset sourcing is procedural-only.
- threejs-qa-release `scripts/inspect-threejs-canvas.mjs` needs Playwright (not installed yet).

## Reviewed and rejected

- Donchitos/Claude-Code-Game-Studios: 15 auto-run shell hooks plus its own studio workflow; conflicts with our phase gates.
- OpenAEC Three.js-Claude-Skill-Package: targets R3F 8 / React 18 / three r160 (we use R3F 9 / React 19 / r186).
- claudskills.com Colyseus skills: unknown author and Colyseus version; replaced by the `colyseus` skill using official 0.18 docs.
- freshtechbro/claudedesignskills: unmaintained since 2025-11, web-design focus.
