import type { PriceBar } from '../domain/entities'
import type { AppError } from '../domain/errors'
import type { MetricId } from '../domain/metrics'
import { failure, success, type OperationResult } from '../domain/result'
import type { DashboardSchemaV1 } from '../domain/schema/dashboardSchema'
import type { StockSeries } from '../infrastructure/DataProvider'

export interface EnrichedPriceBar extends PriceBar {
  readonly changePct: number | null
}

export interface ExtremumPoint {
  readonly date: string
  readonly metricId: 'changePct' | 'volume'
  readonly value: number
}

export interface ExtremumAnalysis {
  readonly chartId: string
  readonly kind: 'topN' | 'bottomN'
  readonly metricId: 'changePct' | 'volume'
  readonly requestedCount: number
  readonly points: readonly ExtremumPoint[]
  readonly notice?: string
}

function analysisError(message: string, suggestion: string): AppError {
  return {
    code: 'INSUFFICIENT_DATA',
    stage: 'analysis',
    message,
    suggestion,
  }
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function metricValue(bar: EnrichedPriceBar, metricId: 'changePct' | 'volume'): number | null {
  return metricId === 'changePct' ? bar.changePct : bar.volume
}

export class MetricEngine {
  derive(series: StockSeries): readonly EnrichedPriceBar[] {
    let previousClose = series.previousBar?.close
    return series.bars.map((bar) => {
      const changePct = previousClose === undefined
        ? null
        : round(((bar.close - previousClose) / previousClose) * 100, 4)
      previousClose = bar.close
      return { ...bar, changePct }
    })
  }

  findExtrema(
    bars: readonly EnrichedPriceBar[],
    metricId: 'changePct' | 'volume',
    kind: 'topN' | 'bottomN',
    count: number,
  ): OperationResult<readonly ExtremumPoint[]> {
    const candidates = bars
      .map((bar) => ({ date: bar.date, metricId, value: metricValue(bar, metricId) }))
      .filter((point): point is ExtremumPoint => point.value !== null && Number.isFinite(point.value))

    if (candidates.length === 0) {
      return failure(analysisError(`没有足够数据计算 ${metricId} 极值。`, '请扩大查询范围或更换指标。'))
    }

    const direction = kind === 'topN' ? -1 : 1
    const sorted = [...candidates].sort((left, right) => {
      const valueOrder = (left.value - right.value) * direction
      return valueOrder === 0 ? left.date.localeCompare(right.date) : valueOrder
    })
    return success(sorted.slice(0, Math.min(count, sorted.length)))
  }

  analyzeAnnotations(
    schema: DashboardSchemaV1,
    bars: readonly EnrichedPriceBar[],
  ): OperationResult<readonly ExtremumAnalysis[]> {
    const analyses: ExtremumAnalysis[] = []
    for (const chart of schema.charts) {
      for (const annotation of chart.annotations) {
        const extrema = this.findExtrema(bars, annotation.metricId, annotation.kind, annotation.count)
        if (!extrema.ok) return extrema
        analyses.push({
          chartId: chart.id,
          kind: annotation.kind,
          metricId: annotation.metricId,
          requestedCount: annotation.count,
          points: extrema.value,
          ...(extrema.value.length < annotation.count
            ? { notice: `请求标注 ${annotation.count} 个极值，但当前范围只有 ${extrema.value.length} 个有效数据点，已全部标注。` }
            : {}),
        })
      }
    }
    return success(analyses)
  }
}

export function readMetric(bar: EnrichedPriceBar, metricId: MetricId): number | null {
  if (metricId === 'changePct') return bar.changePct
  return bar[metricId]
}
