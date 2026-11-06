import type Database from 'better-sqlite3'
import { Notification, powerMonitor } from 'electron'
import { processarNotificacoes } from './notificacoes'
import { registrarLog } from './log'

/**
 * Agendador das notificações do Windows (resumo diário, prazos de compra e tarefas atrasadas).
 *
 * Verifica a cada 30 segundos, ao iniciar e quando o computador volta de suspensão. A decisão do
 * que enviar (e de não repetir) está em `processarNotificacoes`; aqui só entra o lado Electron.
 */
export function iniciarAgendador(db: Database.Database, icone: string, aoClicar: () => void): () => void {
  // O Electron precisa de uma referência viva à notificação enquanto ela existe;
  // sem isso o clique pode não chegar. Guardamos num conjunto e soltamos ao fechar.
  const vivas = new Set<Notification>()

  const verificar = (): void => {
    if (!Notification.isSupported()) return
    try {
      processarNotificacoes(db, new Date(), (n) => {
        const notificacao = new Notification({ title: n.titulo, body: n.corpo, icon: icone })
        vivas.add(notificacao)
        const soltar = (): void => void vivas.delete(notificacao)
        notificacao.on('click', () => {
          aoClicar()
          soltar()
        })
        notificacao.on('close', soltar)
        notificacao.on('failed', (_e, erro) => {
          registrarLog(`Notificação ${n.chave} falhou: ${erro}`)
          soltar()
        })
        notificacao.on('show', () => registrarLog(`Notificação exibida: ${n.chave}`))
        notificacao.show()
        // Segurança: solta a referência depois de um tempo, mesmo sem evento.
        setTimeout(soltar, 10 * 60 * 1000).unref()
      })
    } catch (erro) {
      registrarLog('Falha ao verificar notificações', erro)
    }
  }

  verificar()
  const intervalo = setInterval(verificar, 30_000)
  powerMonitor.on('resume', verificar)
  return () => {
    clearInterval(intervalo)
    powerMonitor.off('resume', verificar)
  }
}
