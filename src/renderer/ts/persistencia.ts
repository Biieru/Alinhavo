import { api } from './api'
import { avisar } from './aviso'
import { estado } from './estado'

/**
 * Salvamento dos dados.
 *
 * Regra do app (igual ao protótipo): toda alteração termina em `salvar()`.
 * - Os salvamentos são ENFILEIRADOS: nunca há dois ao mesmo tempo, para uma versão antiga
 *   jamais ultrapassar uma nova.
 * - Se vários pedidos chegarem enquanto um salvamento está em andamento, basta um só salvamento
 *   depois (com o estado mais recente).
 * - Se o salvamento falhar, a pessoa é avisada; o próximo `salvar()` tenta de novo com tudo.
 */
let andamento: Promise<void> | null = null
let pendente = false

async function ciclo(): Promise<void> {
  while (pendente) {
    pendente = false
    try {
      const r = await api.salvarEstado(estado)
      if (!r.ok) avisar(`Não foi possível salvar: ${r.erro}`)
    } catch {
      avisar('Não foi possível salvar agora. Tente de novo.')
    }
  }
  andamento = null
}

export function salvar(): void {
  estado.atualizadoEm = Date.now()
  pendente = true
  if (!andamento) andamento = ciclo()
}

/** Espera os salvamentos pendentes terminarem (usado antes de exportar ou importar um backup). */
export async function aguardarSalvamentos(): Promise<void> {
  while (andamento) await andamento
}
