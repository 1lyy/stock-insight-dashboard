import { describe, expect, it } from 'vitest'
import { AnalyzeQuery } from '../../src/services/analyzeQuery'
import { LocalMockDataProvider } from '../../src/infrastructure/LocalMockDataProvider'
import { EXAMPLE_FIXTURES } from '../fixtures/queries'

const analyze = new AnalyzeQuery()

describe('AnalyzeQuery domain pipeline', () => {
  it('reports the four real workflow stages in order', async () => {
    const fixture = EXAMPLE_FIXTURES[0]
    if (!fixture) throw new Error('Missing fixture')
    const stages: string[] = []

    const result = await analyze.executeWithProgress(fixture.query, {
      delayMs: 0,
      onStage: (stage) => stages.push(stage),
    })

    expect(result.ok).toBe(true)
    expect(stages).toEqual(['understanding', 'schema_ready', 'querying_data', 'rendering'])
  })

  it.each(EXAMPLE_FIXTURES)('analyzes $id using the frozen Schema and actual query data', ({ query, expectedSchema }) => {
    const result = analyze.execute(query)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.schema).toEqual(expectedSchema)
    expect(result.value.series).toHaveLength(result.value.queryResult.actualRange.tradingDays)
    expect(result.value.insight.text).not.toContain('undefined')
    expect(result.value.insight.text.endsWith('。')).toBe(true)
    expect(result.value.insight.disclaimer).toContain('模拟数据')
    expect(result.value.insight.facts.length).toBeGreaterThan(0)
  })

  it('derives the close-price insight fact from the first and last queried bars', () => {
    const fixture = EXAMPLE_FIXTURES[1]
    if (!fixture) throw new Error('Missing fixture')
    const result = analyze.execute(fixture.query)
    if (!result.ok) throw new Error(result.error.message)

    const first = result.value.series[0]
    const last = result.value.series.at(-1)
    const closeFact = result.value.insight.facts.find((fact) => fact.kind === 'periodCloseChange')
    if (!first || !last || !closeFact || closeFact.kind !== 'periodCloseChange') throw new Error('Missing close fact')

    expect(closeFact.startClose).toBe(first.close)
    expect(closeFact.endClose).toBe(last.close)
    expect(closeFact.changePct).toBe(
      Number((((last.close - first.close) / first.close) * 100).toFixed(4)),
    )
  })

  it('uses computed extrema values in both machine-readable facts and insight text', () => {
    const fixture = EXAMPLE_FIXTURES[3]
    if (!fixture) throw new Error('Missing fixture')
    const result = analyze.execute(fixture.query)
    if (!result.ok) throw new Error(result.error.message)

    const extrema = result.value.extrema[0]
    const fact = result.value.insight.facts.find((candidate) => candidate.kind === 'extrema')
    if (!extrema || !fact || fact.kind !== 'extrema') throw new Error('Missing extrema result')

    expect(fact.points).toEqual(extrema.points.map(({ date, value }) => ({ date, value })))
    for (const point of extrema.points) {
      expect(result.value.insight.text).toContain(point.date)
      expect(result.value.insight.text).toContain(`${point.value > 0 ? '+' : ''}${point.value.toFixed(2)}%`)
    }
  })

  it('revalidates, requeries and recomputes after a metric follow-up', () => {
    const fixture = EXAMPLE_FIXTURES[0]
    if (!fixture) throw new Error('Missing fixture')
    const initial = analyze.execute(fixture.query)
    if (!initial.ok) throw new Error(initial.error.message)

    const modified = analyze.executeFollowUp('把成交量改成涨跌幅', initial.value.schema)
    if (!modified.ok) throw new Error(modified.error.message)

    expect(modified.value.schema.metrics.map((metric) => metric.id)).toEqual(['close', 'changePct'])
    expect(modified.value.schema.charts.some((chart) => chart.metricIds.includes('changePct'))).toBe(true)
    expect(modified.value.series).toHaveLength(30)
    expect(modified.value.series.every((bar) => bar.changePct !== null)).toBe(true)
    expect(modified.value.insight.text).toContain('跌幅最大的 3 个交易日')
  })

  it('revalidates and requeries the latest 10 trading days after a range follow-up', () => {
    const fixture = EXAMPLE_FIXTURES[0]
    if (!fixture) throw new Error('Missing fixture')
    const initial = analyze.execute(fixture.query)
    if (!initial.ok) throw new Error(initial.error.message)

    const modified = analyze.executeFollowUp('改为最近 10 天', initial.value.schema)
    if (!modified.ok) throw new Error(modified.error.message)

    expect(modified.value.queryResult.actualRange).toEqual({
      start: '2025-03-18',
      end: '2025-03-31',
      tradingDays: 10,
    })
    expect(modified.value.series).toHaveLength(10)
    expect(modified.value.insight.text).toContain('2025-03-18 至 2025-03-31')
  })

  it('stores the average change percentage behind a change-only conclusion', () => {
    const result = analyze.execute('查看 A 公司最近 10 个交易日的涨跌幅。', 'demo-101')
    if (!result.ok) throw new Error(result.error.message)

    const fact = result.value.insight.facts.find((candidate) => candidate.kind === 'averageChangePct')
    expect(fact?.kind).toBe('averageChangePct')
    if (fact?.kind === 'averageChangePct') {
      const changes = result.value.series.flatMap((bar) => bar.changePct === null ? [] : [bar.changePct])
      const expected = Number((changes.reduce((sum, value) => sum + value, 0) / changes.length).toFixed(4))
      expect(fact.value).toBe(expected)
      expect(result.value.insight.text).toContain(`${expected > 0 ? '+' : ''}${expected.toFixed(2)}%`)
    }
  })

  it('turns an unexpected provider exception into an explainable result', async () => {
    class ThrowingProvider extends LocalMockDataProvider {
      override query(): never {
        throw new Error('deliberate provider failure')
      }
    }
    const failingAnalyze = new AnalyzeQuery(new ThrowingProvider())
    const result = await failingAnalyze.executeWithProgress(
      '查看 A 公司最近 10 个交易日的收盘价。',
      { delayMs: 0 },
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('UNEXPECTED_ERROR')
      expect(result.error.message).not.toContain('deliberate provider failure')
    }
  })
})
