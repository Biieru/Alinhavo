import { hojeISO } from '@shared/datas'

export type NomeTela = 'hoje' | 'cosplays' | 'cosplay' | 'agenda' | 'compras' | 'oficina'
export type AbaCosplay = 'Peças' | 'Tarefas' | 'Referências' | 'Custos' | 'Diário'

/**
 * Estado da interface: descreve só o que está aberto agora (tela, aba, mês do calendário...).
 * Não é salvo no banco; ao reabrir o app, a interface volta para a tela Hoje.
 */
export const ui: {
  tela: NomeTela
  cosplayId: string | null
  aba: AbaCosplay
  abaCompra: string
  mes: string | null
  dia: string
} = { tela: 'hoje', cosplayId: null, aba: 'Peças', abaCompra: 'A comprar', mes: null, dia: hojeISO() }
