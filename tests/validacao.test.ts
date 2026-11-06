import { describe, expect, it } from 'vitest'
import { fotosUsadas, normalizarEstado, ErroValidacao } from '../src/shared/validacao'
import { estadoBase } from './ajuda'

describe('validação do estado', () => {
  it('aceita o estado inicial e devolve uma cópia equivalente', () => {
    const e = estadoBase()
    const r = normalizarEstado(e)
    expect(r).toEqual(e)
    expect(r).not.toBe(e)
  })

  it('rejeita lixo com mensagem em português', () => {
    expect(() => normalizarEstado(null)).toThrow(ErroValidacao)
    expect(() => normalizarEstado({})).toThrow('Esse arquivo não é um backup do Alinhavo.')
    expect(() => normalizarEstado({ cosplays: 'x', etapas: {} })).toThrow(ErroValidacao)
  })

  it('rejeita ids repetidos, datas inventadas, tipos e situações desconhecidos', () => {
    const repetido = estadoBase()
    repetido.cosplays[0].pecas[1].id = repetido.cosplays[0].pecas[0].id
    expect(() => normalizarEstado(repetido)).toThrow('Identificador repetido')

    const data = estadoBase()
    data.eventos = [{ id: 'e', nome: 'X', data: '2026-02-30', local: '' }]
    expect(() => normalizarEstado(data)).toThrow('Data inválida')

    const tipo = estadoBase()
    // @ts-expect-error valor inválido de propósito
    tipo.cosplays[0].pecas[0].tipo = 'magia'
    expect(() => normalizarEstado(tipo)).toThrow('Valor inválido')

    const status = estadoBase()
    // @ts-expect-error valor inválido de propósito
    status.cosplays[0].status = 'Dormindo'
    expect(() => normalizarEstado(status)).toThrow('Valor inválido')
  })

  it('rejeita nomes de foto perigosos', () => {
    for (const ruim of ['../../segredo.jpg', 'a/b.jpg', 'a\\b.jpg', 'C:\\x.jpg', 'foto.exe', '..jpg', '.jpg', 'a..b.jpg']) {
      const e = estadoBase()
      e.cosplays[0].referencias = [{ id: 'r', arquivo: ruim, nota: '' }]
      expect(() => normalizarEstado(e), ruim).toThrow('Nome de foto inválido')
    }
  })

  it('descarta referências sem foto e corrige números e avisos fora do limite', () => {
    const e = estadoBase()
    e.cosplays[0].referencias = [{ id: 'r', arquivo: '', nota: '' }]
    e.cosplays[0].orcamento = -5
    e.avisos = { hora: '99:99', diasCompra: 9999 }
    const r = normalizarEstado(e)
    expect(r.cosplays[0].referencias).toEqual([])
    expect(r.cosplays[0].orcamento).toBe(0)
    expect(r.avisos).toEqual({ hora: '19:00', diasCompra: 365 })
  })

  it('exige que cada lista de etapas tenha ao menos uma etapa', () => {
    const e = estadoBase()
    e.etapas.arma = []
    expect(() => normalizarEstado(e)).toThrow('está vazia')
  })

  it('lista as fotos usadas (referências e diário), sem repetir', () => {
    const e = estadoBase()
    e.cosplays[0].referencias = [{ id: 'r1', arquivo: 'a.jpg', nota: '' }]
    e.cosplays[0].diario = [{ id: 'n1', data: '2026-01-01', texto: 't', arquivo: 'b.png' }, { id: 'n2', data: '2026-01-02', texto: 't', arquivo: 'a.jpg' }]
    expect([...fotosUsadas(e)].sort()).toEqual(['a.jpg', 'b.png'])
  })
})
