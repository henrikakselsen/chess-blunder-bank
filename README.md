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

Tests (Vitest, engine logic only):

```bash
npm test
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

The browser stores the data per origin (protocol, host and port). For this reason, `npm run dev` and `npm run preview` always use http://localhost:5173/. If the port is in use, Vite stops with an error. Stop the other server (for example from another worktree) and start again. Do not change the port, because then the app opens with an empty database.

## Review engine

Review uses **Stockfish 19 (lite, WASM)** in a Web Worker. On first visit to Review, the browser downloads about 1.8 MB from `/stockfish/`. `npm install` copies the engine into `public/stockfish/` via `postinstall`.

Play a move on the board: the app compares your line to the engine (movetime ~450 ms per search) and labels it best / good / inaccuracy / mistake / blunder using the same **blunder threshold** as on the Import page.

## Stack

- Vite, React, TypeScript  
- chess.js, @mliebelt/pgn-parser  
- Dexie (IndexedDB)  
- react-chessboard  
- stockfish (WASM, GPLv3 — see `node_modules/stockfish/Copying.txt`)  
