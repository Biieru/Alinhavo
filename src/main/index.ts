import type Database from 'better-sqlite3'
import { app, BrowserWindow, dialog, Menu, type Tray } from 'electron'
import { iniciarAgendador } from './agendador'
import { recuperarRestauracaoInterrompida } from './backup/restaurar'
import { criarBandeja } from './bandeja'
import { abrirBanco } from './banco/conexao'
import { fotosReferenciadas } from './banco/repositorio'
import { marcarSaida } from './ciclo'
import { mensagemParaUsuario } from './erros'
import { limparFotosSemUso } from './fotos'
import { bloquearPermissoes, criarJanela, mostrarJanela } from './janela'
import { configurarLog, registrarLog } from './log'
import { criarPastas, definirPastas } from './pastas'
import { registrarEsquemaDeFotos, registrarProtocoloDeFotos } from './protocolo-fotos'
import { registrarIpc } from './ipc'
import { ICONE_BANDEJA, ICONE_JANELA } from './icones'

/**
 * Ponto de entrada do processo principal.
 * Ordem: configurar pastas -> trava de instância única -> (app pronto) banco -> protocolo de fotos
 * -> IPC -> janela -> bandeja -> notificações.
 */

// Identificador do app no Windows. Precisa ser igual ao "appId" do instalador para as
// notificações aparecerem com o nome e o ícone do Alinhavo.
app.setAppUserModelId('br.alinhavo.app')

// Para testes e para quem quiser separar dados: ALINHAVO_DADOS aponta outra pasta de dados.
// Precisa vir antes da trava de instância, que depende desta pasta.
if (process.env['ALINHAVO_DADOS']) app.setPath('userData', process.env['ALINHAVO_DADOS'])

// O esquema do protocolo de fotos precisa ser registrado antes do app ficar pronto.
registrarEsquemaDeFotos()

let janela: BrowserWindow | null = null
let bandeja: Tray | null = null
let banco: Database.Database | null = null
let pararAgendador: (() => void) | null = null

/** Encerra de verdade (diferente de fechar a janela, que só a esconde). */
function sair(): void {
  marcarSaida()
  app.quit()
}

// Só uma instância por vez: duas instâncias duplicariam notificações e disputariam o banco.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // Quem tentar abrir o app de novo apenas traz a janela existente para a frente.
  app.on('second-instance', () => mostrarJanela(janela))

  // Fechar todas as janelas NÃO encerra o app: ele fica na bandeja.
  app.on('window-all-closed', () => {
    /* intencionalmente vazio */
  })

  app.on('before-quit', () => marcarSaida())
  app.on('will-quit', () => {
    pararAgendador?.()
    try {
      banco?.close()
    } catch (erro) {
      registrarLog('Falha ao fechar o banco', erro)
    }
  })

  void app.whenReady().then(async () => {
    const pastas = definirPastas(app.getPath('userData'))
    try {
      criarPastas(pastas)
      configurarLog(pastas.logs)
      Menu.setApplicationMenu(null) // sem barra de menus: a interface é toda própria
      bloquearPermissoes()

      banco = await abrirBanco(pastas.banco)
      recuperarRestauracaoInterrompida(banco, pastas)
      // Faxina de fotos sem uso: só apaga arquivos órfãos com mais de 24 horas.
      limparFotosSemUso(pastas.fotos, fotosReferenciadas(banco), Date.now())

      registrarProtocoloDeFotos(pastas.fotos)
      registrarIpc(banco, pastas, () => janela)
      janela = criarJanela(pastas, ICONE_JANELA)
      bandeja = criarBandeja(ICONE_BANDEJA, () => mostrarJanela(janela), sair)
      pararAgendador = iniciarAgendador(banco, ICONE_JANELA, () => mostrarJanela(janela))
    } catch (erro) {
      registrarLog('Falha ao iniciar o app', erro)
      dialog.showErrorBox('Alinhavo', `Não foi possível iniciar o Alinhavo.\n\n${mensagemParaUsuario(erro)}`)
      marcarSaida()
      app.exit(1)
    }
  })

  // Desligamento ou fim de sessão do Windows: não impedir.
  app.on('browser-window-created', (_e, nova) => nova.on('session-end', () => marcarSaida()))
  void bandeja // mantém a referência viva para o ícone não ser coletado pelo garbage collector
}
