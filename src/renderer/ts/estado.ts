import { dadosIniciais } from '@shared/dados-iniciais'
import type { Estado } from '@shared/tipos'

/**
 * O estado da aplicação: todos os dados do usuário em um objeto só (como no protótipo).
 * Quem manda no estado "de verdade" é o banco, no processo principal; aqui fica a cópia de
 * trabalho que as telas leem e alteram, e que `persistencia.ts` envia para ser gravada.
 */
export let estado: Estado = dadosIniciais()

/** Troca o estado inteiro (ao carregar os dados ou depois de importar um backup). */
export function definirEstado(novo: Estado): void {
  estado = novo
}
