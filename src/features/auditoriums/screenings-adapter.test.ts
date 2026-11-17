import { afterEach, describe, expect, it, vi } from 'vitest'
import { CULTURE_FILM_SOURCE, GET, normaliseCultureScreenings } from '../../../api/screenings'

const activity = (uid: string, title: string, locationName: string, time: string, extra = {}) => ({
  UID: uid,
  title,
  category: '8',
  showInfo: [{ time, locationName }],
  sourceWebPromote: 'https://kfa.kcg.gov.tw/tw/',
  ...extra,
})

afterEach(() => vi.restoreAllMocks())

describe('Ministry of Culture real-screenings adapter', () => {
  it('maps official hall labels without ever inventing a 3D seat model', () => {
    const result = normaliseCultureScreenings([
      activity(
        'film-one',
        '11月高雄市電影館｜雙面薇若妮卡',
        '高雄市電影館3樓',
        '2026/11/16 19:00:00',
      ),
      activity(
        'film-two',
        '11月高雄市電影館｜沙央',
        '內惟藝術中心 Reel two 2廳',
        '2026/11/17 00:30:00',
      ),
      activity(
        'film-three',
        '11月高雄市電影館｜紅色情深',
        '內惟藝術中心 Reel one 1廳',
        '2026/11/18 09:00:00',
      ),
    ])

    expect(result.map((x) => x.auditoriumSlug)).toEqual([
      'kfa-3f',
      'nwac-reel-two',
      'nwac-reel-one',
    ])
    expect(result[0]).toMatchObject({
      movieTitle: '雙面薇若妮卡',
      startsAt: '2026-11-16T11:00:00.000Z',
      timeZone: 'Asia/Taipei',
      cinemaSlug: 'kaohsiung-film-archive',
    })
    expect(result[1]?.startsAt).toBe('2026-11-16T16:30:00.000Z')
  })

  it('rejects unrelated VR exhibitions and unknown venue labels', () => {
    const result = normaliseCultureScreenings([
      activity('vr', '《世紀首登：聖母峰1953》VR沉浸大展', '內惟藝術中心', '2026/11/17 19:00:00'),
      activity('other', '電影介紹', '3樓', '2026/11/17 19:00:00'),
      activity('bad', '其他活動', '光點電影院', '2026/11/17 19:00:00'),
    ])
    expect(result).toEqual([])
  })

  it('can keep a film at a confirmed cinema with unknown hall as null', () => {
    const [screening] = normaliseCultureScreenings([
      activity('no-hall', '11月高雄市電影館｜一部電影', '高雄市電影館', '2026/11/20 15:15:00'),
    ])
    expect(screening).toMatchObject({
      auditoriumSlug: null,
      cinemaSlug: 'kaohsiung-film-archive',
      publishedHallLabel: '高雄市電影館',
    })
  })

  it('deduplicates identical event/time while preserving distinct halls and screenings', () => {
    const input = activity(
      'same-uid',
      '11月高雄市電影館｜沙央',
      '高雄市電影館3樓',
      '2026/11/16 20:00:00',
      {
        showInfo: [
          { locationName: '高雄市電影館3樓', time: '2026/11/16 20:00:00' },
          { locationName: '高雄市電影館3樓', time: '2026/11/16 20:00:00' },
          { locationName: '內惟藝術中心 Reel TWO 2廳', time: '2026/11/16 20:00:00' },
          { locationName: '高雄市電影館3樓', time: '2026/11/17 20:00:00' },
        ],
      },
    )
    const results = normaliseCultureScreenings([input])
    expect(results).toHaveLength(3)
    expect(new Set(results.map((x) => x.id)).size).toBe(3)
  })

  it('excludes invalid times and unsafe source URLs', () => {
    expect(
      normaliseCultureScreenings([
        activity('invalid-time', '電影', '高雄市電影館3樓', '2026/02/30 20:00:00'),
        activity('invalid-month', '電影', '高雄市電影館3樓', '2026/13/01 20:00:00'),
      ]),
    ).toHaveLength(0)
    expect(
      normaliseCultureScreenings([
        activity('valid', '電影', '高雄市電影館3樓', '2026/12/31 22:00:00', {
          sourceWebPromote: 'javascript:alert(1)',
        }),
      ])[0]?.sourceUrl,
    ).toBe('https://data.gov.tw/dataset/6010')
    expect(() => normaliseCultureScreenings({ error: 'not an array' })).toThrow()
  })

  it('returns source-attributed results on success, with no secrets or invented tickets', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json([
          activity('ok', '11月高雄市電影館｜影片', '高雄市電影館3樓', '2026/11/21 17:00:00'),
        ]),
      )
    const response = await GET()
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      CULTURE_FILM_SOURCE,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
    const data = await response.json()
    expect(data.screenings).toHaveLength(1)
    expect(data.provider).toBe('moc-film-open-data')
    expect(data).not.toHaveProperty('ticketAvailability')
  })

  it('fails explicitly when the live provider is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unavailable', { status: 502 }))
    const response = await GET()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'showtime_source_unavailable' })
  })
})
