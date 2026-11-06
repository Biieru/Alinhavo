import type Database from 'better-sqlite3'
import { dadosIniciais } from '@shared/dados-iniciais'
import { TIPOS_CHAVES, VERSAO_ESTADO } from '@shared/constantes'
import { fotosUsadas } from '@shared/validacao'
import type { Compra, Cosplay, Estado, Evento, Medida, NotaDiario, Peca, Referencia, StatusCompra, StatusCosplay, Tarefa, TipoPeca } from '@shared/tipos'

/**
 * Leitura e gravação do Estado no SQLite.
 *
 * O app trabalha com o estado inteiro (como o protótipo), então a gravação troca TODO o conteúdo
 * dentro de uma única transação: se qualquer inserção falhar, o SQLite desfaz tudo e os dados
 * anteriores continuam intactos.
 */

// ---------- Leitura ----------

type Linha = Record<string, string | number>

function meta(db: Database.Database, chave: string): string | undefined {
  const r = db.prepare('SELECT valor FROM meta WHERE chave = ?').get(chave) as { valor: string } | undefined
  return r?.valor
}

/** Agrupa linhas filhas pelo id do cosplay. */
function agrupar<T>(linhas: Linha[], criar: (l: Linha) => T): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const l of linhas) {
    const lista = m.get(String(l.cosplay_id)) ?? []
    lista.push(criar(l))
    m.set(String(l.cosplay_id), lista)
  }
  return m
}

export function lerEstado(db: Database.Database): Estado {
  const todas = (tabela: string): Linha[] => db.prepare(`SELECT * FROM ${tabela} ORDER BY posicao`).all() as Linha[]

  const pecas = agrupar<Peca>(todas('pecas'), (l) => ({ id: String(l.id), nome: String(l.nome), tipo: l.tipo as TipoPeca, feitas: Number(l.feitas), nota: String(l.nota) }))
  const tarefas = agrupar<Tarefa>(todas('tarefas'), (l) => ({
    id: String(l.id),
    nome: String(l.nome),
    pecaId: String(l.peca_id),
    prazo: String(l.prazo),
    minutos: Number(l.minutos),
    feita: Number(l.feita) === 1
  }))
  const referencias = agrupar<Referencia>(todas('referencias'), (l) => ({ id: String(l.id), arquivo: String(l.arquivo), nota: String(l.nota) }))
  const diario = agrupar<NotaDiario>(todas('diario'), (l) => ({ id: String(l.id), data: String(l.data), texto: String(l.texto), arquivo: String(l.arquivo) }))

  const etapas = {} as Record<TipoPeca, string[]>
  for (const tipo of TIPOS_CHAVES) etapas[tipo] = []
  for (const l of db.prepare('SELECT * FROM etapas ORDER BY tipo, posicao').all() as Linha[]) etapas[l.tipo as TipoPeca]?.push(String(l.nome))

  const cosplays: Cosplay[] = todas('cosplays').map((l) => ({
    id: String(l.id),
    nome: String(l.nome),
    obra: String(l.obra),
    status: l.status as StatusCosplay,
    orcamento: Number(l.orcamento),
    eventoId: String(l.evento_id),
    pecas: pecas.get(String(l.id)) ?? [],
    tarefas: tarefas.get(String(l.id)) ?? [],
    referencias: referencias.get(String(l.id)) ?? [],
    diario: diario.get(String(l.id)) ?? []
  }))

  const eventos: Evento[] = todas('eventos').map((l) => ({ id: String(l.id), nome: String(l.nome), data: String(l.data), local: String(l.local) }))
  const compras: Compra[] = todas('compras').map((l) => ({
    id: String(l.id),
    nome: String(l.nome),
    cosplayId: String(l.cosplay_id),
    status: l.status as StatusCompra,
    preco: Number(l.preco),
    loja: String(l.loja),
    prazo: String(l.prazo),
    link: String(l.link)
  }))
  const medidas: Medida[] = todas('medidas').map((l) => ({ id: String(l.id), grupo: String(l.grupo), nome: String(l.nome), valor: String(l.valor) }))

  return {
    versao: VERSAO_ESTADO,
    atualizadoEm: Number(meta(db, 'atualizadoEm') ?? 0),
    etapas,
    cosplays,
    eventos,
    compras,
    medidas,
    avisos: { hora: meta(db, 'avisos.hora') ?? '19:00', diasCompra: Number(meta(db, 'avisos.diasCompra') ?? 3) }
  }
}

// ---------- Gravação ----------

const TABELAS_APAGAR = ['compras', 'eventos', 'medidas', 'etapas', 'cosplays'] as const // "cosplays" leva peças, tarefas etc. por cascata.

