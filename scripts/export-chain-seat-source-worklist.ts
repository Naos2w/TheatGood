/**
 * Research-only, safe to rerun: export current pending official seat-grid
 * acquisition tasks without publishing any seat labels or member information.
 *
 * npx tsx scripts/export-chain-seat-source-worklist.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pendingChainSeatSourceWorklist } from '../src/features/cinemas/chain-seat-evidence'

const outputDir = path.resolve('.tmp/chain-seat-source-worklist-20261123')
mkdirSync(outputDir, { recursive: true })

const tasks = pendingChainSeatSourceWorklist()
const brands = ['ambassador', 'in89', 'broadway', 'centuryasia', 'skcinemas', 'miramar'] as const
const summary = brands.map((brand) => {
  const group = tasks.filter((item) => item.brand === brand)
  return {
    brand,
    branches: new Set(group.map((item) => item.cinemaSlug)).size,
    sourceCapacityRecords: group.filter((item) => item.publishedSeatCount !== null).length,
    noHallCensusBranches: group.filter((item) => item.hallLabel === null).length,
    verifiedCompleteGrids: 0,
  }
})
if (
  summary.reduce((n, item) => n + item.branches, 0) !== 27 ||
  summary.reduce((n, item) => n + item.sourceCapacityRecords, 0) !== 232 ||
  tasks.length !== 237 ||
  tasks.some((item) => item.seatGridVerified || 'seatPositions' in item)
) {
  throw new Error('Unexpected pending-cinema source inventory; review source data before reporting')
}

const report = {
  generatedAt: new Date().toISOString(),
  classification: 'public-capacity-and-current-venue-discovery-only',
  dataSources: [
    'src/features/cinemas/chain-directory.ts',
    'src/features/cinemas/other-chain-facts.ts',
    'src/features/cinemas/data/additional-chain-published-seats-2026-11-18.json',
  ],
  truthfulStatus:
    'No missing full seat grid has been recovered. Every source capacity must stay separate from exact seat geometry.',
  summary,
  tasks,
}
writeFileSync(path.join(outputDir, 'worklist.json'), JSON.stringify(report, null, 2) + '\n')
const csvCell = (value: unknown): string => {
  const str = String(value ?? '')
  return '"' + str.replaceAll('"', '""') + '"'
}
const rows: unknown[][] = [
  ['brand', 'cinemaSlug', 'venue', 'hallLabel', 'publishedSeatCount', 'sourceUrl', 'status'],
  ...tasks.map((item) => [
    item.brand,
    item.cinemaSlug,
    item.venue,
    item.hallLabel,
    item.publishedSeatCount,
    item.sourceUrl,
    item.status,
  ]),
]
writeFileSync(
  path.join(outputDir, 'worklist.csv'),
  rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n',
)
console.log(JSON.stringify({ summary, totalResearchTasks: tasks.length, outputDir }))
