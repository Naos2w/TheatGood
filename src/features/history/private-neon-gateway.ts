import { z } from 'zod'
import { planInitialCloudHistoryImport } from './cloud-history-contract'
import { decodePrivateWatchLog, encodePrivateWatchLog } from './cloud-history-wire'
import { manualWatchEntrySchema, type ManualWatchEntry } from './manual-history-schema'

export interface PrivateNeonEndpoints {
  authUrl: string
  dataApiUrl: string
}

/**
 * Only branch-specific, public Neon Auth and Data API URLs belong in VITE_ vars.
 * Never include a database connection string or admin API credential in frontend code.
 */
export async function createPrivateNeonGateway(config: PrivateNeonEndpoints) {
  const auth = new URL(config.authUrl)
  const api = new URL(config.dataApiUrl)
  if (
    auth.protocol !== 'https:' ||
    api.protocol !== 'https:' ||
    !auth.hostname.includes('.neonauth.') ||
    !auth.hostname.endsWith('.neon.tech') ||
    !api.hostname.includes('.apirest.') ||
    !api.hostname.endsWith('.neon.tech') ||
    auth.hostname.split('.')[0] !== api.hostname.split('.')[0] ||
    auth.pathname.split('/')[1] !== api.pathname.split('/')[1]
  ) {
    throw new Error('Private Neon gateway requires HTTPS Neon Auth and Data API endpoints')
  }

  // Lazy loading leaves the existing local-only history UI and 3D initial bundle unchanged.
  const { createClient } = await import('@neondatabase/neon-js')
  const neon = createClient({
    auth: { url: auth.toString(), allowAnonymous: false },
    dataApi: { url: api.toString() },
  })

  async function requireSessionUserId(): Promise<string> {
    const { data, error } = await neon.auth.getSession()
    if (error || !data?.user?.id) throw new Error('Private history requires Google sign-in')
    return data.user.id
  }

  async function listOwnEntries(): Promise<ManualWatchEntry[]> {
    const ownerId = await requireSessionUserId()
    // WHERE is useful for readability, but is NOT the authorisation boundary:
    // the database's JWT-validated RLS is the actual access control.
    const { data, error } = await neon
      .from('watch_logs')
      .select(
        'id,user_id,movie_title,watched_on,cinema_slug,cinema_name,auditorium_name,seat_label,local_model_id,local_model_version,manual_entry,screening_id,created_at,updated_at',
      )
      .eq('user_id', ownerId)
      .order('watched_on', { ascending: false })
      .limit(2000)
    if (error || !data) throw new Error('Private history could not be loaded')
    return data.map((row) => decodePrivateWatchLog(row, ownerId))
  }

  async function planOwnInitialImport(localEntries: unknown, userConfirmed: boolean) {
    const ownerId = await requireSessionUserId()
    if (!userConfirmed) {
      return planInitialCloudHistoryImport({
        authenticatedOwnerId: ownerId,
        userConfirmed: false,
        localEntries: [],
        remoteRecords: [],
      })
    }
    const remoteEntries = await listOwnEntries()
    return planInitialCloudHistoryImport({
      authenticatedOwnerId: ownerId,
      userConfirmed: true,
      localEntries,
      remoteRecords: remoteEntries.map((entry) => ({ ownerId, entry })),
    })
  }

  /**
   * Explicit opt-in only. A re-check and single batch INSERT prevent silent
   * last-write-wins behaviour. UNIQUE collisions fail rather than overwrite.
   * Browser localStorage is never edited or deleted by this gateway.
   */
  async function uploadMissingEntries(localEntries: unknown, userConfirmed: boolean) {
    const plan = await planOwnInitialImport(localEntries, userConfirmed)
    if (plan.status !== 'ready') return { status: plan.status, uploaded: 0 }
    if (plan.conflicts.length) {
      return { status: 'conflicts' as const, uploaded: 0, conflicts: plan.conflicts }
    }
    if (plan.uploads.length === 0) return { status: 'unchanged' as const, uploaded: 0 }
    const { data, error } = await neon
      .from('watch_logs')
      .insert(plan.uploads.map(encodePrivateWatchLog))
      .select('id')
    if (error || data?.length !== plan.uploads.length) {
      throw new Error('Private history import failed without clearing local records')
    }
    return { status: 'uploaded' as const, uploaded: data.length }
  }

  async function updateOwnEntry(input: unknown, expectedUpdatedAt: string) {
    const ownerId = await requireSessionUserId()
    const entry = manualWatchEntrySchema.parse(input)
    const expected = z.iso.datetime().parse(expectedUpdatedAt)
    const values = Object.fromEntries(
      Object.entries(encodePrivateWatchLog(entry)).filter(
        ([field]) => field !== 'id' && field !== 'created_at',
      ),
    )
    const { data, error } = await neon
      .from('watch_logs')
      .update(values)
      .eq('id', entry.id)
      .eq('user_id', ownerId)
      .eq('updated_at', expected)
      .select('id')
    if (error || data?.length !== 1) {
      throw new Error('Cloud record changed or update not authorised')
    }
  }

  async function deleteOwnEntry(id: string, expectedUpdatedAt: string, userConfirmed: boolean) {
    if (!userConfirmed) throw new Error('Deletion requires explicit confirmation')
    const ownerId = await requireSessionUserId()
    const recordId = z.string().uuid().parse(id)
    const expected = z.iso.datetime().parse(expectedUpdatedAt)
    const { data, error } = await neon
      .from('watch_logs')
      .delete()
      .eq('id', recordId)
      .eq('user_id', ownerId)
      .eq('updated_at', expected)
      .select('id')
    if (error || data?.length !== 1) {
      throw new Error('Cloud record changed or deletion not authorised')
    }
  }

  return {
    getSession: () => neon.auth.getSession(),
    signInWithGoogle: () =>
      neon.auth.signIn.social({ provider: 'google', callbackURL: '/history' }),
    signOut: () => neon.auth.signOut(),
    listOwnEntries,
    planOwnInitialImport,
    uploadMissingEntries,
    updateOwnEntry,
    deleteOwnEntry,
  }
}
