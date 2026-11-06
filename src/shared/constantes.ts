import type { StatusCompra, StatusCosplay, TipoPeca } from './tipos'

/** Nome mostrado de cada tipo de peça. */
export const TIPOS: Record<TipoPeca, string> = {
  tecido: 'Tecido',
  armadura: 'Armadura',
  arma: 'Arma',
  comprar: 'Comprar'
}

export const TIPOS_CHAVES = Object.keys(TIPOS) as TipoPeca[]

export const STATUS_COSPLAY: StatusCosplay[] = ['Ideia', 'Planejando', 'Em produção', 'Pronto', 'Aposentado']
export const STATUS_COMPRA: StatusCompra[] = ['A comprar', 'A caminho', 'Chegou']

/** Versão atual do formato do estado exportado em JSON. */
export const VERSAO_ESTADO = 1

/** Identificador do formato do arquivo dados.json dentro do backup .zip. */
export const FORMATO_BACKUP = 'alinhavo-backup'
export const VERSAO_FORMATO_BACKUP = 1

/** Esquema de URL interno para exibir as fotos guardadas em disco. */
export const ESQUEMA_FOTO = 'alinhavo-foto'
