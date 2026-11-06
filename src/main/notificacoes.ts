import type Database from 'better-sqlite3'
import { notificacoesDoDia, type Notificacao } from '@shared/avisos'
import { lerEstado, limparAvisosAntigos, registrarAvisoEnviado } from './banco/repositorio'

/**
 * Núcleo das notificações, sem nada de Electron (por isso é testável).
 *
 * Para cada notificação que deveria ter saído até agora, tenta REGISTRAR a chave no banco:
 * - registro novo  -> a notificação é entregue a `mostrar`;
 * - já registrada  -> ignorada (é isso que evita repetição ao reiniciar o app).
 * A chave é gravada ANTES de mostrar: se o app cair no meio, é melhor perder uma notificação
 * do que repeti-la.
 */
export function processarNotificacoes(db: Database.Database, agora: Date, mostrar: (n: Notificacao) => void): Notificacao[] {
  const enviadas: Notificacao[] = []
  for (const n of notificacoesDoDia(lerEstado(db), agora)) {
    if (!registrarAvisoEnviado(db, n.chave, agora.getTime())) continue
    enviadas.push(n)
    try {
      mostrar(n)
    } catch {
      /* Uma notificação que falha não pode impedir as outras. */
    }
  }
  limparAvisosAntigos(db, agora.getTime())
  return enviadas
}
