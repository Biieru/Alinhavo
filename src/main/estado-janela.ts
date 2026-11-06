import { readFileSync } from 'node:fs'
import { gravarArquivoSeguro } from './arquivos'
import { registrarLog } from './log'

/**
 * Lembra o tamanho e a posição da janela entre uma abertura e outra.
 * A lógica de "a janela ainda cabe nos monitores atuais?" é pura (sem Electron) para poder ser testada.
 */
export interface Retangulo {
  x: number
  y: number
  width: number
  height: number
}

export interface EstadoJanela {
  x?: number
  y?: number
  width: number
  height: number
  maximizada: boolean
}

/** Largura e altura mínimas: abaixo disso o layout de coluna única deixa de caber. */
export const LARGURA_MINIMA = 420
export const ALTURA_MINIMA = 600

export const JANELA_PADRAO: EstadoJanela = { width: 960, height: 900, maximizada: false }

const entre = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max)

/**
 * Corrige um estado salvo: respeita os mínimos e, se a posição ficou fora de todos os monitores
 * (por exemplo, um monitor foi desconectado), descarta x/y para o Windows centralizar a janela.
 */
export function ajustarAosMonitores(estado: EstadoJanela, areas: Retangulo[]): EstadoJanela {
  const r: EstadoJanela = {
    width: entre(Math.round(estado.width), LARGURA_MINIMA, 10000),
    height: entre(Math.round(estado.height), ALTURA_MINIMA, 10000),
    maximizada: estado.maximizada === true
  }
  if (Number.isFinite(estado.x) && Number.isFinite(estado.y)) {
    const x = Math.round(estado.x as number)
    const y = Math.round(estado.y as number)
    // Precisa haver ao menos um trecho 120x60 da janela visível em algum monitor.
    const visivel = areas.some((a) => Math.min(x + r.width, a.x + a.width) - Math.max(x, a.x) >= 120 && Math.min(y + r.height, a.y + a.height) - Math.max(y, a.y) >= 60)
    if (visivel) {
      r.x = x
      r.y = y
    }
  }
  return r
}

export function lerEstadoJanela(arquivo: string, areas: Retangulo[]): EstadoJanela {
  try {
    const bruto = JSON.parse(readFileSync(arquivo, 'utf8')) as Partial<EstadoJanela>
    return ajustarAosMonitores({ ...JANELA_PADRAO, ...bruto }, areas)
  } catch {
    return ajustarAosMonitores(JANELA_PADRAO, areas)
  }
}

export function salvarEstadoJanela(arquivo: string, estado: EstadoJanela): void {
  try {
    gravarArquivoSeguro(arquivo, JSON.stringify(estado))
  } catch (e) {
    // Lembrar a janela é um luxo: se não der, o app segue normalmente (mas o motivo fica no log).
    registrarLog('Não foi possível guardar o tamanho e a posição da janela', e)
  }
}
