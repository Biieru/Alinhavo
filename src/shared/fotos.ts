/**
 * Regras sobre arquivos de foto. Ficam no código compartilhado porque são usadas
 * pelo protocolo interno, pelo salvamento de fotos, pela validação do estado e pelo backup.
 */

/** Extensões de imagem aceitas e o tipo de conteúdo de cada uma. */
export const TIPOS_IMAGEM: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif'
}

/** Tamanho máximo de uma foto, em bytes (as fotos do app são reduzidas para ~1400 px antes de salvar). */
export const TAMANHO_MAXIMO_FOTO = 25 * 1024 * 1024

/**
 * Um nome de arquivo de foto é seguro quando:
 * - é só um nome, sem pastas (nada de "/", "\", ":" nem "..");
 * - usa apenas letras, números, ponto, hífen e sublinhado;
 * - termina com uma extensão de imagem conhecida.
 * É isto que impede que "../../algo" escape da pasta de fotos.
 */
export function nomeFotoValido(nome: unknown): nome is string {
  if (typeof nome !== 'string') return false
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(nome)) return false
  if (nome.includes('..')) return false
  const ext = nome.slice(nome.lastIndexOf('.') + 1).toLowerCase()
  return nome.includes('.') && ext in TIPOS_IMAGEM
}

export const tipoPorNome = (nome: string): string => TIPOS_IMAGEM[nome.slice(nome.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream'

/**
 * Descobre o tipo real da imagem olhando os primeiros bytes (a "assinatura" do arquivo),
 * sem confiar na extensão. Devolve a extensão ou null se não for uma imagem aceita.
 */
export function extensaoPorConteudo(b: Uint8Array): 'jpg' | 'png' | 'webp' | 'gif' | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png'
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif'
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'
  return null
}
