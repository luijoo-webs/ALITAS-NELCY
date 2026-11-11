import { describe, expect, it } from 'vitest'
import { bogotaRange } from './admin'

describe('bogotaRange', () => {
  it('"hoy" a las 9 p. m. de Bogotá (ya es mañana en UTC) sigue siendo el mismo día local', () => {
    const { from, to } = bogotaRange(1, new Date('2026-11-12T02:00:00Z')) // 11 nov 21:00 Bogotá
    expect(from.toISOString()).toBe('2026-11-11T05:00:00.000Z')
    expect(to.toISOString()).toBe('2026-11-12T05:00:00.000Z')
  })

  it('7 días incluye hoy y los 6 anteriores', () => {
    const { from, to } = bogotaRange(7, new Date('2026-11-11T15:00:00Z'))
    expect(from.toISOString()).toBe('2026-11-05T05:00:00.000Z')
    expect(to.toISOString()).toBe('2026-11-12T05:00:00.000Z')
  })
})
