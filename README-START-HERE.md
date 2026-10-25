# RIFF-SPACED plan bundle: how to use these files

You have a folder of markdown files. Claude Code reads them and builds the whole app from them, committing and pushing to your GitHub as it goes, and using the Claude in Chrome extension to look at the running app.

## What is in the bundle

| File | Purpose |
|---|---|
| `README-START-HERE.md` | This file. Setup steps and the one-time permission config. |
| `KICKOFF.md` | The exact prompts to paste into Claude Code to start and to resume. |
| `CLAUDE.md` | Project instructions Claude Code loads automatically every session. Edit the owner variables at the top first. |
| `SPEC.md` | The full technical spec: data formats, music conventions, UI, audio engine, Python analysis, AI layer. |
| `DECISIONS.md` | Every design decision pre-made so the run does not stop to ask. |
| `PLAN.md` | Master plan: phase list, exit gates, how phases chain. |
| `plan/phase-00-bootstrap.md` ... `plan/phase-08-polish.md` | Task-by-task instructions per phase with acceptance criteria, tests, Chrome verification scripts, and commit lists. |

## Setup (about ten minutes, once)

1. **Make an empty folder** on your Mac and copy everything in this bundle into it, keeping the `plan/` subfolder:
   ```
   mkdir -p ~/code/riff-spaced && cd ~/code/riff-spaced
   # copy the bundle contents here
   ```
2. **Edit `CLAUDE.md`**: set `GITHUB_OWNER` to `RidleyDiSiena` or `spaced-lab`. Default is `RidleyDiSiena`.
3. **Check tools are installed**: `node --version` (20 or newer), `python3 --version` (3.12 or newer), `gh auth status` (logged in, with repo scope), `git --version`, `docker --version` (optional, only for Phase 8 compose). `brew install gh uv ffmpeg` covers the rest if missing.
4. **Install the Claude in Chrome extension** (version 1.0.36 or newer), have Chrome running, and be logged into Claude Code with `/login` on your Pro or Max plan. The Chrome integration does not work with an API-key login.
5. **Create `.claude/settings.json`** inside the folder with the contents in the next section. This is the permission allowlist so auto mode runs without prompts for the tools the build needs. Then `mkdir -p .claude && git init` is done by Claude Code in Phase 0, you do not need to.
6. **Set your API key for Phase 7 only** when you get there: `export ANTHROPIC_API_KEY=...` in the shell you run Claude Code from, or put it in `backend/.env` (gitignored). The run will stop and ask when it reaches that phase if it is missing.

## Permission allowlist: `.claude/settings.json`

Create this file in the project folder. Permission *mode* (auto) cannot be set in a project settings file per the Claude Code docs; you pass it on the command line (see KICKOFF.md) or set `"defaultMode": "auto"` in your user-level `~/.claude/settings.json`.

```json
{
  "permissions": {
    "allow": [
      "Read", "Edit", "Write", "Glob", "Grep", "WebSearch",
      "Bash(npm *)", "Bash(npx *)", "Bash(node *)",
      "Bash(git init)", "Bash(git init *)", "Bash(git status)", "Bash(git status *)",
      "Bash(git add *)", "Bash(git commit *)", "Bash(git push)", "Bash(git push *)",
      "Bash(git pull *)", "Bash(git fetch *)", "Bash(git log)", "Bash(git log *)",
      "Bash(git diff)", "Bash(git diff *)", "Bash(git show *)", "Bash(git tag *)",
      "Bash(git branch *)", "Bash(git checkout *)", "Bash(git switch *)",
      "Bash(git remote *)", "Bash(git rev-parse *)", "Bash(git config *)", "Bash(git stash *)",
      "Bash(gh auth status)", "Bash(gh auth status *)", "Bash(gh repo create *)",
      "Bash(gh repo view *)", "Bash(gh repo edit *)", "Bash(gh api *)", "Bash(gh run *)",
      "Bash(gh workflow *)", "Bash(gh pr *)", "Bash(gh issue *)",
      "Bash(python *)", "Bash(python3 *)", "Bash(pip *)", "Bash(pip3 *)", "Bash(uv *)",
      "Bash(pytest)", "Bash(pytest *)", "Bash(ruff *)", "Bash(uvicorn *)", "Bash(make *)",
      "Bash(docker *)",
      "Bash(mkdir *)", "Bash(ls)", "Bash(ls *)", "Bash(cat *)", "Bash(head *)", "Bash(tail *)",
      "Bash(wc *)", "Bash(touch *)", "Bash(cp *)", "Bash(mv *)",
      "Bash(rm -rf node_modules)", "Bash(rm -rf node_modules *)", "Bash(rm -rf dist)",
      "Bash(rm -rf dist *)", "Bash(rm -rf .venv)", "Bash(rm -f *)",
      "Bash(curl *)", "Bash(ffmpeg *)", "Bash(ffprobe *)", "Bash(which *)", "Bash(echo *)",
      "Bash(pwd)", "Bash(sleep *)", "Bash(kill *)", "Bash(lsof *)", "Bash(claude --version)",
      "WebFetch(domain:platform.claude.com)", "WebFetch(domain:docs.claude.com)",
      "WebFetch(domain:code.claude.com)", "WebFetch(domain:developer.mozilla.org)",
      "WebFetch(domain:vite.dev)", "WebFetch(domain:vitejs.dev)", "WebFetch(domain:playwright.dev)",
      "WebFetch(domain:fastapi.tiangolo.com)", "WebFetch(domain:docs.scipy.org)",
      "WebFetch(domain:numpy.org)", "WebFetch(domain:www.w3.org)",
      "mcp__claude-in-chrome"
    ],
    "deny": [
      "Bash(git push --force *)", "Bash(git push -f *)", "Bash(git push --force-with-lease *)",
      "Bash(git reset --hard *)", "Bash(git clean -fdx *)", "Bash(git filter-branch *)",
      "Bash(rm -rf /)", "Bash(rm -rf / *)", "Bash(rm -rf ~)", "Bash(rm -rf ~ *)",
      "Bash(rm -rf backend/audio_in *)", "Bash(sudo *)",
      "Read(./.env)", "Read(./**/.env)", "Read(./**/.env.*)"
    ]
  }
}
```

Notes from the Claude Code docs (checked 2026-10-24): deny rules are evaluated before allow rules; `Bash(git push *)` does not match `git -C . push`; allow rules in a committed project settings file only apply after you trust the folder, which Claude Code asks on first launch.

## Start the run

See `KICKOFF.md`. Short version:

```
cd ~/code/riff-spaced
claude --permission-mode auto --chrome
```

Then paste the kickoff prompt from `KICKOFF.md`.

## While it runs

- `STATUS.md` in the repo is the handoff document. Read it to see where things are, what is next, and anything waiting on you.
- The run stops only for: your Anthropic API key (Phase 7), your real guitar recordings (one task in Phase 6), GitHub auth failures, or anything destructive. Everything else is decided in `DECISIONS.md`.
- Every task is one commit with WHY / WHAT / LEARN / TEST sections. `git log` is the tutorial.
- Screenshots of each phase land in `docs/screenshots/`.
- Tags `v0.0.0` through `v0.8.0` are the save points.

## Resume after a break

```
cd ~/code/riff-spaced
claude -c --permission-mode auto --chrome
```

Then paste the resume prompt from `KICKOFF.md`.
