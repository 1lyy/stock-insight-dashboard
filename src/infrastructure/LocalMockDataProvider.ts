import type { PriceBar, Stock } from '../domain/entities'
import { priceSeriesSchema, stockCatalogSchema } from '../domain/entities'
import type { AppError } from '../domain/errors'
import type { OperationResult } from '../domain/result'
import { failure, success } from '../domain/result'
import { DATA_AS_OF, DATASET_VERSION } from '../domain/datePolicy'
import mockAJson from '../data/prices/mock-a.json'
import mockBJson from '../data/prices/mock-b.json'
import mockCJson from '../data/prices/mock-c.json'
import stocksJson from '../data/stocks.json'
import type { DataProvider, DataQuery, StockSeries, StockSymbol } from './DataProvider'

const stocks = stockCatalogSchema.parse(stocksJson)
const seriesBySymbol: Readonly<Record<StockSymbol, readonly PriceBar[]>> = {
  'MOCK-A': priceSeriesSchema.parse(mockAJson),
  'MOCK-B': priceSeriesSchema.parse(mockBJson),
  'MOCK-C': priceSeriesSchema.parse(mockCJson),
}

function dataError(code: AppError['code'], message: string, suggestion: string): AppError {
  return { code, stage: 'querying_data', message, suggestion }
}

function findStock(symbol: StockSymbol): Stock {
  const stock = stocks.find((item) => item.symbol === symbol)
  if (!stock) throw new Error(`Validated mock catalog is missing ${symbol}`)
  return stock
}

function findPreviousBar(allBars: readonly PriceBar[], firstBar: PriceBar): PriceBar | undefined {
  const firstIndex = allBars.findIndex((bar) => bar.date === firstBar.date)
  return firstIndex > 0 ? allBars[firstIndex - 1] : undefined
}

function createStockSeries(
  stock: Stock,
  allBars: readonly PriceBar[],
  selectedBars: readonly PriceBar[],
  notices: StockSeries['notices'] = [],
): OperationResult<StockSeries> {
  const firstBar = selectedBars[0]
  const lastBar = selectedBars.at(-1)
  if (!firstBar || !lastBar) {
    return failure(dataError('NO_DATA', '指定范围内没有模拟行情数据。', '请使用数据集覆盖范围内的日期。'))
  }

  const previousBar = findPreviousBar(allBars, firstBar)
  return success({
    stock,
    bars: selectedBars,
    ...(previousBar ? { previousBar } : {}),
    source: {
      type: 'mock',
      name: 'Built-in Mock Market Data',
      datasetVersion: DATASET_VERSION,
      dataAsOf: DATA_AS_OF,
    },
    actualRange: {
      start: firstBar.date,
      end: lastBar.date,
      tradingDays: selectedBars.length,
    },
    notices,
  })
}

export class LocalMockDataProvider implements DataProvider {
  query(query: DataQuery) {
    const stock = findStock(query.symbol)
    const allBars = seriesBySymbol[query.symbol]

    if (query.timeRange.mode === 'lastTradingDays') {
      const candidates = allBars.filter((bar) => bar.date <= query.timeRange.end)
      if (candidates.length < query.timeRange.tradingDays) {
        return failure(
          dataError(
            'RANGE_OUT_OF_DATASET',
            `截至 ${query.timeRange.end} 只有 ${candidates.length} 个可用交易日，少于请求的 ${query.timeRange.tradingDays} 个。`,
            '请缩短交易日数量或使用更晚的截止日期。',
          ),
        )
      }

      const selectedBars = candidates.slice(-query.timeRange.tradingDays)
      const actualStart = selectedBars[0]?.date
      if (actualStart !== query.timeRange.start) {
        return failure(
          dataError(
            'INVALID_RANGE',
            `Schema 起始日期 ${query.timeRange.start} 与最近 ${query.timeRange.tradingDays} 个交易日的实际起始日期 ${actualStart ?? '未知'} 不一致。`,
            '请通过 IntentParser 重新生成 Schema。',
          ),
        )
      }

      const actualEnd = selectedBars.at(-1)?.date
      const notices = actualEnd !== query.timeRange.end && actualEnd
        ? [{
            code: 'RANGE_CLIPPED' as const,
            message: `截止日期 ${query.timeRange.end} 没有模拟行情，实际使用截至 ${actualEnd} 的交易日数据。`,
          }]
        : []
      return createStockSeries(stock, allBars, selectedBars, notices)
    }

    const selectedBars = allBars.filter(
      (bar) => bar.date >= query.timeRange.start && bar.date <= query.timeRange.end,
    )
    const notices = []
    const firstAvailable = allBars[0]?.date
    const lastAvailable = allBars.at(-1)?.date
    if (
      firstAvailable
      && lastAvailable
      && (query.timeRange.start < firstAvailable || query.timeRange.end > lastAvailable)
    ) {
      notices.push({
        code: 'RANGE_CLIPPED' as const,
        message: `请求日期超出数据集范围，结果已限制在 ${firstAvailable} 至 ${lastAvailable}。`,
      })
    }

    return createStockSeries(stock, allBars, selectedBars, notices)
  }

  getAvailableDates(symbol: StockSymbol): readonly string[] {
    return seriesBySymbol[symbol].map((bar) => bar.date)
  }
}
