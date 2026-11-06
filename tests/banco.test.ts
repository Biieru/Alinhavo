import { describe, expect, it } from 'vitest'
import { abrirBanco } from '../src/main/banco/conexao'
import { gravarEstado, lerEstado, registrarAvisoEnviado, limparAvisosAntigos } from '../src/main/banco/repositorio'
import type { Estado } from '../src/shared/tipos'
import { estadoBase, pastasDeTeste } from './ajuda'

/** Estado com um pouco de tudo, para testar a ida e a volta pelo banco. */
function estadoCompleto(): Estado {
  const e = estadoBase()
  const c = e.cosplays[0]
  c.orcamento = 450.75
  c.eventoId = 'ev1'
  c.pecas[0].feitas = 2
  c.pecas[0].nota = 'Usar tecido "elastano"\ncom forro'
  c.tarefas = [{ id: 't1', nome: 'Cortar', pecaId: c.pecas[0].id, prazo: '2026-07-01', minutos: 90, feita: true }]
  c.referencias = [{ id: 'r1', arquivo: 'abc.jpg', nota: 'frente' }]
  c.diario = [{ id: 'n1', data: '2026-06-01', texto: 'Hoje costurei', arquivo: 'def.png' }]
  e.eventos = [{ id: 'ev1', nome: 'Anime Friends', data: '2026-07-20', local: 'São Paulo' }]
  e.compras = [{ id: 'cp1', nome: 'Tecido', cosplayId: c.id, status: 'A caminho', preco: 59.9, loja: 'Armarinho', prazo: '2026-06-30', link: 'https://exemplo.com/x?a=1&b=2' }]
  e.medidas[0].valor = '172'
  e.avisos = { hora: '08:15', diasCompra: 5 }
  e.atualizadoEm = 1234567890
  e.etapas.arma = ['Núcleo', 'Forma']
  return e
}

describe('banco de dados', () => {
  it('guarda e devolve o estado completo, sem perder nada (incluindo acentos e quebras de linha)', async () => {
    const db = await abrirBanco(pastasDeTeste().banco)
    const e = estadoCompleto()
    gravarEstado(db, e)
    expect(lerEstado(db)).toEqual(e)
    db.close()
  })

  it('mantém a ordem dos itens', async () => {
    const db = await abrirBanco(pastasDeTeste().banco)
    const e = estadoCompleto()
    e.cosplays[0].pecas.reverse()
    gravarEstado(db, e)
    expect(lerEstado(db).cosplays[0].pecas.map((p) => p.id)).toEqual(e.cosplays[0].pecas.map((p) => p.id))
    db.close()
  })

  it('os dados sobrevivem a fechar e reabrir o banco', async () => {
    const p = pastasDeTeste()
    const db = await abrirBanco(p.banco)
    gravarEstado(db, estadoCompleto())
    db.close()
    const db2 = await abrirBanco(p.banco)
    expect(lerEstado(db2)).toEqual(estadoCompleto())
    db2.close()
  })

  it('gravação com erro no meio desfaz tudo: os dados anteriores continuam intactos', async () => {
    const db = await abrirBanco(pastasDeTeste().banco)
    const bom = estadoCompleto()
    gravarEstado(db, bom)

    // Estado "estragado" que só quebra no meio da gravação: dois itens com o mesmo id
    // (a validação normal o barraria; aqui é pulada de propósito para simular uma falha do banco).
    const estragado = estadoCompleto()
    estragado.cosplays[0].nome = 'NÃO PODE FICAR'
    estragado.compras = [
      { ...bom.compras[0], nome: 'Primeiro' },
      { ...bom.compras[0], nome: 'Repetido' }
    ]
    expect(() => gravarEstado(db, estragado)).toThrow()
    expect(lerEstado(db)).toEqual(bom)
    db.close()
  })

  it('apagar um cosplay leva junto peças, tarefas, referências e diário (cascata)', async () => {
    const db = await abrirBanco(pastasDeTeste().banco)
    const e = estadoCompleto()
    gravarEstado(db, e)
    e.cosplays = []
    gravarEstado(db, e)
    for (const t of ['pecas', 'tarefas', 'referencias', 'diario']) {
      expect((db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n).toBe(0)
    }
    db.close()
  })

  it('registra notificações enviadas sem repetir e limpa registros antigos', async () => {
    const db = await abrirBanco(pastasDeTeste().banco)
    const agora = Date.UTC(2026, 5, 15)
    expect(registrarAvisoEnviado(db, 'resumo:2026-06-15', agora)).toBe(true)
    expect(registrarAvisoEnviado(db, 'resumo:2026-06-15', agora)).toBe(false)
    expect(registrarAvisoEnviado(db, 'resumo:2026-06-16', agora)).toBe(true)
    registrarAvisoEnviado(db, 'velho', agora - 90 * 86400000)
    limparAvisosAntigos(db, agora)
    expect((db.prepare('SELECT chave FROM avisos_enviados ORDER BY chave').all() as { chave: string }[]).map((r) => r.chave)).toEqual(['resumo:2026-06-15', 'resumo:2026-06-16'])
    db.close()
  })
})
