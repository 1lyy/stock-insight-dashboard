import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { dashboardSchemaV1 } from '../../src/domain/schema/dashboardSchema'
import { EXAMPLE_FIXTURES } from '../fixtures/queries'

describe('DashboardSchema v1', () => {
  it.each(EXAMPLE_FIXTURES)('accepts the frozen fixture $id', ({ expectedSchema }) => {
    expect(dashboardSchemaV1.parse(expectedSchema)).toEqual(expectedSchema)
  })

  it('rejects a schema that omits dataAsOf', () => {
    const invalidSchema = structuredClone(EXAMPLE_FIXTURES[0]!.expectedSchema) as Record<string, unknown>
    delete invalidSchema.dataAsOf

    const result = dashboardSchemaV1.safeParse(invalidSchema)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError)
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'dataAsOf')).toBe(true)
    }
  })

  it('rejects a chart that references a metric absent from the metric list', () => {
    const source = structuredClone(EXAMPLE_FIXTURES[1]!.expectedSchema) as {
      charts: Array<{ annotations: Array<{ kind: string; metricId: string; count: number }> }>
    }
    source.charts[0]?.annotations.push({ kind: 'bottomN', metricId: 'changePct', count: 3 })

    const result = dashboardSchemaV1.safeParse(source)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('missing metric changePct'))).toBe(true)
    }
  })

  it('rejects a metric whose unit disagrees with the whitelist', () => {
    const source = structuredClone(EXAMPLE_FIXTURES[2]!.expectedSchema) as {
      metrics: Array<{ unit: string }>
    }
    if (source.metrics[0]) source.metrics[0].unit = '元'

    const result = dashboardSchemaV1.safeParse(source)

    expect(result.success).toBe(false)
  })

  it('rejects a well-formatted but impossible calendar date', () => {
    const source = structuredClone(EXAMPLE_FIXTURES[4]!.expectedSchema) as {
      timeRange: { start: string }
    }
    source.timeRange.start = '2025-02-30'

    const result = dashboardSchemaV1.safeParse(source)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'timeRange.start')).toBe(true)
    }
  })

  it('rejects a y field that is not declared by its chart', () => {
    const source = structuredClone(EXAMPLE_FIXTURES[0]!.expectedSchema) as {
      charts: Array<{ yFields: string[] }>
    }
    if (source.charts[0]) source.charts[0].yFields = ['volume']

    const result = dashboardSchemaV1.safeParse(source)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('must be declared'))).toBe(true)
    }
  })

  it('rejects annotations for metrics the analysis engine does not support', () => {
    const source = structuredClone(EXAMPLE_FIXTURES[1]!.expectedSchema) as {
      charts: Array<{ annotations: unknown[] }>
    }
    source.charts[0]?.annotations.push({ kind: 'topN', metricId: 'close', count: 3 })

    expect(dashboardSchemaV1.safeParse(source).success).toBe(false)
  })
})
