import { ESQUEMA_FOTO } from '@shared/constantes'
import { api } from './api'

/** Endereço interno de uma foto guardada em disco (servido pelo protocolo alinhavo-foto). */
export const urlFoto = (arquivo: string): string => `${ESQUEMA_FOTO}://foto/${encodeURIComponent(arquivo)}`

/** Erro com mensagem já própria para mostrar à pessoa. */
export class ErroFoto extends Error {}

/** Lado maior máximo da foto guardada. Referências não precisam de resolução máxima. */
const LADO_MAXIMO = 1400

/** Reduz a foto (e converte para JPEG) antes de guardar, como no protótipo. */
function reduzirImagem(arquivo: File): Promise<Blob> {
  return new Promise((ok, erro) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob((b) => (b ? ok(b) : erro(new Error('imagem'))), 'image/jpeg', 0.8)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      erro(new Error('imagem'))
    }
    img.src = url
  })
}

/**
 * Reduz a imagem e a entrega ao processo principal, que a grava como arquivo.
 * Devolve o NOME do arquivo (é isso que fica nos dados).
 */
export async function guardarImagem(arquivo: File): Promise<string> {
  const blob = await reduzirImagem(arquivo)
  const resposta = await api.salvarFoto(new Uint8Array(await blob.arrayBuffer()))
  if (!resposta.ok) throw new ErroFoto(resposta.erro)
  return resposta.dados
}
