/**
 * Parse one or more PGN games, skip non-standard variants and already-imported Lichess games,
 * persist blunders and missed mates for the configured user in one pass.
 */
import { parseGames } from '@mliebelt/pgn-parser'
import type { Tags } from '@mliebelt/pgn-types'
import { db } from '../db'
import type { MistakeRow, MissedMateRow } from '../db/schema'
import { detectMistakesInGame } from './detectMistakes'
import { detectMissedMatesInGame } from './detectMissedMates'
import { captureException } from './errorLog'
import { stableOfflineGameId } from './gameId'
import { extractLichessGameId, normalizeLichessUsername } from './lichessUrl'
import { splitPgnGames } from './splitPgn'

export interface ImportResult {
  gamesSeen: number
  gamesSkippedVariant: number
  gamesSkippedNotYou: number
  gamesSkippedAlreadyImported: number
  gamesImported: number
  mistakesAdded: number
  matesAdded: number
  gamesFailed: number
  parseFailed: boolean
}

export type ImportProgressPhase = 'parse' | 'process'

export interface ImportProgress {
  phase: ImportProgressPhase
  current: number
  total: number
}

export interface ImportPgnOptions {
  onProgress?: (progress: ImportProgress) => void
}

async function yieldToUi(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

function getTag(tags: Tags | undefined, key: string): string | undefined {
  if (!tags) return undefined
  const v = (tags as Record<string, unknown>)[key]
  return typeof v === 'string' ? v : undefined
}

function isStandardChess(tags: Tags | undefined): boolean {
  const v = getTag(tags, 'Variant')
  if (!v || v === '' || v === 'Standard') return true
  return false
}

function resolveMyColor(
  tags: Tags | undefined,
  username: string,
): 'white' | 'black' | null {
  const w = getTag(tags, 'White')
  const b = getTag(tags, 'Black')
  const u = normalizeLichessUsername(username)
  if (w && normalizeLichessUsername(w) === u) return 'white'
  if (b && normalizeLichessUsername(b) === u) return 'black'
  return null
}

function gameUrlFromTags(tags: Tags | undefined): string {
  const site = getTag(tags, 'Site')
  if (site?.includes('lichess.org')) {
    const id = extractLichessGameId(site)
    if (id) return `https://lichess.org/${id}`
    return site
  }
  return ''
}

export async function importPgnText(
  pgnText: string,
  username: string,
  thresholdPawns: number,
  options?: ImportPgnOptions,
): Promise<ImportResult> {
  const onProgress = options?.onProgress
  const result: ImportResult = {
    gamesSeen: 0,
    gamesSkippedVariant: 0,
    gamesSkippedNotYou: 0,
    gamesSkippedAlreadyImported: 0,
    gamesImported: 0,
    mistakesAdded: 0,
    matesAdded: 0,
    gamesFailed: 0,
    parseFailed: false,
  }

  let trees: ReturnType<typeof parseGames>
  try {
    onProgress?.({ phase: 'parse', current: 0, total: 1 })
    trees = parseGames(pgnText)
    onProgress?.({ phase: 'parse', current: 1, total: 1 })
    await yieldToUi()
  } catch (e) {
    result.parseFailed = true
    captureException('import.parse', e)
    return result
  }

  const now = Date.now()

  const gamePgns = splitPgnGames(pgnText)
  const totalGames = trees.length

  for (let i = 0; i < trees.length; i++) {
    const tree = trees[i]!
    result.gamesSeen += 1
    const tags = tree.tags
    const gamePgn = gamePgns.length === trees.length ? gamePgns[i] : undefined

    onProgress?.({ phase: 'process', current: i, total: totalGames })

    if (!isStandardChess(tags)) {
      result.gamesSkippedVariant += 1
      await yieldToUi()
      continue
    }

    const myColor = resolveMyColor(tags, username)
    if (!myColor) {
      result.gamesSkippedNotYou += 1
      await yieldToUi()
      continue
    }

    const site = getTag(tags, 'Site')
    const gameId =
      extractLichessGameId(site) ??
      stableOfflineGameId(tags, tree.moves.length)

    const existing = await db.importedGames.get(gameId)
    if (existing) {
      result.gamesSkippedAlreadyImported += 1
      await yieldToUi()
      continue
    }

    const gameUrl = gameUrlFromTags(tags)

    let detectedMistakes
    let detectedMates
    try {
      detectedMistakes = detectMistakesInGame(
        tree.moves,
        myColor,
        thresholdPawns,
      )
      detectedMates = detectMissedMatesInGame(tree.moves, myColor)
    } catch (e) {
      result.gamesFailed += 1
      captureException('import.game', e, {
        gameId,
        extra: {
          myColor,
          moves: tree.moves.length,
          white: getTag(tags, 'White'),
          black: getTag(tags, 'Black'),
        },
      })
      await yieldToUi()
      continue
    }

    await db.transaction(
      'rw',
      db.importedGames,
      db.mistakes,
      db.missedMates,
      async () => {
        await db.importedGames.put({
          gameId,
          importedAt: now,
          pgn: gamePgn,
        })

        for (const d of detectedMistakes) {
          const row: MistakeRow = {
            gameId,
            fenBefore: d.fenBefore,
            moveSan: d.moveSan,
            evalBefore: d.evalBefore,
            evalAfter: d.evalAfter,
            ply: d.ply,
            gameUrl,
            comment: '',
            reviewed: false,
            createdAt: now,
          }
          await db.mistakes.add(row)
          result.mistakesAdded += 1
        }

        for (const d of detectedMates) {
          const row: MissedMateRow = {
            gameId,
            fenBefore: d.fenBefore,
            mateIn: d.mateIn,
            myColor: d.myColor,
            movePlayedSan: d.movePlayedSan,
            solutionLines: d.solutionLines,
            ply: d.ply,
            gameUrl,
            reviewed: false,
            createdAt: now,
          }
          await db.missedMates.add(row)
          result.matesAdded += 1
        }
      },
    )

    result.gamesImported += 1
    onProgress?.({ phase: 'process', current: i + 1, total: totalGames })
    await yieldToUi()
  }

  return result
}
