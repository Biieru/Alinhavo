/**
 * Contrato entre a interface e o processo principal.
 *
 * Só estas funções existem para a interface (via preload); ela não tem acesso a Node, arquivos
 * ou banco. Todas devolvem um `Resultado`: em caso de falha vem `{ ok: false, erro }` com
 * texto em português, em vez de uma exceção.
 */
import type { Estado, Resultado } from './tipos'

/** Nomes dos canais IPC. Qualquer canal fora desta lista é ignorado pelo processo principal. */
export const CANAIS = {
  carregarEstado: 'estado:carregar',
  salvarEstado: 'estado:salvar',
  salvarFoto: 'foto:salvar',
  exportarBackup: 'backup:exportar',
  importarBackup: 'backup:importar'
} as const

export interface DadosExportacao {
  cancelado: boolean
}

export interface DadosImportacao {
  cancelado: boolean
  /** Novo estado, quando a importação foi concluída. */
  estado?: Estado
  /** Observações para mostrar à pessoa (por exemplo, fotos que não puderam ser trazidas). */
  avisos: string[]
}

/** A API que o preload publica em `window.alinhavo`. */
export interface ApiAlinhavo {
  carregarEstado(): Promise<Resultado<Estado>>
  salvarEstado(estado: Estado): Promise<Resultado<null>>
  /** Recebe os bytes de uma imagem JPEG já reduzida e devolve o nome do arquivo guardado. */
  salvarFoto(bytes: Uint8Array): Promise<Resultado<string>>
  exportarBackup(): Promise<Resultado<DadosExportacao>>
  importarBackup(): Promise<Resultado<DadosImportacao>>
}
