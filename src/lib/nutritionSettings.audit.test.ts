import { describe, expect, it } from 'vitest'
import { describeAuditEvent } from './nutritionSettings'

const event = (metadata: Record<string, unknown>) => ({ id: 1, action: 'nutrition.parameters.publish', actorUserId: null, actorEmail: null, createdAt: '2026-11-15T12:00:00.000Z', metadata })

describe('describeAuditEvent for the giant breed lists', () => {
  it('says which breeds came in and went out instead of printing both lists', () => {
    const { details } = describeAuditEvent(event({
      from_set_id: 4,
      to_set_id: 5,
      reason: 'racas_gigantes',
      changes: [{ field: 'breed_groups.dogue', from: 'dogue alemao, greyhound, borzoi', to: 'dogue alemao, akita, rottweiler, kuvasz, kars dog, tosa inu, sabujo' }],
    }))

    expect(details).toEqual([
      'Substituiu o conjunto #4.',
      'Listas de raças gigantes completadas com as raças de adulto acima de 40 kg.',
      'Dogue e demais gigantes: incluiu 6 (akita, rottweiler, kuvasz, kars dog e mais 2); removeu 2 (greyhound, borzoi)',
    ])
  })
})
