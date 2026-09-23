import { z } from 'zod'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false

  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export const isoDateSchema = z
  .string()
  .regex(ISO_DATE_PATTERN, 'must use YYYY-MM-DD')
  .refine(isRealIsoDate, 'must be a valid calendar date')
