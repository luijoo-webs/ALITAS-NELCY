import { describe, expect, it } from 'vitest'
import { toCsv } from './ReportsPage'

describe('toCsv', () => {
  it('usa ; y escapa comillas y separadores', () => {
    expect(toCsv([['a', 1], ['x;y', 'di "hola"']])).toBe('﻿a;1\n"x;y";"di ""hola"""')
  })
})
