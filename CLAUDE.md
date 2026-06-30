# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

Open `index.html` directly in a browser — no build step, no server needed. All dependencies (`jquery.min.js`, `chart.min.js`) are vendored locally for offline use.

## Architecture

Single-page app with no framework or bundler. Three source files:

- **`index.html`** — two views in one file: `#welcome` (settings form + score chart) and `#game` (timer, problem, answer input). JS toggles `display` between them.
- **`app.css`** — styles copied from arithmetic.zetamac.com, plus `#history` chart section additions.
- **`app.js`** — all logic. Key sections:
  - `seedHistory` / `loadHistory` / `saveScore` — localStorage persistence under key `zetamac_history` (array of `{ts, score, duration}`). `zetamac_seeded` flag prevents re-seeding.
  - `renderHistory` — groups entries by local date, averages scores per day, renders a Chart.js line chart. Destroys the previous `scoreChart` instance before recreating to avoid canvas reuse errors.
  - `initGame(options)` — main game loop. Generates problems (`pg_add`, `pg_sub`, `pg_mul`, `pg_div`), checks answers on `input` event, runs a `setInterval` countdown. Only calls `saveScore` when the timer reaches zero (completed games only).
  - Subtraction is addition in reverse (answer is always positive). Division is multiplication in reverse (answer is always a whole number).
  - Cmd+R / Ctrl+R while `#game` is visible restarts the game without a page reload.

## Git workflow

After completing every task, commit and push to GitHub:

```bash
git add -A
git commit -m "your message here"
git push
```

Always commit under:
- **Email:** hansel7121@gmail.com
- **Name:** hansel7121

If not already set, run:
```bash
git config user.email "hansel7121@gmail.com"
git config user.name "hansel7121"
```

## Key behaviors to preserve

- `saveScore` is intentionally only called inside the `d <= 0` branch of the timer — never on mid-game restarts.
- `scoreChart.destroy()` must be called before re-rendering the chart or Chart.js will throw a canvas-in-use error.
- The answer input uses an `input` event (not `keydown`) to support mobile and paste detection.
