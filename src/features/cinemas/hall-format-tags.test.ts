import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadVieShowArchiveForCinema } from './vieshow-seat-archive'
import { hallFormatTags } from './hall-format-tags'
import { chainCinemas } from './chain-directory'
import {
  cinemaIdentityAsset,
  mallIdentityAsset,
  venueBrandLabel,
} from './cinema-discovery-metadata'

describe('mall logo source and auditorium-specific formats', () => {
  it('renders a sourced mall identity instead of a cinema logo in the venue tile', () => {
    for (const slug of [
      'vieshow-hsinchu-bigcity',
      'vieshow-taipei-qsquare',
      'vieshow-muvie-taichung-tigercity',
      'vieshow-banqiao-megacity',
    ]) {
      const logo = mallIdentityAsset(slug)
      expect(logo?.src).toMatch(/^\/malls\/.+\.(?:ico|png|svg|webp)$/)
      expect(logo?.sourceUrl).toMatch(/^(?:https:\/\/|user-upload:)/)
      expect(logo?.src).not.toContain('/brands/vieshow')
    }
    for (const cinema of chainCinemas) {
      const asset = mallIdentityAsset(cinema.slug)
      if (!asset) continue
      expect(asset.src.startsWith('/malls/')).toBe(true)
      expect(existsSync(join(process.cwd(), 'public', asset.src.slice(1)))).toBe(true)
      expect(asset.sourceUrl).toMatch(/^(?:https:\/\/|user-upload:)/)
    }
    expect(mallIdentityAsset('vieshow-taipei-hsinyi')).toBeUndefined()
    expect(venueBrandLabel(chainCinemas.find((c) => c.slug === 'vieshow-taipei-hsinyi')!)).toBe(
      '威秀影城',
    )
    expect(
      venueBrandLabel(chainCinemas.find((c) => c.slug === 'vieshow-muvie-taichung-tigercity')!),
    ).toBe('MUVIE')
  })

  it('prefers true square, sharp mall art when a verified brand identity exists', () => {
    const squareSlugs = [
      'vieshow-banqiao-megacity',
      'vieshow-zhonghe-global',
      'vieshow-taoyuan-tonlin',
      'vieshow-taoyuan-geleven',
      'vieshow-xindian-yulon',
      'vieshow-hsinchu-fe21',
    ]
    for (const slug of squareSlugs) {
      const asset = mallIdentityAsset(slug)
      expect(asset?.src).toMatch(/^\/malls\/.+\.png$/)
      const file = readFileSync(join(process.cwd(), 'public', asset!.src.slice(1)))
      expect(file.subarray(1, 4).toString()).toBe('PNG')
      const width = file.readUInt32BE(16)
      const height = file.readUInt32BE(20)
      expect(width).toBe(height)
      expect(width).toBeGreaterThanOrEqual(192)
    }
    expect(mallIdentityAsset('vieshow-banqiao-megacity')?.sourceUrl).toBe(
      'user-upload:2026-11-17-megacity',
    )
    for (const slug of ['vieshow-taichung-ifg', 'vieshow-hualien-paradiso']) {
      const asset = mallIdentityAsset(slug)!
      expect(asset.src).toMatch(/^\/malls\/.+-square\.png$/)
      const image = readFileSync(join(process.cwd(), 'public', asset.src.slice(1)))
      expect(image.readUInt32BE(16)).toBe(128)
      expect(image.readUInt32BE(20)).toBe(128)
      expect(asset.sourceUrl).toMatch(/^user-upload:/)
    }
    const shangshun = mallIdentityAsset('vieshow-toufen-shangshun')!
    expect(shangshun.src).toBe('/malls/shangshun-mark.svg')
    const svg = readFileSync(join(process.cwd(), 'public', shangshun.src.slice(1)), 'utf8')
    expect(svg).toContain('viewBox="-3 -19 108 105"')
  })

  it('uses a clear cinema logo only for freestanding Vie Show venues', () => {
    const expected = new Set(['vieshow-taipei-hsinyi', 'vieshow-taipei-ximen'])
    for (const cinema of chainCinemas.filter((venue) => venue.brand === 'vieshow')) {
      const identity = cinemaIdentityAsset(cinema)
      expect(identity?.src).toBeDefined()
      if (expected.has(cinema.slug)) {
        expect(identity?.src).toBe('/brands/vieshow-symbol.png')
        expect(mallIdentityAsset(cinema.slug)).toBeUndefined()
      } else {
        expect(identity?.src).toMatch(/^\/malls\//)
      }
    }
    expect(mallIdentityAsset('miranew-taimall')?.src).toBe('/malls/taimall-app-logo.png')
    expect(
      cinemaIdentityAsset(chainCinemas.find((c) => c.slug === 'showtime-hualien')!),
    ).toBeUndefined()
  })

  it('uses directly labelled Gold Class booking charts at all four known Vie Show branches', async () => {
    const sites = [
      ['vieshow-hsinchu-fe21', 2],
      ['vieshow-muvie-taichung-tigercity', 2],
      ['vieshow-tainan-tsmall', 2],
      ['vieshow-kaohsiung-fe21', 1],
    ] as const
    for (const [slug, expected] of sites) {
      const layouts = await loadVieShowArchiveForCinema(slug)
      const tagged = layouts.filter((hall) =>
        hallFormatTags(slug, hall).some((tag) => tag.label === 'GOLD CLASS'),
      )
      expect(tagged).toHaveLength(expected)
      for (const hall of tagged) {
        const tag = hallFormatTags(slug, hall)[0]!
        expect(tag.confidence).toBe('official-hall-label')
        expect(tag.sourceUrl).toMatch(/^https:\/\//)
        expect(hall.hallLabel).toMatch(/GC\d+|GOLD CLASS/i)
      }
    }
  })

  it('marks capacity-based cross-references as inferred, never confirmed', async () => {
    const examples = [
      ['vieshow-muvie-taipei-a13', 6, 'TITAN'],
      ['vieshow-banqiao-megacity', 6, 'IMAX'],
    ] as const
    for (const [slug, number, label] of examples) {
      const hall = (await loadVieShowArchiveForCinema(slug)).find(
        (item) => item.hallNumber === number,
      )!
      expect(hallFormatTags(slug, hall)).toEqual([
        expect.objectContaining({
          label,
          confidence: 'capacity-cross-reference',
          sourceUrl: expect.stringMatching(/^https:\/\//),
        }),
      ])
      const invalid = { ...hall, ordinarySeatCount: hall.ordinarySeatCount - 1 }
      expect(hallFormatTags(slug, invalid)).toHaveLength(0)
    }
  })

  it('never projects a cinema-level IMAX/4DX feature onto other numbered halls', async () => {
    for (const [slug, number] of [
      ['vieshow-hsinchu-bigcity', 2],
      ['vieshow-taipei-hsinyi', 11],
      ['vieshow-muvie-taichung-tigercity', 3],
    ] as const) {
      const hall = (await loadVieShowArchiveForCinema(slug)).find(
        (item) => item.hallNumber === number,
      )!
      expect(hallFormatTags(slug, hall)).toEqual([])
    }
  })
})
