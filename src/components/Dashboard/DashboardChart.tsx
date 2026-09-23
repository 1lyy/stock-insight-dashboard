import { useMemo } from 'react'
import type { EChartsOption, SeriesOption } from 'echarts'
import { BarChart, LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkPointComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { METRIC_DEFINITIONS, type MetricId } from '../../domain/metrics'
import type { DashboardSchemaV1 } from '../../domain/schema/dashboardSchema'
import type { AnalysisOutput } from '../../services/analyzeQuery'
import { readMetric } from '../../services/metricEngine'

type ChartSpec = DashboardSchemaV1['charts'][number]

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkPointComponent,
  CanvasRenderer,
])

function displayValue(metricId: MetricId, value: number): string {
  if (metricId === 'changePct') return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
  if (metricId === 'volume') return `${Math.round(value).toLocaleString('zh-CN')} 股`
  return `${value.toFixed(2)} 元`
}

function displayTooltipValue(metricId: MetricId, value: unknown): string {
  const candidate = Array.isArray(value) ? value.at(-1) : value
  return typeof candidate === 'number' ? displayValue(metricId, candidate) : String(candidate ?? '—')
}

function buildOption(chart: ChartSpec, output: AnalysisOutput): EChartsOption {
  const primaryMetric = chart.yFields[0]
  const chartExtrema = output.extrema.filter((analysis) => analysis.chartId === chart.id)
  const annotationData = primaryMetric
    ? chartExtrema.flatMap((analysis) => analysis.points.flatMap((point) => {
        const sourceBar = output.series.find((bar) => bar.date === point.date)
        if (!sourceBar) return []
        const yValue = readMetric(sourceBar, primaryMetric)
        if (yValue === null) return []
        return [{
          name: analysis.kind === 'topN' ? '高值' : '低值',
          coord: [point.date, yValue],
          value: displayValue(analysis.metricId, point.value),
        }]
      }))
    : []

  const series: SeriesOption[] = chart.metricIds.map((metricId, index) => {
    const definition = METRIC_DEFINITIONS[metricId]
    const common = {
      name: definition.label,
      data: output.series.map((bar) => [bar.date, readMetric(bar, metricId)]),
      emphasis: { focus: 'series' as const },
      tooltip: { valueFormatter: (value: unknown) => displayTooltipValue(metricId, value) },
      ...(index === 0 && annotationData.length > 0
        ? {
            markPoint: {
              symbol: 'pin',
              symbolSize: 48,
              itemStyle: { color: '#f05a47' },
              label: { color: '#fff', fontSize: 10 },
              data: annotationData,
            },
          }
        : {}),
    }

    return chart.type === 'line'
      ? {
          ...common,
          type: 'line',
          showSymbol: false,
          smooth: 0.2,
          lineStyle: { width: 3, color: '#2563eb' },
          itemStyle: { color: '#2563eb' },
          areaStyle: { color: 'rgba(37, 99, 235, 0.08)' },
        }
      : {
          ...common,
          type: 'bar',
          barMaxWidth: 22,
          itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
        }
  })

  const units = [...new Set(chart.metricIds.map((metricId) => METRIC_DEFINITIONS[metricId].unit))]
  return {
    animationDuration: 450,
    color: ['#2563eb', '#16a085', '#f59e0b'],
    grid: { top: 42, right: 24, bottom: 58, left: 66, containLabel: false },
    legend: { top: 4, right: 8, textStyle: { color: '#526078' } },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(17, 24, 39, 0.94)',
      borderWidth: 0,
      textStyle: { color: '#fff' },
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b', hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: units.join(' / '),
      nameTextStyle: { color: '#64748b', align: 'right' },
      scale: true,
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e8edf5', type: 'dashed' } },
    },
    ...(output.series.length > 30
      ? { dataZoom: [{ type: 'inside' as const, start: 0, end: 100 }, { type: 'slider' as const, height: 18, bottom: 8 }] }
      : {}),
    series,
  }
}

export function DashboardChart({ chart, output }: { readonly chart: ChartSpec; readonly output: AnalysisOutput }) {
  const option = useMemo(() => buildOption(chart, output), [chart, output])

  return (
    <article className="chart-card" aria-label={chart.title}>
      <div className="chart-heading">
        <div>
          <span className="chart-type">{chart.type === 'line' ? '趋势' : '分布'}</span>
          <h3>{chart.title}</h3>
        </div>
        <span className="chart-unit">{chart.metricIds.map((id) => METRIC_DEFINITIONS[id].unit).join(' / ')}</span>
      </div>
      <p className="sr-only">
        {chart.title}，包含 {output.series.length} 个交易日，单位为
        {chart.metricIds.map((id) => METRIC_DEFINITIONS[id].unit).join('、')}。
      </p>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        notMerge
        lazyUpdate
        style={{ height: 360, width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </article>
  )
}