/** Troca todo o conteúdo do banco pelo estado dado, tudo ou nada (transação única). */
export function gravarEstado(db: Database.Database, estado: Estado): void {
  const executar = db.transaction((e: Estado) => {
    for (const t of TABELAS_APAGAR) db.prepare(`DELETE FROM ${t}`).run()

    const setMeta = db.prepare('INSERT OR REPLACE INTO meta (chave, valor) VALUES (?, ?)')
    setMeta.run('atualizadoEm', String(e.atualizadoEm))
    setMeta.run('avisos.hora', e.avisos.hora)
    setMeta.run('avisos.diasCompra', String(e.avisos.diasCompra))

    const insEtapa = db.prepare('INSERT INTO etapas (tipo, posicao, nome) VALUES (?, ?, ?)')
    for (const tipo of TIPOS_CHAVES) e.etapas[tipo].forEach((nome, i) => insEtapa.run(tipo, i, nome))

    const insCosplay = db.prepare('INSERT INTO cosplays (id, posicao, nome, obra, status, orcamento, evento_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    const insPeca = db.prepare('INSERT INTO pecas (id, cosplay_id, posicao, nome, tipo, feitas, nota) VALUES (?, ?, ?, ?, ?, ?, ?)')
    const insTarefa = db.prepare('INSERT INTO tarefas (id, cosplay_id, posicao, nome, peca_id, prazo, minutos, feita) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    const insRef = db.prepare('INSERT INTO referencias (id, cosplay_id, posicao, arquivo, nota) VALUES (?, ?, ?, ?, ?)')
    const insDiario = db.prepare('INSERT INTO diario (id, cosplay_id, posicao, data, texto, arquivo) VALUES (?, ?, ?, ?, ?, ?)')
    e.cosplays.forEach((c, i) => {
      insCosplay.run(c.id, i, c.nome, c.obra, c.status, c.orcamento, c.eventoId)
      c.pecas.forEach((p, j) => insPeca.run(p.id, c.id, j, p.nome, p.tipo, p.feitas, p.nota))
      c.tarefas.forEach((t, j) => insTarefa.run(t.id, c.id, j, t.nome, t.pecaId, t.prazo, t.minutos, t.feita ? 1 : 0))
      c.referencias.forEach((r, j) => insRef.run(r.id, c.id, j, r.arquivo, r.nota))
      c.diario.forEach((n, j) => insDiario.run(n.id, c.id, j, n.data, n.texto, n.arquivo))
    })

    const insEvento = db.prepare('INSERT INTO eventos (id, posicao, nome, data, local) VALUES (?, ?, ?, ?, ?)')
    e.eventos.forEach((v, i) => insEvento.run(v.id, i, v.nome, v.data, v.local))

    const insCompra = db.prepare('INSERT INTO compras (id, posicao, nome, cosplay_id, status, preco, loja, prazo, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    e.compras.forEach((c, i) => insCompra.run(c.id, i, c.nome, c.cosplayId, c.status, c.preco, c.loja, c.prazo, c.link))

    const insMedida = db.prepare('INSERT INTO medidas (id, posicao, grupo, nome, valor) VALUES (?, ?, ?, ?, ?)')
    e.medidas.forEach((m, i) => insMedida.run(m.id, i, m.grupo, m.nome, m.valor))
  })
  executar(estado)
}

/**
 * Carga inicial: só na primeira vez em que o banco é criado. Depois de gravada a marca
 * "semente", o projeto do Gambit não volta se a pessoa o excluir.
 */
export function semearSeNecessario(db: Database.Database): boolean {
  if (meta(db, 'semente_aplicada')) return false
  db.transaction(() => {
    const existe = (db.prepare('SELECT COUNT(*) AS n FROM cosplays').get() as { n: number }).n > 0
    if (!existe) gravarEstado(db, dadosIniciais())
    db.prepare('INSERT OR REPLACE INTO meta (chave, valor) VALUES (?, ?)').run('semente_aplicada', '1')
  })()
  return true
}

/** Nomes de foto referenciados no banco (para limpar arquivos sem uso). */
export const fotosReferenciadas = (db: Database.Database): Set<string> => fotosUsadas(lerEstado(db))

// ---------- Notificações já enviadas ----------

/**
 * Registra que uma notificação foi enviada. Devolve true se era nova (pode enviar)
 * e false se já tinha sido registrada antes (não enviar de novo).
 */
export function registrarAvisoEnviado(db: Database.Database, chave: string, agora: number): boolean {
  return db.prepare('INSERT OR IGNORE INTO avisos_enviados (chave, enviado_em) VALUES (?, ?)').run(chave, agora).changes === 1
}

/** Apaga registros com mais de 60 dias, só para a tabela não crescer para sempre. */
export function limparAvisosAntigos(db: Database.Database, agora: number): void {
  db.prepare('DELETE FROM avisos_enviados WHERE enviado_em < ?').run(agora - 60 * 86400000)
}
