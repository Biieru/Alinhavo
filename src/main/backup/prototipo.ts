import { randomUUID } from 'node:crypto'
import { extensaoPorConteudo, TAMANHO_MAXIMO_FOTO } from '@shared/fotos'
import { normalizarEstado } from '@shared/validacao'
import type { BackupLido } from './zip'
import { ErroApp } from '../erros'

/**
 * Importação do JSON do protótipo (o arquivo "alinhavo-backup-AAAA-MM-DD.json" exportado pelo
 * Alinhavo em HTML).
 *
 * No protótipo, cada foto era um campo `url`: uma imagem embutida no próprio texto
 * ("data:image/jpeg;base64,...") ou um endereço on-line. Aqui:
 * - imagens embutidas viram arquivos de foto;
 * - endereços on-line não podem ser baixados (o app funciona offline), então a foto fica de fora
 *   e a pessoa é avisada.
 */

type Obj = Record<string, unknown>
const ehObjeto = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Distingue "é um JSON do protótipo" de um backup novo: o protótipo é o próprio estado. */
export const pareceDoPrototipo = (v: unknown): boolean => ehObjeto(v) && Array.isArray(v.cosplays) && !!v.etapas && v.formato === undefined

const PADRAO_DATA_URL = /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\r\n]+)$/i

export function converterPrototipo(bruto: unknown): BackupLido {
  if (!ehObjeto(bruto) || !Array.isArray(bruto.cosplays) || !bruto.etapas) throw new ErroApp('Esse arquivo não é um backup do Alinhavo.')

  const fotos = new Map<string, Uint8Array>()
  let naoImportadas = 0

  /** Converte uma `url` do protótipo em nome de arquivo ("" se não der). */
  const converterUrl = (url: unknown): string => {
    if (typeof url !== 'string' || !url) return ''
    const m = PADRAO_DATA_URL.exec(url)
    if (m) {
      const bytes = new Uint8Array(Buffer.from(m[1], 'base64'))
      const ext = extensaoPorConteudo(bytes)
      if (ext && bytes.length > 0 && bytes.length <= TAMANHO_MAXIMO_FOTO) {
        const nome = `${randomUUID()}.${ext}`
        fotos.set(nome, bytes)
        return nome
      }
    }
    naoImportadas++
    return ''
  }

  // Copia o estado trocando `url` por `arquivo`, sem alterar o objeto original.
  const cosplays = bruto.cosplays.map((c: unknown) => {
    if (!ehObjeto(c)) return c
    const referencias = Array.isArray(c.referencias)
      ? c.referencias.map((r: unknown) => (ehObjeto(r) ? { id: r.id, nota: r.nota, arquivo: converterUrl(r.url) } : r))
      : c.referencias
    const diario = Array.isArray(c.diario)
      ? c.diario.map((n: unknown) => (ehObjeto(n) ? { id: n.id, data: n.data, texto: n.texto, arquivo: converterUrl(n.url) } : n))
      : c.diario
    return { ...c, referencias, diario }
  })

  const estado = normalizarEstado({ ...bruto, cosplays })
  const avisos: string[] = []
  if (naoImportadas) {
    avisos.push(
      naoImportadas > 1
        ? `${naoImportadas} fotos do protótipo não puderam ser trazidas (estavam guardadas on-line).`
        : '1 foto do protótipo não pôde ser trazida (estava guardada on-line).'
    )
  }
  return { estado, fotos, avisos }
}
