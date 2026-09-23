import { z } from 'zod'
import { isoDateSchema } from './isoDate'

export const stockSchema = z
  .object({
    id: z.string().min(1),
    symbol: z.enum(['MOCK-A', 'MOCK-B', 'MOCK-C']),
    name: z.enum(['A 公司', 'B 公司', 'C 公司']),
    currency: z.literal('CNY'),
    exchange: z.literal('MOCK'),
  })
  .strict()
  .superRefine((stock, ctx) => {
    const expectedNames = {
      'MOCK-A': 'A 公司',
      'MOCK-B': 'B 公司',
      'MOCK-C': 'C 公司',
    } as const
    if (expectedNames[stock.symbol] !== stock.name) {
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'stock symbol and name do not match' })
    }
  })

export const priceBarSchema = z
  .object({
    stockId: z.string().min(1),
    date: isoDateSchema,
    open: z.number().positive().finite(),
    high: z.number().positive().finite(),
    low: z.number().positive().finite(),
    close: z.number().positive().finite(),
    volume: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((bar, ctx) => {
    if (bar.high < Math.max(bar.open, bar.close, bar.low)) {
      ctx.addIssue({ code: 'custom', path: ['high'], message: 'high must be the maximum OHLC value' })
    }
    if (bar.low > Math.min(bar.open, bar.close, bar.high)) {
      ctx.addIssue({ code: 'custom', path: ['low'], message: 'low must be the minimum OHLC value' })
    }
  })

export const stockCatalogSchema = z
  .array(stockSchema)
  .length(3)
  .superRefine((stocks, ctx) => {
    const stockIds = new Set(stocks.map((stock) => stock.id))
    const symbols = new Set(stocks.map((stock) => stock.symbol))

    if (stockIds.size !== stocks.length) {
      ctx.addIssue({ code: 'custom', message: 'stock ids must be unique' })
    }
    if (symbols.size !== stocks.length) {
      ctx.addIssue({ code: 'custom', message: 'stock symbols must be unique' })
    }
  })

export const priceSeriesSchema = z
  .array(priceBarSchema)
  .min(60)
  .superRefine((bars, ctx) => {
    const stockIds = new Set(bars.map((bar) => bar.stockId))
    if (stockIds.size !== 1) {
      ctx.addIssue({ code: 'custom', message: 'a price series must belong to exactly one stock' })
    }

    for (let index = 1; index < bars.length; index += 1) {
      const previous = bars[index - 1]
      const current = bars[index]
      if (previous && current && current.date <= previous.date) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'date'],
          message: 'price series dates must be unique and strictly ascending',
        })
      }
    }
  })

export type Stock = z.infer<typeof stockSchema>
export type PriceBar = z.infer<typeof priceBarSchema>
