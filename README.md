# Sjakkfeil

Lokal webapp som importerer **analyserte** Lichess-partier (PGN med `evals=true`), finner egne trekk med stort eval-fall, og lar deg gjennomgå posisjoner med notater og tagger. Analyse åpnes på Lichess.

## Utvikling

```bash
npm install
npm run dev
```

Bygg:

```bash
npm run build
npm run preview
```

## Lichess-import

1. Under **Innstillinger**: fyll inn Lichess-brukernavn og terskel (bønder).
2. Under **Import**: bruk en URL som inkluderer `evals=true` og `analysed=true`, f.eks.  
   `https://lichess.org/api/games/user/BRUKERNAVN?tags=true&evals=true&analysed=true&clocks=false&opening=false&max=50`
3. Hvis nettleseren ikke får hentet PGN direkte (CORS), bruk proxy i dev: erstatt `https://lichess.org` med `/lichess` (Vite-proxy er satt opp i `vite.config.ts`).

## Utvikling med cloud agent (lukket maskin)

En **cloud agent** (f.eks. Cursor Cloud Agent, eller agent i en nettbasert IDE) kan jobbe mot **samme kodebase** som ligger i et **fjernrepo** (GitHub/GitLab). Slik kan du lukke PC-en mens agenten committer, åpner PR eller pushet til en branch.

1. Opprett et **privat repo** og push denne mappen (`git init`, `git remote add`, `git push`).
2. Koble repoet til agent-tjenesten du bruker og gi den instruks (f.eks. «følg README og plan for Sjakkfeil»).
3. Kjør **lokal** `npm run dev` / `npm run build` når du vil verifisere — eller bruk **GitHub Codespaces** / **Cursor web** slik at `npm run dev` også kjører i skyen.

**Merk:** IndexedDB-data i appen ligger **kun i nettleseren** på den maskinen du bruker til å åpne appen; det er ikke synkronisert via Git.

## Teknologi

- Vite, React, TypeScript  
- chess.js, @mliebelt/pgn-parser  
- Dexie (IndexedDB)  
- react-chessboard  
