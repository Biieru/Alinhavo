/**
 * Cálculos do app: progresso, próximos prazos, custos e marcos do calendário.
 *
 * Todas as funções recebem o `estado` (e, quando precisam de "hoje", a data de hoje)
 * como parâmetro. Assim não dependem de nada global e podem ser testadas com datas fixas.
 */
import { diasAte, hojeISO } from './datas'
import { numero } from './formato'
import type { Compra, Cosplay, Estado, Evento, Peca, Tarefa } from './tipos'

export const cosplayPorId = (estado: Estado, id: string): Cosplay | undefined => estado.cosplays.find((c) => c.id === id)
export const eventoPorId = (estado: Estado, id: string): Evento | undefined => estado.eventos.find((e) => e.id === id)

/** Lista de etapas do tipo da peça (cada tipo tem a sua). */
export const etapasDe = (estado: Estado, p: Peca): string[] => estado.etapas[p.tipo] || []

/** Progresso em %: etapas concluídas sobre o total de etapas de todas as peças. */
export function progresso(estado: Estado, c: Cosplay): number {
  let feitas = 0
  let total = 0
  c.pecas.forEach((p) => {
    const n = etapasDe(estado, p).length
    total += n
    feitas += Math.min(p.feitas, n)
  })
  return total ? Math.round((feitas / total) * 100) : 0
}

export const pecaPronta = (estado: Estado, p: Peca): boolean => p.feitas >= etapasDe(estado, p).length

/** Texto da situação da peça: "Concluída", "A começar: corte" ou "Etapa atual: costura". */
export function etapaAtual(estado: Estado, p: Peca): string {
  const e = etapasDe(estado, p)
  if (pecaPronta(estado, p)) return 'Concluída'
  return (p.feitas ? 'Etapa atual: ' : 'A começar: ') + e[p.feitas].toLowerCase()
}

export const comprasDe = (estado: Estado, cosplayId: string): Compra[] => estado.compras.filter((i) => i.cosplayId === cosplayId)

/** Eventos de hoje em diante, do mais próximo para o mais distante. */
export const eventosFuturos = (estado: Estado, hoje: string = hojeISO()): Evento[] =>
  estado.eventos.filter((e) => e.data && diasAte(e.data, hoje) >= 0).sort((a, b) => a.data.localeCompare(b.data))

/** Escolhe o projeto em destaque: em produção primeiro e, depois, o de evento mais próximo. */
export function cosplayAtivo(estado: Estado, hoje: string = hojeISO()): Cosplay | null {
  const peso = (c: Cosplay): number => {
    const ev = eventoPorId(estado, c.eventoId)
    return (c.status === 'Em produção' ? 0 : 1e6) + (ev && ev.data ? diasAte(ev.data, hoje) : 5e5)
  }
  const lista = estado.cosplays.filter((c) => !['Pronto', 'Aposentado'].includes(c.status))
  return lista.sort((a, b) => peso(a) - peso(b))[0] || null
}

export interface TarefaComProjeto {
  t: Tarefa
  c: Cosplay
}

/** Junta as tarefas abertas de todos os projetos. Sem prazo vai para o fim. */
export function tarefasAbertas(estado: Estado): TarefaComProjeto[] {
  const r: TarefaComProjeto[] = []
  estado.cosplays.forEach((c) =>
    c.tarefas.forEach((t) => {
      if (!t.feita) r.push({ t, c })
    })
  )
  return r.sort((a, b) => (a.t.prazo || '9999').localeCompare(b.t.prazo || '9999'))
}

export interface ResumoCustos {
  orcamento: number
  previsto: number
  comprado: number
  /** true quando o previsto passa do orçamento (e existe orçamento definido). */
  acima: boolean
  /** Valor absoluto da diferença entre orçamento e previsto. */
  diferenca: number
}

/** Números da aba Custos de um cosplay. */
export function resumoCustos(estado: Estado, c: Cosplay): ResumoCustos {
  const itens = comprasDe(estado, c.id)
  const previsto = itens.reduce((s, i) => s + numero(i.preco), 0)
  const comprado = itens.filter((i) => i.status !== 'A comprar').reduce((s, i) => s + numero(i.preco), 0)
  const orcamento = numero(c.orcamento)
  return { orcamento, previsto, comprado, acima: !!orcamento && previsto > orcamento, diferenca: Math.abs(orcamento - previsto) }
}

/** Soma de preços de uma lista de compras (total mostrado no alto da tela Compras). */
export const totalCompras = (lista: Compra[]): number => lista.reduce((s, i) => s + numero(i.preco), 0)

export interface Marco {
  tipo: 'evento' | 'tarefa' | 'compra'
  id: string
  titulo: string
  info: string
}

/** O que aparece em cada dia do calendário. */
export function marcosDoDia(estado: Estado, iso: string): Marco[] {
  const r: Marco[] = []
  estado.eventos.filter((e) => e.data === iso).forEach((e) => r.push({ tipo: 'evento', id: e.id, titulo: e.nome, info: e.local || 'Evento' }))
  estado.cosplays.forEach((c) =>
    c.tarefas.filter((t) => t.prazo === iso && !t.feita).forEach((t) => r.push({ tipo: 'tarefa', id: c.id, titulo: t.nome, info: c.nome }))
  )
  estado.compras.filter((i) => i.prazo === iso && i.status === 'A comprar').forEach((i) => r.push({ tipo: 'compra', id: i.id, titulo: i.nome, info: 'Comprar' }))
  return r
}

/** Título da tela Hoje: contagem regressiva para o próximo evento. */
export function tituloHoje(estado: Estado, hoje: string = hojeISO()): string {
  const ev = eventosFuturos(estado, hoje)[0]
  if (!ev) return 'Nenhum evento marcado'
  const d = diasAte(ev.data, hoje)
  if (d === 0) return `Hoje é ${ev.nome}`
  return `Falta${d > 1 ? 'm' : ''} ${d} dia${d > 1 ? 's' : ''} para ${ev.nome}`
}
