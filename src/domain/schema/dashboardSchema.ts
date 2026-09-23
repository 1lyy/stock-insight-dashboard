import { z } from 'zod'
import {
  DATA_AS_OF,
  DATASET_VERSION,
  MARKET_TIMEZONE,
  MAX_ANNOTATION_COUNT,
  MAX_TRADING_DAYS,
  MIN_ANNOTATION_COUNT,
  MIN_TRADING_DAYS,
  SCHEMA_VERSION,
} from '../datePolicy'
import { isoDateSchema } from '../isoDate'
import { METRIC_DEFINITIONS, METRIC_IDS } from '../metrics'

export const stockReferenceSchema = z
  .object({
    symbol: z.enum(['MOCK-A', 'MOCK-B', 'MOCK-C']),
    name: z.enum(['A 公司', 'B 公司', 'C 公司']),
  })
  .strict()

const dateRangeFields = {
  start: isoDateSchema,
  end: isoDateSchema,
  timezone: z.literal(MARKET_TIMEZONE),
}

export const timeRangeSchema = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('lastTradingDays'),
      ...dateRangeFields,
      tradingDays: z.number().int().min(MIN_TRADING_DAYS).max(MAX_TRADING_DAYS),
    })
    .strict(),
  z
    .object({
      mode: z.literal('dateRange'),
      ...dateRangeFields,
    })
    .strict(),
])

export const metricSpecSchema = z
  .object({
    id: z.enum(METRIC_IDS),
    label: z.string().min(1),
    unit: z.enum(['元', '股', '%']),
  })
  .strict()

export const annotationSchema = z
  .object({
    kind: z.enum(['topN', 'bottomN']),
    metricId: z.enum(['changePct', 'volume']),
    count: z.number().int().min(MIN_ANNOTATION_COUNT).max(MAX_ANNOTATION_COUNT),
  })
  .strict()

export const chartSpecSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    type: z.enum(['line', 'bar']),
    title: z.string().min(1).max(100),
    metricIds: z.array(z.enum(METRIC_IDS)).min(1),
    xField: z.literal('date'),
    yFields: z.array(z.enum(METRIC_IDS)).min(1),
    annotations: z.array(annotationSchema),
  })
  .strict()

export const dataSourceSchema = z
  .object({
    type: z.literal('mock'),
    name: z.literal('Built-in Mock Market Data'),
    datasetVersion: z.literal(DATASET_VERSION),
  })
  .strict()

export const dashboardSchemaV1 = z
  .object({
    version: z.literal(SCHEMA_VERSION),
    requestId: z.string().regex(/^demo-\d{3}$/),
    stock: stockReferenceSchema,
    timeRange: timeRangeSchema,
    metrics: z.array(metricSpecSchema).min(1),
    charts: z.array(chartSpecSchema).min(1),
    dataSource: dataSourceSchema,
    dataAsOf: z.literal(DATA_AS_OF),
    locale: z.literal('zh-CN'),
  })
  .strict()
  .superRefine((schema, ctx) => {
    if (schema.timeRange.start > schema.timeRange.end) {
      ctx.addIssue({
        code: 'custom',
        path: ['timeRange', 'start'],
        message: 'start must be on or before end',
      })
    }

    const stockNameBySymbol = {
      'MOCK-A': 'A 公司',
      'MOCK-B': 'B 公司',
      'MOCK-C': 'C 公司',
    } as const
    if (stockNameBySymbol[schema.stock.symbol] !== schema.stock.name) {
      ctx.addIssue({ code: 'custom', path: ['stock', 'name'], message: 'stock symbol and name do not match' })
    }

    const metricIds = new Set(schema.metrics.map((metric) => metric.id))
    if (metricIds.size !== schema.metrics.length) {
      ctx.addIssue({ code: 'custom', path: ['metrics'], message: 'metric ids must be unique' })
    }

    schema.metrics.forEach((metric, index) => {
      const definition = METRIC_DEFINITIONS[metric.id]
      if (metric.label !== definition.label) {
        ctx.addIssue({ code: 'custom', path: ['metrics', index, 'label'], message: `label must be ${definition.label}` })
      }
      if (metric.unit !== definition.unit) {
        ctx.addIssue({ code: 'custom', path: ['metrics', index, 'unit'], message: `unit must be ${definition.unit}` })
      }
    })

    const chartIds = new Set<string>()
    schema.charts.forEach((chart, chartIndex) => {
      if (chartIds.has(chart.id)) {
        ctx.addIssue({ code: 'custom', path: ['charts', chartIndex, 'id'], message: 'chart ids must be unique' })
      }
      chartIds.add(chart.id)

      if (new Set(chart.metricIds).size !== chart.metricIds.length) {
        ctx.addIssue({ code: 'custom', path: ['charts', chartIndex, 'metricIds'], message: 'chart metric ids must be unique' })
      }
      if (new Set(chart.yFields).size !== chart.yFields.length) {
        ctx.addIssue({ code: 'custom', path: ['charts', chartIndex, 'yFields'], message: 'chart y fields must be unique' })
      }
      chart.yFields.forEach((metricId) => {
        if (!chart.metricIds.includes(metricId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['charts', chartIndex, 'yFields'],
            message: `y field ${metricId} must be declared in chart metricIds`,
          })
        }
      })

      const referencedIds = [...chart.metricIds, ...chart.yFields, ...chart.annotations.map((item) => item.metricId)]
      referencedIds.forEach((metricId) => {
        if (!metricIds.has(metricId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['charts', chartIndex],
            message: `chart references missing metric ${metricId}`,
          })
        }
      })
    })

    const usedMetricIds = new Set(
      schema.charts.flatMap((chart) => [
        ...chart.metricIds,
        ...chart.annotations.map((annotation) => annotation.metricId),
      ]),
    )
    schema.metrics.forEach((metric, index) => {
      if (!usedMetricIds.has(metric.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['metrics', index, 'id'],
          message: `metric ${metric.id} is not used by any chart or annotation`,
        })
      }
    })
  })

export type DashboardSchemaV1 = z.infer<typeof dashboardSchemaV1>

export function parseDashboardSchema(input: unknown): DashboardSchemaV1 {
  return dashboardSchemaV1.parse(input)
}
