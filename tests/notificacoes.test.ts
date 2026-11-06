import { describe, expect, it } from 'vitest'
import { abrirBanco } from '../src/main/banco/conexao'
import { gravarEstado } from '../src/main/banco/repositorio'
import { processarNotificacoes } from '../src/main/notificacoes'
import type { Notificacao } from '../src/shared/avisos'
import { estadoBase, pastasDeTeste } from './ajuda'

describe('notificações: sem repetição', () => {
  async function ambiente() {
    const p = pastasDeTeste()
    const db = await abrirBanco(p.banco)
    const e = estadoBase()
    e.compras = [{ id: 'cp', nome: 'Tecido', cosplayId: e.cosplays[0].id, status: 'A comprar', preco: 10, loja: '', prazo: '2026-06-16', link: '' }]
    e.cosplays[0].tarefas = [{ id: 'tf', nome: 'Cortar', pecaId: '', prazo: '2026-06-01', minutos: 0, feita: false }]
    gravarEstado(db, e)
    return { p, db }
  }
  const coletar = () => {
    const vistas: Notificacao[] = []
    return { vistas, mostrar: (n: Notificacao) => void vistas.push(n) }
  }

  it('envia resumo, compra e tarefa atrasada uma vez; chamar de novo no mesmo dia não repete', async () => {
    const { db } = await ambiente()
    const a = coletar()
    processarNotificacoes(db, new Date(2026, 5, 15, 19, 0), a.mostrar)
    expect(a.vistas.map((n) => n.tipo).sort()).toEqual(['compra', 'resumo', 'tarefa'])

    const b = coletar()
    processarNotificacoes(db, new Date(2026, 5, 15, 19, 1), b.mostrar)
    processarNotificacoes(db, new Date(2026, 5, 15, 23, 0), b.mostrar)
    expect(b.vistas).toEqual([])
    db.close()
  })

  it('reiniciar o app (fechar e reabrir o banco) não repete as notificações do dia', async () => {
    const { p, db } = await ambiente()
    processarNotificacoes(db, new Date(2026, 5, 15, 19, 0), () => undefined)
    db.close()

    const db2 = await abrirBanco(p.banco)
    const c = coletar()
    processarNotificacoes(db2, new Date(2026, 5, 15, 19, 30), c.mostrar)
    expect(c.vistas).toEqual([])
    db2.close()
  })

  it('no dia seguinte, o resumo e os avisos que continuam valendo voltam uma vez', async () => {
    const { db } = await ambiente()
    processarNotificacoes(db, new Date(2026, 5, 15, 19, 0), () => undefined)
    const c = coletar()
    processarNotificacoes(db, new Date(2026, 5, 16, 19, 0), c.mostrar)
    expect(c.vistas.map((n) => n.chave).sort()).toEqual(['compra:cp:2026-06-16', 'resumo:2026-06-16', 'tarefa:tf:2026-06-16'])
    db.close()
  })

  it('app aberto depois do horário ainda envia as notificações do dia; antes do horário não envia nada', async () => {
    const { db } = await ambiente()
    const cedo = coletar()
    processarNotificacoes(db, new Date(2026, 5, 15, 18, 59), cedo.mostrar)
    expect(cedo.vistas).toEqual([])
    const tarde = coletar()
    processarNotificacoes(db, new Date(2026, 5, 15, 22, 40), tarde.mostrar)
    expect(tarde.vistas).toHaveLength(3)
    db.close()
  })

  it('um erro ao mostrar uma notificação não impede as outras', async () => {
    const { db } = await ambiente()
    const vistas: string[] = []
    processarNotificacoes(db, new Date(2026, 5, 15, 19, 0), (n) => {
      if (n.tipo === 'resumo') throw new Error('falha do Windows')
      vistas.push(n.tipo)
    })
    expect(vistas.sort()).toEqual(['compra', 'tarefa'])
    db.close()
  })

  it('compra marcada como "A caminho" deixa de gerar aviso', async () => {
    const { db } = await ambiente()
    const e = estadoBase()
    e.compras = [{ id: 'cp', nome: 'Tecido', cosplayId: e.cosplays[0].id, status: 'A caminho', preco: 10, loja: '', prazo: '2026-06-16', link: '' }]
    gravarEstado(db, e)
    const c = coletar()
    processarNotificacoes(db, new Date(2026, 5, 15, 19, 0), c.mostrar)
    expect(c.vistas.map((n) => n.tipo)).toEqual(['resumo'])
    db.close()
  })
})
