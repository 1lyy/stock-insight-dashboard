/**
 * Maintainer-only fixture generator.
 *
 * It is intentionally not part of dev/build/start. The application imports the
 * committed JSON files, so no data is generated at runtime. The formula contains
 * no random or current-time input and reproduces byte-identical values.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = resolve(projectRoot, 'src/data/prices')

const start = new Date('2025-01-02T00:00:00Z')
const end = new Date('2025-03-31T00:00:00Z')

const stocks = [
  { file: 'mock-a.json', stockId: 'stock-a', base: 21.8, trend: 0.045, amplitude: 0.65, phase: 0.2, volume: 1_200_000 },
  { file: 'mock-b.json', stockId: 'stock-b', base: 46.5, trend: -0.018, amplitude: 0.9, phase: 1.1, volume: 820_000 },
  { file: 'mock-c.json', stockId: 'stock-c', base: 13.2, trend: 0.07, amplitude: 0.45, phase: 2.2, volume: 2_050_000 },
]

const roundPrice = (value) => Number(value.toFixed(2))
const roundVolume = (value) => Math.round(value / 100) * 100

function tradingDates() {
  const dates = []
  for (const current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    const day = current.getUTCDay()
    if (day !== 0 && day !== 6) {
      dates.push(current.toISOString().slice(0, 10))
    }
  }
  return dates
}

function createSeries(stock, dates) {
  return dates.map((date, index) => {
    const shock = index > 0 && index % 17 === 0
      ? -1.1 * stock.amplitude
      : index > 0 && index % 23 === 0
        ? 0.9 * stock.amplitude
        : 0
    const close = roundPrice(
      stock.base
        + stock.trend * index
        + Math.sin(index * 0.58 + stock.phase) * stock.amplitude
        + Math.cos(index * 0.17 + stock.phase) * stock.amplitude * 0.35
        + shock,
    )
    const open = roundPrice(close + Math.sin(index * 0.41 + stock.phase) * 0.28)
    const high = roundPrice(Math.max(open, close) + 0.25 + Math.abs(Math.sin(index * 0.31)) * 0.35)
    const low = roundPrice(Math.min(open, close) - 0.22 - Math.abs(Math.cos(index * 0.29)) * 0.3)
    const volume = roundVolume(
      stock.volume
        * (1 + Math.sin(index * 0.37 + stock.phase) * 0.18 + Math.cos(index * 0.13) * 0.11 + (index > 0 && index % 13 === 0 ? 0.35 : 0)),
    )

    return { stockId: stock.stockId, date, open, high, low, close, volume }
  })
}

const dates = tradingDates()
if (dates.length !== 63) {
  throw new Error(`Expected 63 fixture dates, received ${dates.length}`)
}

await mkdir(outputDirectory, { recursive: true })
for (const stock of stocks) {
  const contents = `${JSON.stringify(createSeries(stock, dates), null, 2)}\n`
  await writeFile(resolve(outputDirectory, stock.file), contents, 'utf8')
}
