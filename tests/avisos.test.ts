import { describe, expect, it } from 'vitest'
import { gerarAvisos, MAXIMO_INDIVIDUAIS, notificacoesDoDia } from '../src/shared/avisos'
import type { Compra, Estado } from '../src/shared/tipos'
import { estadoBase } from './ajuda'

const compra = (id: string, prazo: string, status: Compra['status'] = 'A comprar'): Compra => ({ id, nome: `Item ${id}`, cosplayId: 'x', status, preco: 10, loja: '', prazo, link: '' })

function comTarefaAtrasada(e: Estado, prazo: string) {
  e.cosplays[0].tarefas.push({ id: 't1', nome: 'Cortar o capuz', pecaId: '', prazo, minutos: 0, feita: false })
}

describe('avisos', () => {
  it('compra: atrasada, hoje, amanhã e em N dias, dentro da janela de 3 dias', () => {
    const e = estadoBase()
    e.compras = [compra('a', '2026-06-10'), compra('b', '2026-06-15'), compra('c', '2026-06-16'), compra('d', '2026-06-18'), compra('e', '2026-06-19')]
    const r = gerarAvisos(e, '2026-06-15')
    expect(r.map((a) => a.rotulo)).toEqual(['Compra atrasada', 'Comprar hoje', 'Comprar até amanhã', 'Comprar em 3 dias'])
    expect(r.map((a) => a.texto)).toEqual(['Item a', 'Item b', 'Item c', 'Item d']) // "e" está a 4 dias: fora
  })

  it('respeita a configuração de dias antes', () => {
    const e = estadoBase()
    e.avisos.diasCompra = 0
    e.compras = [compra('a', '2026-06-16'), compra('b', '2026-06-15')]
    expect(gerarAvisos(e, '2026-06-15').map((a) => a.texto)).toEqual(['Item b'])
  })

  it('ignora compras sem prazo e compras que já foram pedidas ou chegaram', () => {
    const e = estadoBase()
    e.compras = [compra('a', ''), compra('b', '2026-06-15', 'A caminho'), compra('c', '2026-06-15', 'Chegou')]
    expect(gerarAvisos(e, '2026-06-15')).toEqual([])
  })

  it('tarefa só avisa quando está atrasada (prazo anterior a hoje) e aberta', () => {
    const e = estadoBase()
    comTarefaAtrasada(e, '2026-06-14')
    expect(gerarAvisos(e, '2026-06-15')).toMatchObject([{ rotulo: 'Tarefa atrasada', texto: 'Cortar o capuz, Gambit', tela: 'cosplay' }])
    expect(gerarAvisos(e, '2026-06-14')).toEqual([]) // vence hoje: ainda não está atrasada
    e.cosplays[0].tarefas[0].feita = true
    expect(gerarAvisos(e, '2026-06-15')).toEqual([])
  })

  it('ordena os avisos pela data do prazo', () => {
    const e = estadoBase()
    comTarefaAtrasada(e, '2026-06-12')
    e.compras = [compra('a', '2026-06-10'), compra('b', '2026-06-14')]
    expect(gerarAvisos(e, '2026-06-15').map((a) => a.data)).toEqual(['2026-06-10', '2026-06-12', '2026-06-14'])
  })
})

describe('notificações do dia', () => {
  const as = (h: number, m = 0) => new Date(2026, 5, 15, h, m)

  it('nada antes do horário do resumo diário', () => {
    const e = estadoBase()
    expect(notificacoesDoDia(e, as(18, 59))).toEqual([])
    expect(notificacoesDoDia(e, as(19, 0))).toHaveLength(1)
  })

  it('o resumo diário tem chave por dia, para ser enviado só uma vez', () => {
    const e = estadoBase()
    const [r] = notificacoesDoDia(e, as(20))
    expect(r).toMatchObject({ tipo: 'resumo', chave: 'resumo:2026-06-15' })
    expect(r.titulo).toBe('Nenhum evento marcado')
    expect(r.corpo).toContain('Gambit: 0 de 100. Faltam 12 peças para terminar.')
    expect(notificacoesDoDia(e, new Date(2026, 5, 16, 20))[0].chave).toBe('resumo:2026-06-16')
  })

  it('inclui o resumo com a contagem do evento e uma notificação por prazo de compra e tarefa atrasada', () => {
    const e = estadoBase()
    e.eventos = [{ id: 'ev', nome: 'Anime Friends', data: '2026-06-20', local: '' }]
    e.compras = [compra('a', '2026-06-16')]
    comTarefaAtrasada(e, '2026-06-01')
    const lista = notificacoesDoDia(e, as(19, 30))
    expect(lista[0].chave).toBe('resumo:2026-06-15') // o resumo sempre sai primeiro
    expect(lista.map((n) => n.chave)).toEqual(expect.arrayContaining(['tarefa:t1:2026-06-15', 'compra:a:2026-06-15']))
    expect(lista).toHaveLength(3)
    expect(lista[0].titulo).toBe('Faltam 5 dias para Anime Friends')
    expect(lista.find((n) => n.tipo === 'compra')).toMatchObject({ titulo: 'Comprar até amanhã', corpo: 'Item a' })
    expect(lista.find((n) => n.tipo === 'tarefa')).toMatchObject({ titulo: 'Tarefa atrasada', corpo: 'Cortar o capuz, Gambit' })
    expect(lista[0].corpo).toContain('2 avisos de prazo.')
  })

  it('agrupa o excedente numa única notificação "mais avisos"', () => {
    const e = estadoBase()
    e.compras = Array.from({ length: MAXIMO_INDIVIDUAIS + 3 }, (_, i) => compra(`c${i}`, '2026-06-15'))
    const lista = notificacoesDoDia(e, as(19, 0))
    expect(lista.filter((n) => n.tipo === 'compra')).toHaveLength(MAXIMO_INDIVIDUAIS)
    expect(lista.find((n) => n.tipo === 'mais')).toMatchObject({ chave: 'mais:2026-06-15', corpo: 'E mais 3 avisos de prazo. Abra o app para ver.' })
  })

  it('usa o horário configurado pela pessoa', () => {
    const e = estadoBase()
    e.avisos.hora = '08:30'
    expect(notificacoesDoDia(e, as(8, 29))).toEqual([])
    expect(notificacoesDoDia(e, as(8, 30))).toHaveLength(1)
  })
})
