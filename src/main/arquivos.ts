import { renameSync, rmSync, writeFileSync } from 'node:fs'

/**
 * Operações de arquivo robustas para o Windows.
 *
 * No Windows, logo depois de um arquivo ser criado, o antivírus ou o indexador de busca podem
 * segurá-lo aberto por alguns milissegundos. Nesse instante, renomear o arquivo falha com
 * EPERM, EBUSY ou EACCES, mesmo estando tudo certo. Por isso renomear é tentado algumas vezes.
 */

const ERROS_PASSAGEIROS = new Set(['EPERM', 'EBUSY', 'EACCES'])

/** Espera sem travar a CPU (só é usada no processo principal, em pausas de poucos milissegundos). */
const dormir = (ms: number): void => void Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** Renomeia (arquivo ou pasta), tentando de novo se o Windows estiver segurando o item por um instante. */
export function renomearComTentativas(origem: string, destino: string, tentativas = 8): void {
  for (let i = 0; ; i++) {
    try {
      renameSync(origem, destino)
      return
    } catch (e) {
      const codigo = (e as NodeJS.ErrnoException).code ?? ''
      if (!ERROS_PASSAGEIROS.has(codigo) || i >= tentativas - 1) throw e
      dormir(30 * (i + 1))
    }
  }
}

/**
 * Grava um arquivo pequeno de forma segura: escreve num temporário e renomeia por cima do destino.
 * Se a troca falhar, preserva o destino anterior e remove o temporário.
 * Não grava diretamente sobre backups já existentes.
 */
export function gravarArquivoSeguro(destino: string, dados: string | Uint8Array): void {
  const temporario = `${destino}.tmp`
  try {
    writeFileSync(temporario, dados)
    renomearComTentativas(temporario, destino)
  } catch (erro) {
    try { rmSync(temporario, { force: true }) } catch { /* Preserva o erro da gravação. */ }
    throw erro
  }
}
