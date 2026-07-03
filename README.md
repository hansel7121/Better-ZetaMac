# Better ZetaMac

A local, offline replica of the [Arithmetic Game by ZetaMac](https://arithmetic.zetamac.com/) — with score tracking, detailed post-game analytics, and a weakness finder that lets you drill into exactly the problem types slowing you down. All credit for the original game concept, design, and mechanics goes to ZetaMac.

---

## Getting started

1. Download or clone this repository.
2. Open the `zetamac` folder.
3. Double-click **`index.html`** to open it in your browser.

That's it — no installation, no build step, no server, and no internet connection required. Everything (including the jQuery and Chart.js libraries) is bundled locally, and your data is stored privately in your own browser.

---

## The quick version

1. Pick your operations, ranges, and time on the start screen.
2. Hit **Start** and answer as many problems as you can before the clock hits zero.
3. Review your results, then use the charts to see where you're slow.
4. Click into a weak spot to launch **targeted practice** on just those problems.

---

## Playing a round

On the **start screen** you set up your game:

- **Operations** — turn on any mix of **Addition**, **Subtraction**, **Multiplication**, and **Division**.
- **Number ranges** — customize the range of numbers used for addition and multiplication (subtraction and division are generated as the reverse of these, so answers are always positive whole numbers).
- **Duration** — 30s / 60s / 120s / 300s / 600s (default: 120s).

Then press **Start**. During the game:

- Just **type your answer** — it's accepted the moment it's correct, no Enter needed. This also works for pasting and on mobile.
- The **score** and **seconds left** update live at the top.
- **Cmd+R** (Mac) or **Ctrl+R** (Windows/Linux) instantly restarts the round with the same settings — no trip back to the start screen.

Only games that run all the way to zero count toward your saved history. Restarting mid-round doesn't record a score.

---

## After each game

When the timer ends, you get a full breakdown of the round:

- **Final score** — how many you solved.
- **Speed chart** — a bar per question showing how long each one took, in order, so you can spot where you stalled.
- **Questions table** — every problem you solved, sorted slowest-first, with the exact time it took. Great for finding the specific facts that trip you up.

From here you can **Try again** (same settings) or **Change settings** to head back to the start screen.

---

## Tracking your progress

Back on the start screen, below the settings, you'll find your long-term stats:

- **Score history chart** — a line chart of your **daily average score** over time, so you can watch yourself improve. Multiple games on the same day are averaged together.
- **Clear history** — wipes all saved data if you want a fresh start.

Your history lives in your browser's local storage, so it persists between sessions on the same browser and device.

---

## Finding and fixing your weak spots

This is where Better ZetaMac goes beyond the original. Below the score chart is a **weakness analysis** section built from every problem you've ever solved:

1. **Operation breakdown (pie chart)** — shows how your total solving time is split across addition, subtraction, multiplication, and division. **Click a slice** to drill in.

2. **Drill-down analysis** — for the operation you clicked, you get three bar charts of your average time:
   - **By number range** — are big numbers slowing you down?
   - **By operand value** — e.g. which times-tables (×2 … ×12) or number bands are your slowest.
   - **By answer size** — do larger answers take you longer?

3. **Targeted practice** — **click any bar in the "by operand value" chart** to instantly launch a focused practice session on just that slice (for example, only ×7 multiplication, or only additions with a large first number).

Targeted-practice sessions are marked with a banner and are **not saved to your history** — they're for drilling, so they won't skew your real score chart.

---

## Tips

- Start with a short duration and one operation to warm up, then expand.
- After a round, read the **questions table** top-to-bottom — the slowest few facts are your best practice targets.
- Use the **weakness analysis → targeted practice** loop repeatedly on one weak slice until it stops showing up as slow.

---

## Credits

Original game: [arithmetic.zetamac.com](https://arithmetic.zetamac.com/) by ZetaMac.
This project is an unofficial offline replica for personal use.
