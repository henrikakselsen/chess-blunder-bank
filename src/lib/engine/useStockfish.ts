import { useEffect, useState } from 'react'
import { ensureWorker } from './stockfishClient'

export type StockfishLoadState = 'loading' | 'ready' | 'error'

export function useStockfish(): StockfishLoadState {
  const [state, setState] = useState<StockfishLoadState>('loading')

  useEffect(() => {
    let cancelled = false
    ensureWorker()
      .then(() => {
        if (!cancelled) setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
