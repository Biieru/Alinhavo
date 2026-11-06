import { randomUUID } from 'node:crypto'
import { existsSync, lstatSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { renomearComTentativas } from './arquivos'
import { extensaoPorConteudo, nomeFotoValido, TAMANHO_MAXIMO_FOTO } from '@shared/fotos'
import { ErroApp } from './erros'

/**
 * Fotos como arquivos na pasta "fotos" (dentro dos dados do usuário).
 * O banco guarda apenas o nome do arquivo.
 */

/**
 * Devolve o caminho completo de uma foto, mas SÓ se o nome for seguro e o caminho resultante
 * ficar dentro da pasta de fotos. Para qualquer coisa suspeita ("..", barras, unidades, nomes
 * estranhos) devolve null. É a barreira usada pelo protocolo interno que exibe as fotos.
 */
export function caminhoSeguroDaFoto(pastaFotos: string, nome: unknown): string | null {
  if (!nomeFotoValido(nome)) return null
  const base = resolve(pastaFotos)
  const alvo = resolve(base, nome)
  const rel = relative(base, alvo)
  // Segunda checagem (cinto e suspensório): o caminho final tem de estar dentro da pasta base.
  if (!rel || rel.startsWith('..') || rel.includes(sep) || resolve(base, rel) !== alvo) return null
  return alvo
}

/** True se o caminho é um arquivo comum (não é link simbólico, pasta ou atalho). */
export function ehArquivoComum(caminho: string): boolean {
  try {
    return lstatSync(caminho).isFile()
  } catch {
    return false
  }
}

/** Grava uma foto nova e devolve o nome gerado. Confere o tamanho e o conteúdo real da imagem. */
export function salvarFoto(pastaFotos: string, bytes: unknown): string {
  const dados = bytes instanceof Uint8Array ? bytes : bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null
  if (!dados || dados.length === 0) throw new ErroApp('Não foi possível ler essa imagem. Tente outro arquivo.')
  if (dados.length > TAMANHO_MAXIMO_FOTO) throw new ErroApp('Essa imagem é grande demais.')
  const ext = extensaoPorConteudo(dados)
  if (!ext) throw new ErroApp('Esse arquivo não é uma imagem aceita (JPEG, PNG, WebP ou GIF).')

  const nome = `${randomUUID()}.${ext}`
  const destino = join(pastaFotos, nome)
  // Escreve num arquivo temporário e renomeia: nunca fica uma foto pela metade.
  const temporario = `${destino}.tmp`
  try {
    writeFileSync(temporario, dados)
    renomearComTentativas(temporario, destino)
  } catch {
    rmSync(temporario, { force: true })
    throw new ErroApp('Não foi possível guardar a imagem. Tente de novo.')
  }
  return nome
}

/**
 * Remove fotos que nenhum registro usa mais. Por segurança só apaga arquivos com mais de
 * `idadeMinimaMs` (uma foto recém-salva ainda pode não ter chegado ao banco) e só arquivos
 * comuns com nome de foto válido; qualquer outra coisa na pasta é deixada em paz.
 */
export function limparFotosSemUso(pastaFotos: string, usadas: Set<string>, agora: number, idadeMinimaMs = 24 * 3600 * 1000): string[] {
  const apagadas: string[] = []
  if (!existsSync(pastaFotos)) return apagadas
  for (const nome of readdirSync(pastaFotos)) {
    if (!nomeFotoValido(nome) || usadas.has(nome)) continue
    const caminho = caminhoSeguroDaFoto(pastaFotos, nome)
    if (!caminho || !ehArquivoComum(caminho)) continue
    if (agora - statSync(caminho).mtimeMs < idadeMinimaMs) continue
    rmSync(caminho, { force: true })
    apagadas.push(nome)
  }
  return apagadas
}
