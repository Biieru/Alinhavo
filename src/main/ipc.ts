import type Database from 'better-sqlite3'
import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { hojeISO } from '@shared/datas'
import { CANAIS, type DadosExportacao, type DadosImportacao } from '@shared/ipc'
import type { Estado, Resultado } from '@shared/tipos'
import { normalizarEstado } from '@shared/validacao'
import { aplicarImportacao, exportarParaArquivo, lerArquivoDeBackup } from './backup/servico'
import { gravarEstado, lerEstado } from './banco/repositorio'
import { ehErroConhecido, mensagemParaUsuario } from './erros'
import { salvarFoto } from './fotos'
import { registrarLog } from './log'
import type { Pastas } from './pastas'

/**
 * Pontes entre a interface e o processo principal.
 *
 * Cada canal faz UMA coisa específica e valida o que recebe. A interface nunca fala com o banco
 * nem com o disco diretamente. Todas as respostas são `Resultado`: falhas viram mensagem em
 * português, nunca uma exceção solta.
 */
export function registrarIpc(db: Database.Database, pastas: Pastas, obterJanela: () => BrowserWindow | null): void {
  /** Só aceita chamadas vindas do quadro principal da janela do próprio app. */
  const origemConfiavel = (evento: IpcMainInvokeEvent): boolean => {
    const janela = obterJanela()
    return !!janela && evento.sender === janela.webContents && evento.senderFrame === evento.sender.mainFrame
  }

  /** Executa uma operação e converte o resultado (ou o erro) para o formato padrão. */
  async function executar<T>(evento: IpcMainInvokeEvent, operacao: () => T | Promise<T>): Promise<Resultado<T>> {
    if (!origemConfiavel(evento)) return { ok: false, erro: 'Pedido não autorizado.' }
    try {
      return { ok: true, dados: await operacao() }
    } catch (erro) {
      // Recusas esperadas (por exemplo, um backup inválido) só voltam como mensagem; só falhas
      // inesperadas vão para o arquivo de log.
      if (!ehErroConhecido(erro)) registrarLog('Falha inesperada em uma operação da interface', erro)
      return { ok: false, erro: mensagemParaUsuario(erro) }
    }
  }

  ipcMain.handle(CANAIS.carregarEstado, (evento) => executar(evento, () => lerEstado(db)))

  // Valida e normaliza ANTES de gravar. A gravação é uma transação única (tudo ou nada).
  ipcMain.handle(CANAIS.salvarEstado, (evento, estado: unknown) =>
    executar(evento, () => {
      const limpo: Estado = normalizarEstado(estado)
      gravarEstado(db, limpo)
      return null
    })
  )

  ipcMain.handle(CANAIS.salvarFoto, (evento, bytes: unknown) => executar(evento, () => salvarFoto(pastas.fotos, bytes)))

  ipcMain.handle(CANAIS.exportarBackup, (evento) =>
    executar<DadosExportacao>(evento, async () => {
      const janela = obterJanela()
      const opcoes = {
        title: 'Exportar backup do Alinhavo',
        defaultPath: join(app.getPath('documents'), `alinhavo-backup-${hojeISO()}.zip`),
        filters: [{ name: 'Backup do Alinhavo (.zip)', extensions: ['zip'] }]
      }
      const escolha = janela ? await dialog.showSaveDialog(janela, opcoes) : await dialog.showSaveDialog(opcoes)
      if (escolha.canceled || !escolha.filePath) return { cancelado: true }
      const destino = /\.zip$/i.test(escolha.filePath) ? escolha.filePath : `${escolha.filePath}.zip`
      exportarParaArquivo(db, pastas, destino)
      return { cancelado: false }
    })
  )

  ipcMain.handle(CANAIS.importarBackup, (evento) =>
    executar<DadosImportacao>(evento, async () => {
      const janela = obterJanela()
      const opcoes = {
        title: 'Importar backup',
        properties: ['openFile' as const],
        filters: [
          { name: 'Backup do Alinhavo (.zip) ou JSON do protótipo', extensions: ['zip', 'json'] },
          { name: 'Todos os arquivos', extensions: ['*'] }
        ]
      }
      const escolha = janela ? await dialog.showOpenDialog(janela, opcoes) : await dialog.showOpenDialog(opcoes)
      if (escolha.canceled || !escolha.filePaths[0]) return { cancelado: true, avisos: [] }

      // 1) Lê e valida TUDO, sem alterar nada. Qualquer problema aborta aqui, com mensagem clara.
      const lido = lerArquivoDeBackup(escolha.filePaths[0])

      // 2) A importação substitui todos os dados atuais: pede confirmação.
      const confirmacao = {
        type: 'warning' as const,
        title: 'Importar backup',
        message: 'Importar este backup vai substituir todos os dados atuais.',
        detail: 'Antes de importar, o Alinhavo cria uma cópia de segurança automática dos dados de agora, na pasta "copias-automaticas".',
        buttons: ['Importar', 'Cancelar'],
        defaultId: 1,
        cancelId: 1,
        noLink: true
      }
      const resposta = janela ? await dialog.showMessageBox(janela, confirmacao) : await dialog.showMessageBox(confirmacao)
      if (resposta.response !== 0) return { cancelado: true, avisos: [] }

      // 3) Cópia automática + troca segura de dados e fotos.
      aplicarImportacao(db, pastas, lido)
      return { cancelado: false, estado: lerEstado(db), avisos: lido.avisos }
    })
  )
}
