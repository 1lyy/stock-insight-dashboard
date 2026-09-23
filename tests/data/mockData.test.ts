import { describe, expect, it } from 'vitest'
import { dataManifestSchema } from '../../src/domain/dataManifest'
import { priceSeriesSchema, stockCatalogSchema } from '../../src/domain/entities'
import manifestJson from '../../src/data/dataManifest.json'
import mockAJson from '../../src/data/prices/mock-a.json'
import mockBJson from '../../src/data/prices/mock-b.json'
import mockCJson from '../../src/data/prices/mock-c.json'
import stocksJson from '../../src/data/stocks.json'

const seriesByStock = [
  ['stock-a', mockAJson],
  ['stock-b', mockBJson],
  ['stock-c', mockCJson],
] as const

describe('built-in mock market data', () => {
  it('has a valid, frozen manifest and stock catalog', () => {
    expect(dataManifestSchema.parse(manifestJson)).toEqual(manifestJson)
    expect(stockCatalogSchema.parse(stocksJson)).toEqual(stocksJson)
  })

  it.each(seriesByStock)('%s contains 63 ordered, valid and unique trading-day records', (stockId, source) => {
    const series = priceSeriesSchema.parse(source)
    const dates = series.map((bar) => bar.date)

    expect(series).toHaveLength(manifestJson.recordsPerStock)
    expect(series.every((bar) => bar.stockId === stockId)).toBe(true)
    expect(dates[0]).toBe(manifestJson.dateRange.start)
    expect(dates.at(-1)).toBe(manifestJson.dateRange.end)
    expect(new Set(dates).size).toBe(dates.length)
    expect(dates).toEqual([...dates].sort())
    expect(series.every((bar) => {
      const day = new Date(`${bar.date}T00:00:00Z`).getUTCDay()
      return day !== 0 && day !== 6
    })).toBe(true)
  })

  it('rejects duplicate stock catalog entries', () => {
    const invalidCatalog = [stocksJson[0], stocksJson[0], stocksJson[2]]

    expect(stockCatalogSchema.safeParse(invalidCatalog).success).toBe(false)
  })

  it('rejects mixed-stock or non-ascending price series', () => {
    const mixedSeries = structuredClone(mockAJson)
    const nonAscendingSeries = structuredClone(mockAJson)
    if (mixedSeries[1]) mixedSeries[1].stockId = 'stock-b'
    if (nonAscendingSeries[1] && nonAscendingSeries[0]) {
      nonAscendingSeries[1].date = nonAscendingSeries[0].date
    }

    expect(priceSeriesSchema.safeParse(mixedSeries).success).toBe(false)
    expect(priceSeriesSchema.safeParse(nonAscendingSeries).success).toBe(false)
  })
})
