import { describe, expect, it } from 'vitest'

import { discoverHerdr } from './discovery.js'

describe('Herdr discovery', () => {
  it('discovers a compatible running server', async () => {
    await expect(
      discoverHerdr(async () =>
        JSON.stringify({
        running: true,
        version: '0.8.2',
        protocol: 20,
        compatible: true,
        socket: '/tmp/herdr.sock',
        }),
      ),
    ).resolves.toEqual({
      socketPath: '/tmp/herdr.sock',
      version: '0.8.2',
      protocol: 20,
    })
  })

  it('reports a stopped server and incompatible protocol explicitly', async () => {
    await expect(
      discoverHerdr(async () =>
        JSON.stringify({
          running: false,
          version: '0.8.2',
          protocol: 20,
          compatible: true,
          socket: null,
        }),
      ),
    ).rejects.toMatchObject({
      code: 'herdr_not_running',
    })

    await expect(
      discoverHerdr(async () =>
        JSON.stringify({
          running: true,
          version: '0.9.0',
          protocol: 21,
          compatible: false,
          socket: '/tmp/herdr.sock',
        }),
      ),
    ).rejects.toMatchObject({
      code: 'protocol_incompatible',
    })
  })

  it('distinguishes a missing Herdr binary', async () => {
    await expect(
      discoverHerdr(async () => {
        throw { code: 'ENOENT' }
      }),
    ).rejects.toMatchObject({ code: 'herdr_missing' })
  })
})
