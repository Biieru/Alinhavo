import { app } from 'electron'
import { join } from 'node:path'

/**
 * Caminhos dos ícones.
 *
 * No app instalado, os ícones ficam numa pasta "recursos" FORA do pacote .asar (extraResources
 * do instalador), porque o Windows lê o ícone da janela e das notificações diretamente do disco
 * e não sabe abrir arquivos de dentro de um .asar.
 * Em desenvolvimento, usa a pasta "resources" do projeto.
 */
const pasta = app.isPackaged ? join(process.resourcesPath, 'recursos') : join(app.getAppPath(), 'resources')

export const ICONE_JANELA = join(pasta, 'icone.png')
export const ICONE_BANDEJA = join(pasta, 'bandeja.png')
