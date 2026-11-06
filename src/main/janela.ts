import { app, BrowserWindow, screen, session, shell } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { estaSaindo } from './ciclo'
import { ALTURA_MINIMA, LARGURA_MINIMA, lerEstadoJanela, salvarEstadoJanela } from './estado-janela'
import type { Pastas } from './pastas'

/** Endereço do servidor de desenvolvimento (só existe em `npm run dev`). */
const URL_DEV = process.env['ELECTRON_RENDERER_URL']
/** Página da interface no app compilado. */
const ARQUIVO_INTERFACE = join(__dirname, '../renderer/index.html')

/** True se o endereço é a própria interface do app (e nada mais). */
function ehEnderecoDoApp(endereco: string): boolean {
  try {
    const u = new URL(endereco)
    u.hash = ''
    if (URL_DEV) return u.origin === new URL(URL_DEV).origin
    return u.href === pathToFileURL(ARQUIVO_INTERFACE).href
  } catch {
    return false
  }
}

/** Abre um link no navegador padrão, mas só http/https (nunca arquivos, nem programas). */
export function abrirNoNavegador(endereco: string): void {
  try {
    const u = new URL(endereco)
    if (u.protocol === 'http:' || u.protocol === 'https:') void shell.openExternal(u.href)
  } catch {
    /* Endereço inválido: ignorar. */
  }
}

/** Nega todo pedido de permissão do site (câmera, localização etc.): o app não usa nenhuma. */
export function bloquearPermissoes(): void {
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, retorno) => retorno(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
}

export function criarJanela(pastas: Pastas, icone: string): BrowserWindow {
  const areas = screen.getAllDisplays().map((d) => d.workArea)
  const salvo = lerEstadoJanela(pastas.janela, areas)

  const janela = new BrowserWindow({
    x: salvo.x,
    y: salvo.y,
    width: salvo.width,
    height: salvo.height,
    minWidth: LARGURA_MINIMA,
    minHeight: ALTURA_MINIMA,
    show: false, // só aparece quando a interface já está pronta (evita um flash branco)
    backgroundColor: '#B8A47C', // mesma cor de fundo do app
    title: 'Alinhavo',
    icon: icone,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true, // a interface não enxerga o código do preload
      sandbox: true, // a interface roda isolada do sistema
      nodeIntegration: false, // sem Node.js na interface
      webSecurity: true,
      devTools: !app.isPackaged
    }
  })
  janela.setMenuBarVisibility(false)
  if (salvo.maximizada) janela.maximize()

  janela.once('ready-to-show', () => janela.show())

  // ----- Restringe a navegação ao próprio app -----
  // Links com target="_blank" (ex.: "Abrir link da loja") abrem no navegador padrão.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    abrirNoNavegador(url)
    return { action: 'deny' }
  })
  // Qualquer tentativa de ir para outro endereço dentro da janela é bloqueada.
  janela.webContents.on('will-navigate', (evento, url) => {
    if (!ehEnderecoDoApp(url)) {
      evento.preventDefault()
      abrirNoNavegador(url)
    }
  })
  janela.webContents.on('will-attach-webview', (evento) => evento.preventDefault())

  // ----- Lembra tamanho e posição -----
  let temporizador: NodeJS.Timeout | undefined
  const guardar = (): void => {
    if (janela.isDestroyed() || janela.isMinimized()) return
    const b = janela.getNormalBounds()
    salvarEstadoJanela(pastas.janela, { x: b.x, y: b.y, width: b.width, height: b.height, maximizada: janela.isMaximized() })
  }
  const guardarDepois = (): void => {
    clearTimeout(temporizador)
    temporizador = setTimeout(guardar, 400)
  }
  janela.on('resize', guardarDepois)
  janela.on('move', guardarDepois)

  // Fechar a janela só a esconde: o app continua na bandeja, para as notificações seguirem.
  janela.on('close', (evento) => {
    guardar()
    if (!estaSaindo()) {
      evento.preventDefault()
      janela.hide()
    }
  })

  if (URL_DEV) void janela.loadURL(URL_DEV)
  else void janela.loadFile(ARQUIVO_INTERFACE)
  return janela
}

/** Traz a janela para a frente (restaura, mostra e foca). */
export function mostrarJanela(janela: BrowserWindow | null): void {
  if (!janela || janela.isDestroyed()) return
  if (janela.isMinimized()) janela.restore()
  janela.show()
  janela.focus()
}
