# Weekly Goals Tracker

A small, dependency-free web app for setting each week's major goals, rating your progress on them every day, and looking back at previous weeks.

**Live site:** https://lepanda0.github.io/weekly-goals-tracker/

## Features

- **Weekly goals** – add, rename, reorder, mark achieved, or delete the week's major goals.
- **Daily ratings** – rate each goal 1–5 for every day of the week, with an optional note per day.
- **Daily notes & weekly reflection** – a journal line for each day plus a reflection for the week.
- **History** – every previous week with its average rating, goals achieved, and a per-day heatmap; click a week to open and edit it.
- **Carry over** – copy unfinished goals from the previous week in one click.
- **Backup** – export/import all data as JSON.
- Light and dark mode, works on mobile.

## Data

Everything is stored in your browser's `localStorage`; nothing is sent to a server. Data is per browser/device, so use **Export** to back up or move it.

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```
