import type Database from 'better-sqlite3'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { gravarArquivoSeguro } from '../arquivos'
import { lerEstado } from '../banco/repositorio'
import { ErroApp } from '../erros'
import { caminhoSeguroDaFoto } from '../fotos'
import type { Pastas } from '../pastas'
import { converterPrototipo, pareceDoPrototipo } from './prototipo'
import { criarCopiaAutomatica, restaurarDados } from './restaurar'
import { criarBackupZip, lerBackupZip, type BackupLido, LIMITE_ZIP_TOTAL } from './zip'

/** Camada de serviço do backup: junta leitura de arquivos, validação e restauração. */

/** Exporta todos os dados e fotos para um .zip no caminho escolhido. */
export function exportarParaArquivo(db: Database.Database, pastas: Pastas, destino: string): void {
  const zip = criarBackupZip(lerEstado(db), (nome) => {
    const caminho = caminhoSeguroDaFoto(pastas.fotos, nome)
    return caminho && existsSync(caminho) ? new Uint8Array(readFileSync(caminho)) : null
  })
  try {
    // Grava num arquivo temporário e renomeia, para nunca deixar um .zip pela metade no destino.
    gravarArquivoSeguro(destino, zip)
  } catch {
    throw new ErroApp('Não foi possível gravar o arquivo de backup nesse local. Escolha outra pasta.')
  }
}

const ehZip = (b: Uint8Array): boolean => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05)

/**
 * Lê um arquivo escolhido pela pessoa (.zip novo ou .json do protótipo) e o valida por completo.
 * Não altera NADA no disco nem no banco.
 */
export function lerArquivoDeBackup(caminho: string): BackupLido {
  let tamanho: number
  try {
    tamanho = statSync(caminho).size
  } catch {
    throw new ErroApp('Não foi possível abrir esse arquivo.')
  }
  if (tamanho > LIMITE_ZIP_TOTAL) throw new ErroApp('Esse arquivo é grande demais para ser um backup do Alinhavo.')

  const bytes = new Uint8Array(readFileSync(caminho))
  if (ehZip(bytes)) return lerBackupZip(bytes)

  let bruto: unknown
  try {
    bruto = JSON.parse(Buffer.from(bytes).toString('utf8'))
  } catch {
    throw new ErroApp('Esse arquivo não é um backup do Alinhavo.')
  }
  if (pareceDoPrototipo(bruto)) return converterPrototipo(bruto)
  throw new ErroApp('Esse arquivo não é um backup do Alinhavo.')
}

/**
 * Aplica um backup já validado: primeiro a cópia de segurança automática, depois a restauração
 * em troca segura. Devolve o caminho da cópia automática.
 */
export function aplicarImportacao(db: Database.Database, pastas: Pastas, lido: BackupLido): string {
  const copia = criarCopiaAutomatica(db, pastas)
  restaurarDados(db, pastas, { estado: lido.estado, fotos: lido.fotos })
  return copia
}
