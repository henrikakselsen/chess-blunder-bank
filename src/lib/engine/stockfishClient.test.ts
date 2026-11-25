import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** A fake Stockfish worker. It answers the handshake and records every command. */
class FakeWorker {
  static last: FakeWorker | null = null
  sent: string[] = []
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: ((e: { message: string }) => void) | null = null

  constructor() {
    FakeWorker.last = this
  }

  postMessage(cmd: string) {
    this.sent.push(cmd)
    if (cmd === 'uci') queueMicrotask(() => this.emit('uciok'))
    if (cmd === 'isready') queueMicrotask(() => this.emit('readyok'))
  }

  emit(line: string) {
    this.onmessage?.({ data: line })
  }

  terminate() {}
}

/** White to move after 3...Nf6?? (Qxf7# is mate). */
const FEN_A = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'
/** White to move after 3...g6. */
const FEN_B = 'r1bqkbnr/pppp1p1p/2n3p1/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4'

async function loadClient() {
  vi.resetModules()
  return import('./stockfishClient')
}

function worker(): FakeWorker {
  if (!FakeWorker.last) throw new Error('No worker was created')
  return FakeWorker.last
}

async function waitForCommand(cmd: string) {
  await vi.waitFor(() => expect(worker().sent).toContain(cmd))
}

beforeEach(() => {
  FakeWorker.last = null
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('window', { location: { origin: 'http://localhost' } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('analyzeFen', () => {
  it('returns all MultiPV lines sorted by rank', async () => {
    const client = await loadClient()
    const result = client.analyzeFen(FEN_A, 100, 3)
    await waitForCommand('go movetime 100')

    expect(worker().sent).toContain('setoption name MultiPV value 3')
    worker().emit('info depth 20 multipv 2 score cp -240 pv h5g5 f6e4')
    worker().emit('info depth 20 multipv 1 score mate 1 pv h5f7')
    worker().emit('bestmove h5f7')

    const analysis = await result
    expect(analysis.bestMoveUci).toBe('h5f7')
    expect(analysis.lines.map((l) => [l.rank, l.pvUci[0]])).toEqual([
      [1, 'h5f7'],
      [2, 'h5g5'],
    ])
    expect(analysis.whitePovPawns).toBeCloseTo(14.99)
    expect(analysis.lines[1].whitePovPawns).toBe(-2.4)
  })

  it('sends the MultiPV option only when the value changes', async () => {
    const client = await loadClient()
    const first = client.analyzeFen(FEN_A, 100, 3)
    await waitForCommand('go movetime 100')
    worker().emit('bestmove h5f7')
    await first

    const second = client.analyzeFen(FEN_B, 200, 3)
    await waitForCommand('go movetime 200')
    worker().emit('bestmove h5f3')
    await second

    const setOptions = worker().sent.filter((c) => c.startsWith('setoption name MultiPV'))
    expect(setOptions).toEqual(['setoption name MultiPV value 3'])
  })

  it('ignores bound scores', async () => {
    const client = await loadClient()
    const result = client.analyzeFen(FEN_B, 100)
    await waitForCommand('go movetime 100')
    worker().emit('info depth 11 multipv 1 score cp 50 pv h5f3')
    worker().emit('info depth 12 multipv 1 score cp 300 lowerbound pv h5f3')
    worker().emit('bestmove h5f3')

    expect((await result).whitePovPawns).toBe(0.5)
  })

  it('resolves with no best move when the side to move has no legal move', async () => {
    const client = await loadClient()
    const result = client.analyzeFen(FEN_B, 100)
    await waitForCommand('go movetime 100')
    worker().emit('info depth 0 score mate 0')
    worker().emit('bestmove (none)')

    expect((await result).bestMoveUci).toBeNull()
  })

  it('waits for a superseded search to end before it starts the next search', async () => {
    const client = await loadClient()
    const first = client.analyzeFen(FEN_A, 1500, 3)
    await waitForCommand('go movetime 1500')

    const second = client.analyzeFen(FEN_B, 600)
    await expect(first).rejects.toThrow('Search superseded')
    expect(worker().sent).toContain('stop')
    expect(worker().sent).not.toContain(`position fen ${FEN_B}`)

    // The stopped search still sends its own output first.
    worker().emit('info depth 18 multipv 1 score mate 1 pv h5f7')
    worker().emit('bestmove h5f7')
    await waitForCommand('go movetime 600')

    const commands = worker().sent
    expect(commands.indexOf(`position fen ${FEN_B}`)).toBeGreaterThan(commands.indexOf('stop'))
    expect(commands).toContain('setoption name MultiPV value 1')

    worker().emit('info depth 16 multipv 1 score cp -31 pv h5f3')
    worker().emit('bestmove h5f3')

    const analysis = await second
    expect(analysis.bestMoveUci).toBe('h5f3')
    expect(analysis.whitePovPawns).toBe(-0.31)
    expect(analysis.lines).toHaveLength(1)
  })

  it('rejects every search that a later search supersedes while it waits', async () => {
    const client = await loadClient()
    const first = client.analyzeFen(FEN_A, 1500, 3)
    await waitForCommand('go movetime 1500')

    const middle = client.analyzeFen(FEN_A, 600, 3)
    const last = client.analyzeFen(FEN_B, 700)
    await expect(first).rejects.toThrow('Search superseded')

    worker().emit('bestmove h5f7')
    await expect(middle).rejects.toThrow('Search superseded')
    await waitForCommand('go movetime 700')
    expect(worker().sent).not.toContain('go movetime 600')

    worker().emit('info depth 16 multipv 1 score cp 20 pv h5f3')
    worker().emit('bestmove h5f3')
    expect((await last).bestMoveUci).toBe('h5f3')
  })
})
