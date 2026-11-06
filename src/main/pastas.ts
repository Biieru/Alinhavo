import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Todas as pastas e arquivos do app ficam dentro da pasta de dados do usuário do Windows
 * (%APPDATA%\Alinhavo). Nada é gravado dentro da pasta de instalação.
 */
export interface Pastas {
  /** Pasta base (userData). */
  base: string
  /** Arquivo do banco SQLite. */
  banco: string
  /** Fotos como arquivos soltos. O banco guarda só o nome de cada uma. */
  fotos: string
  /** Cópias de segurança automáticas (feitas antes de importar um backup). */
  copias: string
  /** Registro de problemas inesperados. */
  logs: string
  /** Tamanho e posição da janela. */
  janela: string
}

export function definirPastas(base: string): Pastas {
  return {
    base,
    banco: join(base, 'alinhavo.db'),
    fotos: join(base, 'fotos'),
    copias: join(base, 'copias-automaticas'),
    logs: join(base, 'logs'),
    janela: join(base, 'janela.json')
  }
}

/** Cria as pastas que ainda não existem. */
export function criarPastas(p: Pastas): void {
  for (const dir of [p.base, p.fotos, p.copias, p.logs]) mkdirSync(dir, { recursive: true })
}
