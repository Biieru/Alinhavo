import { describe, expect, it } from 'vitest'
import { cosplayAtivo, etapaAtual, eventosFuturos, marcosDoDia, pecaPronta, progresso, tarefasAbertas, tituloHoje } from '../src/shared/calculos'
import { dadosIniciais } from '../src/shared/dados-iniciais'
import { duracao, letraDe, numero, reais } from '../src/shared/formato'
import type { Cosplay } from '../src/shared/tipos'
import { estadoBase } from './ajuda'

describe('progresso', () => {
  it('começa em 0 no projeto inicial do Gambit 97', () => {
    const e = estadoBase()
    expect(e.cosplays).toHaveLength(1)
    expect(e.cosplays[0].nome).toBe('Gambit')
    expect(e.cosplays[0].obra).toBe('X-Men 97')
    expect(progresso(e, e.cosplays[0])).toBe(0)
  })

  it('o projeto inicial não traz dados inventados', () => {
    const e = estadoBase()
    expect(e.eventos).toEqual([])
    expect(e.compras).toEqual([])
    expect(e.cosplays[0].tarefas).toEqual([])
    expect(e.cosplays[0].referencias).toEqual([])
    expect(e.cosplays[0].diario).toEqual([])
    expect(e.cosplays[0].pecas).toHaveLength(12)
    expect(e.medidas.every((m) => m.valor === '')).toBe(true)
    expect(e.avisos).toEqual({ hora: '19:00', diasCompra: 3 })
  })

  it('soma as etapas concluídas sobre o total de todas as peças', () => {
    const e = estadoBase()
    const c = e.cosplays[0]
    // Total de etapas: 5 peças de tecido x 4 + 3 de armadura x 5 + 2 de arma x 4 + 2 de compra x 3 = 49.
    c.pecas.forEach((p) => (p.feitas = 99)) // além do máximo: não pode passar de 100%
    expect(progresso(e, c)).toBe(100)
    c.pecas.forEach((p) => (p.feitas = 0))
    c.pecas[0].feitas = 4 // um sobretudo pronto: 4 de 49 etapas = 8,16%
    expect(progresso(e, c)).toBe(8)
  })

  it('cosplay sem peças tem progresso 0 (sem dividir por zero)', () => {
    const e = estadoBase()
    e.cosplays[0].pecas = []
    expect(progresso(e, e.cosplays[0])).toBe(0)
  })

  it('descreve a etapa atual de cada peça', () => {
    const e = estadoBase()
    const p = e.cosplays[0].pecas[0] // tecido: Molde, Corte, Costura, Acabamento
    expect(etapaAtual(e, p)).toBe('A começar: molde')
    p.feitas = 2
    expect(etapaAtual(e, p)).toBe('Etapa atual: costura')
    p.feitas = 4
    expect(pecaPronta(e, p)).toBe(true)
    expect(etapaAtual(e, p)).toBe('Concluída')
  })

  it('encurtar a lista de etapas não deixa o progresso passar de 100%', () => {
    const e = estadoBase()
    const c = e.cosplays[0]
    c.pecas.forEach((p) => (p.feitas = e.etapas[p.tipo].length))
    e.etapas.tecido = ['Só uma']
    expect(progresso(e, c)).toBe(100)
  })

  it('escolhe o cosplay em destaque: em produção primeiro, depois o evento mais próximo', () => {
    const e = estadoBase()
    const base = e.cosplays[0]
    e.eventos = [
      { id: 'e1', nome: 'Evento perto', data: '2026-07-10', local: '' },
      { id: 'e2', nome: 'Evento longe', data: '2026-12-10', local: '' }
    ]
    const longe: Cosplay = { ...structuredClone(base), id: 'c2', nome: 'Longe', eventoId: 'e2', status: 'Planejando' }
    const perto: Cosplay = { ...structuredClone(base), id: 'c3', nome: 'Perto', eventoId: 'e1', status: 'Planejando' }
    e.cosplays = [longe, perto]
    expect(cosplayAtivo(e, '2026-07-01')?.nome).toBe('Perto')
    longe.status = 'Em produção'
    expect(cosplayAtivo(e, '2026-07-01')?.nome).toBe('Longe')
    longe.status = 'Pronto'
    perto.status = 'Aposentado'
    expect(cosplayAtivo(e, '2026-07-01')).toBeNull()
  })

  it('títulos da tela Hoje: sem evento, hoje, amanhã e daqui a dias', () => {
    const e = estadoBase()
    expect(tituloHoje(e, '2026-07-01')).toBe('Nenhum evento marcado')
    e.eventos = [{ id: 'e1', nome: 'Anime Friends', data: '2026-07-01', local: '' }]
    expect(tituloHoje(e, '2026-07-01')).toBe('Hoje é Anime Friends')
    expect(tituloHoje(e, '2026-06-30')).toBe('Falta 1 dia para Anime Friends')
    expect(tituloHoje(e, '2026-06-20')).toBe('Faltam 11 dias para Anime Friends')
    expect(tituloHoje(e, '2026-07-02')).toBe('Nenhum evento marcado') // evento já passou
  })

  it('eventos passados não entram nos futuros; tarefas sem prazo ficam no fim', () => {
    const e = estadoBase()
    e.eventos = [
      { id: 'a', nome: 'Passado', data: '2026-01-01', local: '' },
      { id: 'b', nome: 'Futuro', data: '2026-09-01', local: '' }
    ]
    expect(eventosFuturos(e, '2026-06-01').map((x) => x.nome)).toEqual(['Futuro'])
    e.cosplays[0].tarefas = [
      { id: 't1', nome: 'Sem prazo', pecaId: '', prazo: '', minutos: 0, feita: false },
      { id: 't2', nome: 'Com prazo', pecaId: '', prazo: '2026-08-01', minutos: 0, feita: false },
      { id: 't3', nome: 'Feita', pecaId: '', prazo: '2026-07-01', minutos: 0, feita: true }
    ]
    expect(tarefasAbertas(e).map((x) => x.t.nome)).toEqual(['Com prazo', 'Sem prazo'])
  })

  it('marcos do dia reúnem eventos, tarefas abertas e compras a comprar', () => {
    const e = estadoBase()
    e.eventos = [{ id: 'e1', nome: 'Evento', data: '2026-08-01', local: 'São Paulo' }]
    e.cosplays[0].tarefas = [{ id: 't1', nome: 'Costurar', pecaId: '', prazo: '2026-08-01', minutos: 0, feita: false }]
    e.compras = [
      { id: 'c1', nome: 'Tecido', cosplayId: e.cosplays[0].id, status: 'A comprar', preco: 10, loja: '', prazo: '2026-08-01', link: '' },
      { id: 'c2', nome: 'Já comprado', cosplayId: e.cosplays[0].id, status: 'Chegou', preco: 10, loja: '', prazo: '2026-08-01', link: '' }
    ]
    expect(marcosDoDia(e, '2026-08-01').map((m) => [m.tipo, m.titulo])).toEqual([
      ['evento', 'Evento'],
      ['tarefa', 'Costurar'],
      ['compra', 'Tecido']
    ])
    expect(marcosDoDia(e, '2026-08-02')).toEqual([])
  })
})

