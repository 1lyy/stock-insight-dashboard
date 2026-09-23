import { describe, expect, it } from 'vitest'
import { MARKET_TIMEZONE } from '../../src/domain/datePolicy'
import { LocalMockDataProvider } from '../../src/infrastructure/LocalMockDataProvider'

const provider = new LocalMockDataProvider()

describe('LocalMockDataProvider', () => {
  it('queries the last N trading days and keeps one prior bar as calculation context', () => {
    const result = provider.query({
      symbol: 'MOCK-A',
      timeRange: {
        mode: 'lastTradingDays',
        start: '2025-03-18',
        end: '2025-03-31',
        tradingDays: 10,
        timezone: MARKET_TIMEZONE,
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.bars).toHaveLength(10)
      expect(result.value.actualRange).toEqual({ start: '2025-03-18', end: '2025-03-31', tradingDays: 10 })
      expect(result.value.previousBar?.date).toBe('2025-03-17')
      expect(result.value.bars.some((bar) => bar.date === result.value.previousBar?.date)).toBe(false)
      expect(result.value.source).toMatchObject({
        type: 'mock',
        name: 'Built-in Mock Market Data',
        datasetVersion: '1.0.0',
      })
    }
  })

  it('queries a closed explicit range without synthesizing weekend records', () => {
    const result = provider.query({
      symbol: 'MOCK-B',
      timeRange: {
        mode: 'dateRange',
        start: '2025-03-08',
        end: '2025-03-10',
        timezone: MARKET_TIMEZONE,
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.bars.map((bar) => bar.date)).toEqual(['2025-03-10'])
      expect(result.value.previousBar?.date).toBe('2025-03-07')
    }
  })

  it('rejects an inconsistent last-N Schema instead of silently changing it', () => {
    const result = provider.query({
      symbol: 'MOCK-C',
      timeRange: {
        mode: 'lastTradingDays',
        start: '2025-03-17',
        end: '2025-03-31',
        tradingDays: 10,
        timezone: MARKET_TIMEZONE,
      },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_RANGE')
  })

  it('returns NO_DATA for a date range with no overlap', () => {
    const result = provider.query({
      symbol: 'MOCK-A',
      timeRange: {
        mode: 'dateRange',
        start: '2026-01-01',
        end: '2026-01-31',
        timezone: MARKET_TIMEZONE,
      },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NO_DATA')
  })

  it('reports a non-blocking notice when a recent range ends on a non-trading day', () => {
    const result = provider.query({
      symbol: 'MOCK-A',
      timeRange: {
        mode: 'lastTradingDays',
        start: '2025-03-27',
        end: '2025-03-30',
        tradingDays: 2,
        timezone: MARKET_TIMEZONE,
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.actualRange.end).toBe('2025-03-28')
      expect(result.value.notices[0]?.code).toBe('RANGE_CLIPPED')
    }
  })
})
