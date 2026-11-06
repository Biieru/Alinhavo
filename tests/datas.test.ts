import { describe, expect, it } from 'vitest'
import { dataCurta, dataLonga, dataValida, deISO, diasAte, hojeISO, horaDe, horaValida, paraISO } from '../src/shared/datas'

describe('datas', () => {
  it('converte Date em AAAA-MM-DD e de volta, sem mexer no dia', () => {
    expect(paraISO(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(paraISO(deISO('2026-12-31'))).toBe('2026-12-31')
    expect(deISO('2026-03-09').getDate()).toBe(9)
  })

  it('hojeISO usa o "agora" informado (fuso local, sem virar o dia por causa de UTC)', () => {
    expect(hojeISO(new Date(2026, 5, 15, 23, 59, 59))).toBe('2026-06-15')
    expect(hojeISO(new Date(2026, 5, 15, 0, 0, 1))).toBe('2026-06-15')
  })

  it('diasAte conta dias de calendário, inclusive virando mês e ano', () => {
    expect(diasAte('2026-06-15', '2026-06-15')).toBe(0)
    expect(diasAte('2026-06-16', '2026-06-15')).toBe(1)
    expect(diasAte('2026-06-10', '2026-06-15')).toBe(-5)
    expect(diasAte('2027-01-01', '2026-12-31')).toBe(1)
    expect(diasAte('2026-03-01', '2026-02-28')).toBe(1) // 2026 não é bissexto
    expect(diasAte('2028-03-01', '2028-02-28')).toBe(2) // 2028 é bissexto (29 de fevereiro)
  })

  it('formata datas em português', () => {
    expect(dataCurta('2026-03-05')).toBe('5 mar')
    expect(dataLonga('2026-03-05')).toBe('5 de março')
    expect(dataLonga('2026-12-25')).toBe('25 de dezembro')
  })

  it('valida datas reais e horários', () => {
    expect(dataValida('2026-02-28')).toBe(true)
    expect(dataValida('2026-02-30')).toBe(false)
    expect(dataValida('2024-02-29')).toBe(true)
    expect(dataValida('26-02-28')).toBe(false)
    expect(dataValida('')).toBe(false)
    expect(dataValida(null)).toBe(false)
    expect(horaValida('19:00')).toBe(true)
    expect(horaValida('24:00')).toBe(false)
    expect(horaValida('7:00')).toBe(false)
  })

  it('horaDe devolve HH:MM com zeros à esquerda', () => {
    expect(horaDe(new Date(2026, 0, 1, 7, 5))).toBe('07:05')
    expect(horaDe(new Date(2026, 0, 1, 19, 0))).toBe('19:00')
  })
})
