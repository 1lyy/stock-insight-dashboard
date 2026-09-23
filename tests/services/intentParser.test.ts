import { describe, expect, it } from 'vitest'
import { IntentParser } from '../../src/services/intentParser'
import { EXAMPLE_FIXTURES } from '../fixtures/queries'

const parser = new IntentParser()

describe('IntentParser', () => {
  it.each(EXAMPLE_FIXTURES)('turns $id into its frozen DashboardSchema fixture', ({ query, expectedSchema }) => {
    const result = parser.parse(query)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual(expectedSchema)
  })

  it('normalizes supported stock and metric synonyms', () => {
    const result = parser.parse('分析 mock-a 最近 10 天的价格和交易量', { requestId: 'demo-101' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.stock).toEqual({ symbol: 'MOCK-A', name: 'A 公司' })
      expect(result.value.metrics.map((metric) => metric.id)).toEqual(['close', 'volume'])
      expect(result.value.timeRange).toMatchObject({ mode: 'lastTradingDays', tradingDays: 10 })
    }
  })

  it.each([
    ['', 'EMPTY_QUERY'],
    ['分析 D 公司最近 10 天的股价', 'UNKNOWN_STOCK'],
    ['分析 A 公司最近 10 天的市盈率', 'UNKNOWN_METRIC'],
    ['分析 A 公司最近 1 天的股价', 'INVALID_RANGE'],
    ['分析 A 公司最近 10 天的股价和市盈率', 'UNKNOWN_METRIC'],
    ['用折线图和柱状图分析 A 公司最近 10 天的股价', 'AMBIGUOUS_QUERY'],
    ['分析 A 公司最近 10 天和最近 20 天的股价', 'AMBIGUOUS_QUERY'],
  ])('returns an explainable error for invalid query: %s', (query, expectedCode) => {
    const result = parser.parse(query)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe(expectedCode)
      expect(result.error.message.length).toBeGreaterThan(0)
      expect(result.error.suggestion.length).toBeGreaterThan(0)
    }
  })
})
