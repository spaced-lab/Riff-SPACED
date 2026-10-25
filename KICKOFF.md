# KICKOFF.md: prompts to paste into Claude Code

## Start command

```
cd ~/code/riff-spaced
claude --permission-mode auto --chrome
```

If your Claude Code version does not accept `auto` as a starting mode (needs 2.1.283 or newer), use `claude --permission-mode acceptEdits --chrome` and approve the first few Bash prompts, or run `claude --dangerously-skip-permissions --chrome` inside this folder only.

## Kickoff prompt (paste as the first message)

```
You are starting the RIFF-SPACED build. This folder contains CLAUDE.md, SPEC.md, DECISIONS.md, PLAN.md and plan/phase-00 through phase-08. Nothing else exists yet.

Read, in this order: CLAUDE.md, DECISIONS.md, SPEC.md (all of it), PLAN.md, then plan/phase-00-bootstrap.md.

Then execute the phases in order, task by task, exactly as the phase files describe, without stopping between tasks or phases. Decisions are already made in DECISIONS.md. Pause only at a HARD STOP condition listed in CLAUDE.md, and when you do, write the question into STATUS.md, commit, push, and tell me what you need.

Every task ends with: quality gates green, a commit in the required WHY/WHAT/LEARN/TEST format, a push, and an updated STATUS.md. Every phase ends with its exit gate, an annotated tag, a docs/LEARNING_LOG.md entry, and a /compact.

For every UI task: run the Playwright e2e suite, then open http://localhost:5173 with the Claude in Chrome tools, follow the phase file's Chrome verification script, screenshot it, read the console, and record the result in the commit TEST line. Keep `npm run dev` running in the background while you work on a phase.

Preflight first: record `claude --version`, `node --version`, `python3 --version`, `gh auth status`, and whether the Chrome tools are available, into STATUS.md. Then begin Phase 0.

Work until Phase 8's exit gate passes or a HARD STOP applies. Do not ask me to confirm anything that DECISIONS.md already covers.
```

## Optional: make the goal explicit

After pasting the kickoff prompt, you can also set a goal so Claude Code keeps working until the condition is met:

```
/goal All phases 0 through 8 in plan/ are complete: each phase's exit gate commands pass, the repo is pushed to GitHub with tags v0.0.0 through v0.8.0, and STATUS.md says "All phases complete". Stop early only if STATUS.md contains a "Waiting on owner" section. Stop after 400 turns regardless.
```

## Resume prompt (after a break, a HARD STOP, or a new session)

```
cd ~/code/riff-spaced
claude -c --permission-mode auto --chrome
```

```
Resume the RIFF-SPACED build. Read STATUS.md first, then CLAUDE.md, then the phase file STATUS.md points at. If STATUS.md has a "Waiting on owner" section, here is my answer: <your answer, or "resolved, continue">. Continue from the next incomplete task and keep going under the same rules (commit and push every task, tag every phase, pause only at HARD STOP).
```

## When it stops for your API key (Phase 7)

```
export ANTHROPIC_API_KEY=sk-ant-...
```

Then in Claude Code: `The key is set in the environment. Continue Phase 7.`

## When it stops for your recordings (Phase 6, one task)

Copy some WAV or FLAC files of your riffs into `backend/audio_in/` (gitignored), then: `Recordings are in backend/audio_in. Continue.` If you want to skip real-audio testing for now: `Skip the real-audio task, mark it deferred in docs/BACKLOG.md, continue.`

## Useful one-liners for you while it runs

- `cat STATUS.md` to see where it is.
- `git log --oneline | head -30` to see the save points.
- `cd frontend && npm run dev` to open the app yourself at http://localhost:5173.
- `cd backend && uvicorn riffspaced.api:app --reload` to run the analysis service yourself.
- `open docs/screenshots` to flip through what each phase looked like.
