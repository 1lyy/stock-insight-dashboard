import type { DashboardSchemaV1 } from '../domain/schema/dashboardSchema'
import type { StockSeries } from '../infrastructure/DataProvider'
import type { EnrichedPriceBar, ExtremumAnalysis } from './metricEngine'

export type InsightFact =
  | {
      readonly kind: 'periodCloseChange'
      readonly startClose: number
      readonly endClose: number
      readonly changePct: number
      readonly unit: '元'
    }
  | {
      readonly kind: 'averageVolume'
      readonly value: number
      readonly unit: '股'
    }
  | {
      readonly kind: 'averageChangePct'
      readonly value: number
      readonly unit: '%'
    }
  | {
      readonly kind: 'extrema'
      readonly metricId: 'changePct' | 'volume'
      readonly direction: 'topN' | 'bottomN'
      readonly points: readonly { readonly date: string; readonly value: number }[]
      readonly unit: '%' | '股'
    }

export interface Insight {
  readonly text: string
  readonly facts: readonly InsightFact[]
  readonly disclaimer: '数据为模拟数据，仅用于演示，不构成投资建议。'
}

const DISCLAIMER = '数据为模拟数据，仅用于演示，不构成投资建议。' as const

function formatPrice(value: number): string {
  return value.toFixed(2)
}

function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatVolume(value: number): string {
  return `${Math.round(value).toLocaleString('zh-CN')} 股`
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function describeExtrema(analysis: ExtremumAnalysis): string {
  const metricLabel = analysis.metricId === 'changePct'
    ? analysis.kind === 'topN' ? '涨幅最大' : '跌幅最大'
    : analysis.kind === 'topN' ? '成交量最高' : '成交量最低'
  const values = analysis.points.map((point) => {
    const formattedValue = analysis.metricId === 'changePct'
      ? formatPercent(point.value)
      : formatVolume(point.value)
    return `${point.date}（${formattedValue}）`
  })
  return `${metricLabel}的 ${analysis.points.length} 个交易日为 ${values.join('、')}`
}

export class InsightGenerator {
  generate(
    schema: DashboardSchemaV1,
    queryResult: StockSeries,
    bars: readonly EnrichedPriceBar[],
    extrema: readonly ExtremumAnalysis[],
  ): Insight {
    const firstBar = bars[0]
    const lastBar = bars.at(-1)
    if (!firstBar || !lastBar) {
      return { text: '有效数据不足，无法生成结论。', facts: [], disclaimer: DISCLAIMER }
    }

    const facts: InsightFact[] = []
    const clauses: string[] = []
    const metricIds = new Set(schema.metrics.map((metric) => metric.id))
    const rangeText = `${queryResult.actualRange.start} 至 ${queryResult.actualRange.end}`

    if (metricIds.has('close')) {
      const changePct = round(((lastBar.close - firstBar.close) / firstBar.close) * 100, 4)
      facts.push({
        kind: 'periodCloseChange',
        startClose: firstBar.close,
        endClose: lastBar.close,
        changePct,
        unit: '元',
      })
      clauses.push(
        `${schema.stock.name}在 ${rangeText} 的收盘价从 ${formatPrice(firstBar.close)} 元变为 ${formatPrice(lastBar.close)} 元，区间变化 ${formatPercent(changePct)}`,
      )
    }

    if (metricIds.has('volume')) {
      const averageVolume = Math.round(bars.reduce((sum, bar) => sum + bar.volume, 0) / bars.length)
      facts.push({ kind: 'averageVolume', value: averageVolume, unit: '股' })
      clauses.push(`期间平均成交量为 ${formatVolume(averageVolume)}`)
    }

    for (const analysis of extrema) {
      facts.push({
        kind: 'extrema',
        metricId: analysis.metricId,
        direction: analysis.kind,
        points: analysis.points.map(({ date, value }) => ({ date, value })),
        unit: analysis.metricId === 'changePct' ? '%' : '股',
      })
      clauses.push(describeExtrema(analysis))
    }

    const displaysChangePct = schema.charts.some((chart) => chart.metricIds.includes('changePct'))
    const hasChangePctExtrema = extrema.some((analysis) => analysis.metricId === 'changePct')
    if (displaysChangePct && !hasChangePctExtrema) {
      const validChanges = bars.flatMap((bar) => bar.changePct === null ? [] : [bar.changePct])
      if (validChanges.length > 0) {
        const average = round(validChanges.reduce((sum, value) => sum + value, 0) / validChanges.length, 4)
        facts.push({ kind: 'averageChangePct', value: average, unit: '%' })
        clauses.push(`${schema.stock.name}在 ${rangeText} 的平均日涨跌幅为 ${formatPercent(average)}`)
      }
    }

    return {
      text: clauses.length > 0 ? `${clauses.join('；')}。` : '有效数据不足，无法生成结论。',
      facts,
      disclaimer: DISCLAIMER,
    }
  }
}
