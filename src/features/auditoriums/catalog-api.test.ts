import { describe, expect, it } from 'vitest'
import { GET } from '../../../api/cinemas'

describe('public cinema catalogue endpoint', () => {
  it('fails closed without a configured server-side database URL', async () => {
    const previous = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const response = await GET()
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ error: 'catalog_not_configured' })
    } finally {
      if (previous !== undefined) process.env.DATABASE_URL = previous
    }
  })
})
