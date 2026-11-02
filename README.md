# Chess Blunder Bank

**Chess Blunder Bank** helps you learn from your own games by importing analysed Lichess PGNs, surfacing big evaluation drops on your moves, and reviewing those positions with notes and tags—then opening deeper analysis on Lichess when you want it.

**Repository:** [github.com/henrikakselsen/chess-blunder-bank](https://github.com/henrikakselsen/chess-blunder-bank)

## Development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

## Lichess import

1. Under **Import**, enter your Lichess username, max games, and blunder threshold.
2. Keep **evals** and **analysed** enabled (required for blunder and mate detection).
3. Click **Fetch and import**. The app calls `https://lichess.org/api/...` from the browser (CORS). In dev, if that fails, it retries via the `/lichess` proxy in `vite.config.ts` (adds the User-Agent Lichess requires).

## Cloud agent workflow

A **cloud agent** can work against the same codebase in a **remote Git** repo (GitHub/GitLab), so your laptop does not need to stay on.

1. Clone or push this repo (see link above).
2. Point your agent at the repo and give it tasks (e.g. follow this README).
3. Run `npm run dev` / `npm run build` locally or in **GitHub Codespaces** / a web IDE to verify.

**Note:** IndexedDB data in the app lives **only in the browser** you use to open the app; it is not synced via Git.

## Stack

- Vite, React, TypeScript  
- chess.js, @mliebelt/pgn-parser  
- Dexie (IndexedDB)  
- react-chessboard  
