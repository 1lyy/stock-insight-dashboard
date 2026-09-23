import { describe, expect, it } from 'vitest'
import { dashboardSchemaV1 } from '../../src/domain/schema/dashboardSchema'
import { FollowUpParser } from '../../src/services/followUpParser'
import { EXAMPLE_FIXTURES } from '../fixtures/queries'

const parser = new FollowUpParser()

function schemaAt(index: number) {
  const fixture = EXAMPLE_FIXTURES[index]
  if (!fixture) throw new Error(`Missing fixture ${index}`)
  return dashboardSchemaV1.parse(fixture.expectedSchema)
}

describe('FollowUpParser', () => {
  it('replaces the volume chart with changePct and keeps auxiliary annotations valid', () => {
    const previous = schemaAt(0)
    const result = parser.parse('把成交量改成涨跌幅', previous)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.requestId).not.toBe(previous.requestId)
    expect(result.value.metrics.map((metric) => metric.id)).toEqual(['close', 'changePct'])
    expect(result.value.charts.map((chart) => ({ id: chart.id, type: chart.type, metrics: chart.metricIds }))).toEqual([
      { id: 'price-trend', type: 'line', metrics: ['close'] },
      { id: 'change-trend', type: 'line', metrics: ['changePct'] },
    ])
    expect(result.value.charts[0]?.annotations).toEqual([
      { kind: 'bottomN', metricId: 'changePct', count: 3 },
    ])
    expect(dashboardSchemaV1.safeParse(result.value).success).toBe(true)
  })

  it('changes an explicit or longer range to the latest 10 trading days and retitles charts', () => {
    const result = parser.parse('改为最近 10 天', schemaAt(4))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.timeRange).toEqual({
      mode: 'lastTradingDays',
      start: '2025-03-18',
      end: '2025-03-31',
      tradingDays: 10,
      timezone: 'Asia/Shanghai',
    })
    expect(result.value.charts.every((chart) => chart.title.includes('最近 10 个交易日'))).toBe(true)
    expect(dashboardSchemaV1.safeParse(result.value).success).toBe(true)
  })

  it.each([
    ['改为最近 10 天', undefined, false, 'FOLLOW_UP_WITHOUT_CONTEXT'],
    ['把成交量改成涨跌幅，并改为最近 10 天', schemaAt(0), false, 'AMBIGUOUS_FOLLOW_UP'],
    ['换成饼图', schemaAt(0), false, 'UNSUPPORTED_FOLLOW_UP'],
    ['把成交量改成涨跌幅', schemaAt(1), false, 'UNSUPPORTED_FOLLOW_UP'],
    ['改为最近 10 天', schemaAt(0), true, 'FOLLOW_UP_LIMIT_REACHED'],
    ['改为最近 90 天', schemaAt(0), false, 'INVALID_RANGE'],
  ] as const)(
    'returns %s as an explainable error when appropriate',
    (query, context, alreadyUsed, expectedCode) => {
      const result = parser.parse(query, context, { alreadyUsed })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe(expectedCode)
        expect(result.error.message.length).toBeGreaterThan(0)
        expect(result.error.suggestion.length).toBeGreaterThan(0)
      }
    },
  )
})
