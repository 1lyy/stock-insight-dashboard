import { describe, expect, it } from 'vitest'
import { METRIC_DEFINITIONS } from '../../src/domain/metrics'
import { AnalyzeQuery } from '../../src/services/analyzeQuery'
import { readMetric } from '../../src/services/metricEngine'
import { EXAMPLE_FIXTURES } from '../fixtures/queries'

const analyze = new AnalyzeQuery()

describe('REQUIRE.md acceptance consistency', () => {
  it.each(EXAMPLE_FIXTURES)('$id keeps Schema, series, extrema and insight facts consistent', ({ query, expectedSchema }) => {
    const result = analyze.execute(query)
    if (!result.ok) throw new Error(result.error.message)
    const output = result.value

    expect(output.schema).toEqual(expectedSchema)
    expect(output.series).toHaveLength(output.queryResult.actualRange.tradingDays)
    expect(output.queryResult.actualRange.start).toBe(output.series[0]?.date)
    expect(output.queryResult.actualRange.end).toBe(output.series.at(-1)?.date)

    for (const chart of output.schema.charts) {
      expect(['line', 'bar']).toContain(chart.type)
      for (const metricId of chart.metricIds) {
        const spec = output.schema.metrics.find((metric) => metric.id === metricId)
        expect(spec?.unit).toBe(METRIC_DEFINITIONS[metricId].unit)
        expect(output.series.some((bar) => readMetric(bar, metricId) !== null)).toBe(true)
      }
    }

    for (const analysis of output.extrema) {
      for (const point of analysis.points) {
        const source = output.series.find((bar) => bar.date === point.date)
        expect(source).toBeTruthy()
        if (source) expect(readMetric(source, analysis.metricId)).toBe(point.value)
      }
    }

    for (const fact of output.insight.facts) {
      if (fact.kind === 'periodCloseChange') {
        const first = output.series[0]
        const last = output.series.at(-1)
        expect(fact.startClose).toBe(first?.close)
        expect(fact.endClose).toBe(last?.close)
      } else if (fact.kind === 'averageVolume') {
        const expected = Math.round(output.series.reduce((sum, bar) => sum + bar.volume, 0) / output.series.length)
        expect(fact.value).toBe(expected)
      } else if (fact.kind === 'averageChangePct') {
        const values = output.series.flatMap((bar) => bar.changePct === null ? [] : [bar.changePct])
        expect(fact.value).toBe(Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)))
      } else {
        const analysis = output.extrema.find((candidate) =>
          candidate.metricId === fact.metricId && candidate.kind === fact.direction)
        expect(fact.points).toEqual(analysis?.points.map(({ date, value }) => ({ date, value })))
      }
    }

    expect(output.insight.text.length).toBeGreaterThan(0)
    expect(output.insight.disclaimer).toContain('不构成投资建议')
  })

  it('the frozen examples collectively exercise both required chart types', () => {
    const chartTypes = new Set(EXAMPLE_FIXTURES.flatMap(({ query }) => {
      const result = analyze.execute(query)
      if (!result.ok) throw new Error(result.error.message)
      return result.value.schema.charts.map((chart) => chart.type)
    }))

    expect(chartTypes).toEqual(new Set(['line', 'bar']))
  })
})
