import { z } from 'zod'
import {
  DATA_AS_OF,
  DATA_END_DATE,
  DATA_START_DATE,
  DATASET_VERSION,
  MARKET_TIMEZONE,
  SCHEMA_VERSION,
} from './datePolicy'

export const dataManifestSchema = z
  .object({
    datasetVersion: z.literal(DATASET_VERSION),
    schemaVersion: z.literal(SCHEMA_VERSION),
    dataAsOf: z.literal(DATA_AS_OF),
    timezone: z.literal(MARKET_TIMEZONE),
    dateRange: z
      .object({
        start: z.literal(DATA_START_DATE),
        end: z.literal(DATA_END_DATE),
      })
      .strict(),
    tradingDayConvention: z.literal('weekdays-only-no-holiday-inference'),
    stockCount: z.literal(3),
    recordsPerStock: z.number().int().min(60),
    units: z
      .object({
        price: z.literal('CNY'),
        volume: z.literal('shares'),
        changePct: z.literal('percent'),
      })
      .strict(),
    generation: z
      .object({
        method: z.literal('deterministic pre-generated fixture'),
        runtimeGeneration: z.literal(false),
        randomness: z.literal(false),
      })
      .strict(),
    disclaimer: z.string().min(1),
  })
  .strict()

export type DataManifest = z.infer<typeof dataManifestSchema>
