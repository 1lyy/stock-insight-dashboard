import { describe, expect, it } from 'vitest'
import { MARKET_TIMEZONE } from '../../src/domain/datePolicy'
import { LocalMockDataProvider } from '../../src/infrastructure/LocalMockDataProvider'
import { MetricEngine } from '../../src/services/metricEngine'
import { dashboardSchemaV1 } from '../../src/domain/schema/dashboardSchema'
import demo004 from '../fixtures/schemas/demo-004.json'

const provider = new LocalMockDataProvider()
const engine = new MetricEngine()

function getSeries() {
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
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

describe('MetricEngine', () => {
  it('calculates changePct using the preceding trading day for the first displayed point', () => {
    const source = getSeries()
    const derived = engine.derive(source)
    const first = derived[0]
    if (!first || !source.previousBar) throw new Error('Expected fixture context')

    const expected = Number((((first.close - source.previousBar.close) / source.previousBar.close) * 100).toFixed(4))

    expect(first.changePct).toBe(expected)
    expect(derived).toHaveLength(source.bars.length)
  })

  it.each([
    ['changePct', 'topN'],
    ['changePct', 'bottomN'],
    ['volume', 'topN'],
    ['volume', 'bottomN'],
  ] as const)('returns deterministic %s %s extrema', (metricId, kind) => {
    const derived = engine.derive(getSeries())
    const result = engine.findExtrema(derived, metricId, kind, 3)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(3)
      expect(new Set(result.value.map((point) => point.date)).size).toBe(3)
      const values = result.value.map((point) => point.value)
      const expected = [...values].sort((left, right) => kind === 'topN' ? right - left : left - right)
      expect(values).toEqual(expected)
    }
  })

  it('adds a notice when an annotation asks for more points than are valid', () => {
    const derived = engine.derive(getSeries()).slice(0, 2)
    const schema = dashboardSchemaV1.parse(demo004)
    const result = engine.analyzeAnnotations(schema, derived)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value[0]?.points).toHaveLength(2)
      expect(result.value[0]?.notice).toContain('只有 2 个有效数据点')
    }
  })
})
