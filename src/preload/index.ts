import { contextBridge, ipcRenderer } from 'electron'
import { CANAIS, type ApiAlinhavo } from '../shared/ipc'

/**
 * Preload: a única ponte entre a interface e o processo principal.
 *
 * Com contextIsolation e sandbox ativos, a interface NÃO tem acesso a Node, ao Electron nem ao
 * disco. Ela só enxerga `window.alinhavo`, com as funções abaixo. Cada função:
 * - chama um canal fixo (a interface não escolhe o canal);
 * - confere o tipo do que recebe antes de enviar (o processo principal confere de novo, a fundo).
 */

const api: ApiAlinhavo = {
  carregarEstado: () => ipcRenderer.invoke(CANAIS.carregarEstado),

  salvarEstado: (estado) => {
    if (typeof estado !== 'object' || estado === null) return Promise.resolve({ ok: false, erro: 'Dados inválidos.' })
    return ipcRenderer.invoke(CANAIS.salvarEstado, estado)
  },

  salvarFoto: (bytes) => {
    if (!(bytes instanceof Uint8Array)) return Promise.resolve({ ok: false, erro: 'Imagem inválida.' })
    return ipcRenderer.invoke(CANAIS.salvarFoto, bytes)
  },

  exportarBackup: () => ipcRenderer.invoke(CANAIS.exportarBackup),
  importarBackup: () => ipcRenderer.invoke(CANAIS.importarBackup)
}

contextBridge.exposeInMainWorld('alinhavo', api)
