import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import { dadosIniciais } from '../src/shared/dados-iniciais'
import type { Estado } from '../src/shared/tipos'
import { definirPastas, criarPastas, type Pastas } from '../src/main/pastas'

/** Ajudantes compartilhados pelos testes. */

/** Gerador de ids previsíveis: "id1", "id2"... */
export function geradorDeIds(prefixo = 'id'): () => string {
  let n = 0
  return () => `${prefixo}${++n}`
}

/** Estado inicial com ids previsíveis. */
export const estadoBase = (): Estado => dadosIniciais(geradorDeIds())

const pastasTemporarias: string[] = []

/** Cria uma pasta de dados temporária (apagada ao fim de cada teste). */
export function pastasDeTeste(): Pastas {
  const base = mkdtempSync(join(tmpdir(), 'alinhavo-teste-'))
  pastasTemporarias.push(base)
  const p = definirPastas(base)
  criarPastas(p)
  return p
}

afterEach(() => {
  while (pastasTemporarias.length) rmSync(pastasTemporarias.pop() as string, { recursive: true, force: true })
})

/** Bytes mínimos que passam como JPEG (só a assinatura é conferida pelo app). */
export const jpegFalso = (extra = 0): Uint8Array => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, ...Array.from({ length: extra }, (_, i) => i % 256)])
