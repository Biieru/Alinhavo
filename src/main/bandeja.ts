import { Menu, nativeImage, Tray } from 'electron'

/**
 * Ícone na bandeja do sistema (perto do relógio do Windows).
 * Mantém o app vivo com a janela fechada, para as notificações continuarem.
 * O menu tem exatamente duas opções: Abrir e Sair.
 */
export function criarBandeja(arquivoIcone: string, aoAbrir: () => void, aoSair: () => void): Tray {
  const bandeja = new Tray(nativeImage.createFromPath(arquivoIcone))
  bandeja.setToolTip('Alinhavo')
  bandeja.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir', click: aoAbrir },
      { label: 'Sair', click: aoSair }
    ])
  )
  // Clique (ou duplo clique) no ícone também abre a janela.
  bandeja.on('click', aoAbrir)
  bandeja.on('double-click', aoAbrir)
  return bandeja
}
