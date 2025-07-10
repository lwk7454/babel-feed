import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'bun:test'
import { setupTestDatabase, cleanupTestDatabase, clearTestData } from '@babel-feed/pgdb'
import { AdminAPIServer } from '../api/admin-api'

let server: AdminAPIServer

beforeAll(async () => {
  await setupTestDatabase()
})

afterAll(async () => {
  await cleanupTestDatabase()
})

beforeEach(async () => {
  await clearTestData()
  server = new AdminAPIServer()
  await server.initialize()
})

describe('Admin API', () => {
  it('creates, retrieves and deletes a source', async () => {
    const body = {
      name: 'Source One', slug: 'source-one', url: 'https://ex.com/rss',
      sourceType: 'rss', language: 'en', category: 'gen', tags: [],
      enabled: true, pollingInterval: 60000, reliability: 90, priority: 5,
      metadata: {}
    }
    const res = await server.handle(new Request('http://localhost/admin/sources', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
    expect(res.status).toBe(200)
    const created = await res.json()

    const getRes = await server.handle(new Request(`http://localhost/admin/sources/${created.id}`))
    expect(getRes.status).toBe(200)
    const fetched = await getRes.json()
    expect(fetched.name).toBe('Source One')

    const del = await server.handle(new Request(`http://localhost/admin/sources/${created.id}`, { method: 'DELETE' }))
    expect(del.status).toBe(200)
  })

  it('bulk enable/disable', async () => {
    const base = {
      name: 'S', slug: 's', url: 'http://e.com', sourceType: 'rss' as "rss", language: 'en', category: 'gen', tags: [], enabled: true, pollingInterval: 60000, reliability: 90, priority: 5, metadata: {}
    }
    for (let i = 0; i < 2; i++) {
      await server['sourceManager'].createSource({ ...base, name: `S${i}`, slug: `s${i}`, url: `http://e${i}.com/rss` })
    }
    const inserted = await server['sourceManager'].getSourcesByLanguage('en')
    const ids = inserted.map(s => s.id as string)
    await server.handle(new Request('http://localhost/admin/sources/bulk-disable', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }) }))
    const afterDisable = await Promise.all(ids.map(id => server['sourceManager'].getSourceById(id)))
    expect(afterDisable.every(s => s?.enabled === false)).toBe(true)
    await server.handle(new Request('http://localhost/admin/sources/bulk-enable', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }) }))
    const afterEnable = await Promise.all(ids.map(id => server['sourceManager'].getSourceById(id)))
    expect(afterEnable.every(s => s?.enabled === true)).toBe(true)
  })
})