describe('formatação', () => {
  it('reais mostra centavos só quando existem', () => {
    expect(reais(180)).toBe('R$ 180')
    expect(reais(180.5)).toBe('R$ 180,50')
    expect(reais(1234.56)).toBe('R$ 1.234,56')
    expect(reais(undefined)).toBe('R$ 0')
  })

  it('numero aceita vírgula e ponto, e devolve 0 para vazio ou lixo', () => {
    expect(numero('12,50')).toBe(12.5)
    expect(numero('12.50')).toBe(12.5)
    expect(numero('')).toBe(0)
    expect(numero('abc')).toBe(0)
    expect(numero(null)).toBe(0)
  })

  it('duração e letras das peças', () => {
    expect(duracao(0)).toBe('')
    expect(duracao(45)).toBe('45 min')
    expect(duracao(90)).toBe('1 h 30')
    expect(duracao(120)).toBe('2 h')
    expect(letraDe(0)).toBe('A')
    expect(letraDe(25)).toBe('Z')
    expect(letraDe(26)).toBe('AA')
    expect(letraDe(27)).toBe('AB')
  })

  it('dadosIniciais gera ids diferentes a cada chamada', () => {
    expect(dadosIniciais().cosplays[0].id).not.toBe(dadosIniciais().cosplays[0].id)
  })
})
