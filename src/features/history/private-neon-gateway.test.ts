import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPrivateNeonGateway } from './private-neon-gateway'

const state = vi.hoisted(() => ({
  userId: 'qa-a' as string | null,
  rows: [] as unknown[],
  inserted: [] as unknown[],
  readCalls: 0,
  signIn: [] as unknown[],
  signOutCalls: 0,
}))

vi.mock('@neondatabase/neon-js', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: state.userId ? { user: { id: state.userId } } : null,
        error: null,
      }),
      signIn: {
        social: async (payload: unknown) => {
          state.signIn.push(payload)
        },
      },
      signOut: async () => {
        state.signOutCalls += 1
      },
    },
    from: (name: string) => {
      if (name !== 'watch_logs') throw new Error('Accessed an unexpected table')
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => {
                state.readCalls += 1
                return { data: state.rows, error: null }
              },
            }),
          }),
        }),
        insert: (rows: unknown[]) => ({
          select: async () => {
            state.inserted.push(...rows)
            return {
              data: rows.map((row) => ({ id: (row as { id: string }).id })),
              error: null,
            }
          },
        }),
      }
    },
  }),
}))

const endpoints = {
  authUrl: 'https://ep-example.neonauth.ap-southeast-1.aws.neon.tech/theatgood/auth',
  dataApiUrl: 'https://ep-example.apirest.ap-southeast-1.aws.neon.tech/theatgood/rest/v1',
}

const first = {
  id: '7112d1c3-55d9-4cf4-9fa2-000000000015',
  movieTitle: '自填電影',
  watchedOn: '2026-11-20',
  cinemaSlug: 'spot-taipei',
  cinemaName: '光點台北電影館',
  hallName: '光點電影院',
  seatLabel: '1-1',
  modelId: 'spot-taipei',
  modelVersion: 1,
  manualEntry: true,
  screeningId: null,
  createdAt: '2026-11-20T04:00:00.000Z',
  updatedAt: '2026-11-20T04:00:00.000Z',
}

beforeEach(() => {
  state.userId = 'qa-a'
  state.rows = []
  state.inserted = []
  state.readCalls = 0
  state.signIn = []
  state.signOutCalls = 0
})

describe('private Neon gateway remains opt-in and branch-bound', () => {
  it('does not initialise against HTTP endpoints or mixed Neon branches', async () => {
    await expect(
      createPrivateNeonGateway({ ...endpoints, authUrl: 'http://ep-example.neonauth.example.com' }),
    ).rejects.toThrow(/HTTPS/)
    await expect(
      createPrivateNeonGateway({
        ...endpoints,
        dataApiUrl: endpoints.dataApiUrl.replace('ep-example', 'ep-another'),
      }),
    ).rejects.toThrow(/HTTPS/)
  })

  it('requires a restored login session before accessing private rows', async () => {
    const gateway = await createPrivateNeonGateway(endpoints)
    state.userId = null
    await expect(gateway.listOwnEntries()).rejects.toThrow(/sign-in/)
    expect(state.readCalls).toBe(0)
  })

  it('only offers Google OAuth and returns to the existing history route', async () => {
    const gateway = await createPrivateNeonGateway(endpoints)
    await gateway.signInWithGoogle()
    await gateway.signOut()
    expect(state.signIn).toEqual([{ provider: 'google', callbackURL: '/history' }])
    expect(state.signOutCalls).toBe(1)
  })

  it('does not read or write any history before explicit import consent', async () => {
    const gateway = await createPrivateNeonGateway(endpoints)
    const plan = await gateway.planOwnInitialImport([first], false)
    expect(plan.status).toBe('consent-required')
    const applied = await gateway.uploadMissingEntries([first], false)
    expect(applied).toEqual({ status: 'consent-required', uploaded: 0 })
    expect(state.readCalls).toBe(0)
    expect(state.inserted).toHaveLength(0)
  })

  it('uploads only absent records, never includes a client-supplied owner ID', async () => {
    const gateway = await createPrivateNeonGateway(endpoints)
    const applied = await gateway.uploadMissingEntries([first], true)
    expect(applied).toEqual({ status: 'uploaded', uploaded: 1 })
    expect(state.readCalls).toBe(1)
    expect(state.inserted).toHaveLength(1)
    expect(state.inserted[0]).not.toHaveProperty('user_id')
    expect(state.inserted[0]).toHaveProperty('watched_on', '2026-11-20')
  })

  it('stops conflicting versions without destructive overwrites', async () => {
    const gateway = await createPrivateNeonGateway(endpoints)
    const row = {
      id: first.id,
      user_id: 'qa-a',
      movie_title: '雲端曾修改',
      watched_on: first.watchedOn,
      cinema_slug: first.cinemaSlug,
      cinema_name: first.cinemaName,
      auditorium_name: first.hallName,
      seat_label: first.seatLabel,
      local_model_id: first.modelId,
      local_model_version: first.modelVersion,
      manual_entry: true,
      screening_id: null,
      created_at: first.createdAt,
      updated_at: first.updatedAt,
    }
    state.rows = [row]
    const applied = await gateway.uploadMissingEntries([first], true)
    expect(applied.status).toBe('conflicts')
    expect(state.inserted).toHaveLength(0)
  })

  it('never deletes without confirmation', async () => {
    const gateway = await createPrivateNeonGateway(endpoints)
    await expect(gateway.deleteOwnEntry(first.id, first.updatedAt, false)).rejects.toThrow(
      /confirmation/,
    )
  })
})
