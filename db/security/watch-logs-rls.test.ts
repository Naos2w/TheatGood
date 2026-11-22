import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'db/security/watch-logs-rls.sql'), 'utf8')

describe('private watch history RLS deployment contract', () => {
  it('derives row ownership from validated Neon JWT, never a public request field', () => {
    expect(sql).toMatch(/ALTER COLUMN user_id SET DEFAULT \(auth\.user_id\(\)\)/)
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/FORCE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.watch_logs FROM PUBLIC/)
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.watch_logs FROM anonymous/)
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.watch_logs TO authenticated/,
    )
  })

  it('requires owner equality for all CRUD operations, including insert and update checks', () => {
    for (const action of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      expect(sql).toMatch(new RegExp('FOR ' + action + ' TO authenticated'))
    }
    expect(sql.match(/user_id = \(SELECT auth\.user_id\(\)\)/g) ?? []).toHaveLength(5)
    expect(sql).not.toMatch(/TO (?:PUBLIC|anonymous)\s+USING/)
  })
})
