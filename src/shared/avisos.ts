/**
 * Avisos: a lista que aparece na tela Hoje e que também alimenta as notificações do Windows.
 *
 * A mesma função `gerarAvisos` serve aos dois usos, para a tela e as notificações nunca
 * discordarem entre si.
 */
import { cosplayAtivo, pecaPronta, progresso, tarefasAbertas, tituloHoje } from './calculos'
import { diasAte, hojeISO, horaDe } from './datas'
import type { Aviso, Estado } from './tipos'

/** Compras "A comprar" com prazo próximo e tarefas abertas com prazo vencido. */
export function gerarAvisos(estado: Estado, hoje: string = hojeISO()): Aviso[] {
  const r: Aviso[] = []

  estado.compras.forEach((i) => {
    if (i.status !== 'A comprar' || !i.prazo) return
    const d = diasAte(i.prazo, hoje)
    if (d <= estado.avisos.diasCompra) {
      r.push({
        data: i.prazo,
        rotulo: d < 0 ? 'Compra atrasada' : d === 0 ? 'Comprar hoje' : d === 1 ? 'Comprar até amanhã' : `Comprar em ${d} dias`,
        texto: i.nome,
        tela: 'compras',
        origem: 'compra',
        itemId: i.id
      })
    }
  })

  tarefasAbertas(estado).forEach(({ t, c }) => {
    if (t.prazo && diasAte(t.prazo, hoje) < 0) {
      r.push({ data: t.prazo, rotulo: 'Tarefa atrasada', texto: `${t.nome}, ${c.nome}`, tela: 'cosplay', id: c.id, origem: 'tarefa', itemId: t.id })
    }
  })

  return r.sort((a, b) => a.data.localeCompare(b.data))
}

/** Uma notificação pronta para o Windows. A `chave` impede que ela se repita. */
export interface Notificacao {
  chave: string
  tipo: 'resumo' | 'compra' | 'tarefa' | 'mais'
  titulo: string
  corpo: string
}

/** Máximo de avisos individuais por dia; o resto vira uma notificação única "e mais N". */
export const MAXIMO_INDIVIDUAIS = 5

/**
 * Quais notificações o app deve ter enviado até este momento.
 *
 * Regras:
 * - Nada é enviado antes do horário configurado do resumo diário.
 * - Depois desse horário, cada notificação vale uma vez por dia. A chave inclui a data, então
 *   fechar e reabrir o app não repete, e no dia seguinte ela pode voltar se o aviso continuar.
 * - Se o app estava fechado no horário, a notificação sai assim que o app abre, ainda no mesmo dia.
 *
 * Esta função NÃO sabe o que já foi enviado; quem chama (o agendador) descarta as chaves já registradas.
 */
export function notificacoesDoDia(estado: Estado, agora: Date): Notificacao[] {
  if (horaDe(agora) < estado.avisos.hora) return []
  const hoje = hojeISO(agora)
  const lista: Notificacao[] = []

  // 1) Resumo diário: título igual ao da tela Hoje, mais um parágrafo curto.
  const avisos = gerarAvisos(estado, hoje)
  const abertas = tarefasAbertas(estado).length
  const c = cosplayAtivo(estado, hoje)
  const linhas: string[] = []
  if (c) {
    const restantes = c.pecas.filter((p) => !pecaPronta(estado, p)).length
    const aindaFalta = restantes ? `Falta${restantes > 1 ? 'm' : ''} ${restantes} peça${restantes > 1 ? 's' : ''} para terminar.` : 'Todas as peças prontas.'
    linhas.push(`${c.nome}: ${progresso(estado, c)} de 100. ${aindaFalta}`)
  }
  if (avisos.length) linhas.push(`${avisos.length} aviso${avisos.length > 1 ? 's' : ''} de prazo.`)
  if (abertas) linhas.push(`${abertas} tarefa${abertas > 1 ? 's' : ''} aberta${abertas > 1 ? 's' : ''}.`)
  lista.push({ chave: `resumo:${hoje}`, tipo: 'resumo', titulo: tituloHoje(estado, hoje), corpo: linhas.join('\n') || 'Nada pendente por hoje.' })

  // 2) Prazos de compra e tarefas atrasadas, um por item.
  avisos.slice(0, MAXIMO_INDIVIDUAIS).forEach((a) => {
    lista.push({ chave: `${a.origem}:${a.itemId}:${hoje}`, tipo: a.origem, titulo: a.rotulo, corpo: a.texto })
  })
  const resto = avisos.length - MAXIMO_INDIVIDUAIS
  if (resto > 0) {
    lista.push({ chave: `mais:${hoje}`, tipo: 'mais', titulo: 'Mais avisos no Alinhavo', corpo: `E mais ${resto} aviso${resto > 1 ? 's' : ''} de prazo. Abra o app para ver.` })
  }

  return lista
}
