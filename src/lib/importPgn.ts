import { parseGames } from '@mliebelt/pgn-parser'
import type { Tags } from '@mliebelt/pgn-types'
import { db } from '../db'
import type { MistakeRow } from '../db/schema'
import { detectMistakesInGame } from './detectMistakes'
import { stableOfflineGameId } from './gameId'
import { extractLichessGameId, normalizeLichessUsername } from './lichessUrl'

export interface ImportResult {
  gamesSeen: number
  gamesSkippedVariant: number
  gamesSkippedNotYou: number
  gamesSkippedAlreadyImported: number
  gamesImported: number
  mistakesAdded: number
  errors: string[]
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
): Promise<ImportResult> {
  const result: ImportResult = {
    gamesSeen: 0,
    gamesSkippedVariant: 0,
    gamesSkippedNotYou: 0,
    gamesSkippedAlreadyImported: 0,
    gamesImported: 0,
    mistakesAdded: 0,
    errors: [],
  }

  let trees: ReturnType<typeof parseGames>
  try {
    trees = parseGames(pgnText)
  } catch (e) {
    result.errors.push(
      e instanceof Error ? e.message : 'Kunne ikke parse PGN.',
    )
    return result
  }

  const now = Date.now()

  await db.transaction(
    'rw',
    db.importedGames,
    db.mistakes,
    db.mistakeTags,
    async () => {
      for (const tree of trees) {
        result.gamesSeen += 1
        const tags = tree.tags

        if (!isStandardChess(tags)) {
          result.gamesSkippedVariant += 1
          continue
        }

        const myColor = resolveMyColor(tags, username)
        if (!myColor) {
          result.gamesSkippedNotYou += 1
          continue
        }

        const site = getTag(tags, 'Site')
        const gameId =
          extractLichessGameId(site) ??
          stableOfflineGameId(tags, tree.moves.length)

        const existing = await db.importedGames.get(gameId)
        if (existing) {
          result.gamesSkippedAlreadyImported += 1
          continue
        }

        const gameUrl = gameUrlFromTags(tags)

        let detected
        try {
          detected = detectMistakesInGame(
            tree.moves,
            myColor,
            thresholdPawns,
          )
        } catch (e) {
          result.errors.push(
            e instanceof Error ? e.message : String(e),
          )
          continue
        }

        await db.importedGames.put({
          gameId,
          importedAt: now,
        })
        result.gamesImported += 1

        for (const d of detected) {
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
      }
    },
  )

  return result
}
