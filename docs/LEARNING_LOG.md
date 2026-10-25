# Learning log

One entry per phase. Each entry says what was built, names the key idea, and points at the three to six commits whose messages teach it best. Read a commit with `git show <hash>` and start with its LEARN section; the WHY, WHAT, and TEST sections tell you what changed and how it was proven.

## Phase 0: what a healthy repo skeleton looks like

Built: a public repo under spaced-lab, a Vite + React + TypeScript frontend with a theme and two test layers, a FastAPI backend with a health probe, a shared folder both sides read, CI running both gates, GitHub Pages deploying the frontend on every push, and Docker images with compose.

Key idea: gates before features. Every later commit in this repo runs `npm run check` or `make check` (or both) before it lands, and CI repeats them on GitHub. That only works if the gates exist before the first feature does, so Phase 0 builds nothing musical and everything mechanical. A skeleton that already lints, tests, builds, deploys, and containerizes means a feature commit is only ever about the feature.

Read these commits:

- `a9431fd` feat(frontend): the toolchain, the theme as CSS custom properties, and the e2e helper that turns "console must be clean" into a failing test.
- `de21236` feat(backend): the app factory, CORS from the environment, and why `.env` is a fallback rather than the source of truth.
- `b44362e` ci: both gates on GitHub, and the `base` path trap that breaks Vite apps on project Pages sites.
- `4299413` chore(shared): one fixture folder read by two languages is a contract, not test data.
