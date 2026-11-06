import { readFile } from 'node:fs/promises'
import { protocol } from 'electron'
import { ESQUEMA_FOTO } from '@shared/constantes'
import { tipoPorNome } from '@shared/fotos'
import { caminhoSeguroDaFoto, ehArquivoComum } from './fotos'
import { registrarLog } from './log'

/**
 * Protocolo interno "alinhavo-foto://foto/<nome-do-arquivo>".
 *
 * Por que existe: com sandbox e CSP, a interface não pode abrir arquivos do disco diretamente.
 * Este protocolo entrega as fotos e SÓ elas: o nome passa por `caminhoSeguroDaFoto`, que
 * recusa "..", barras, caminhos absolutos e qualquer nome fora do padrão, e só serve
 * arquivos que estejam dentro da pasta de fotos.
 */

/** Precisa ser chamado ANTES de o app ficar pronto (exigência do Electron). */
export function registrarEsquemaDeFotos(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: ESQUEMA_FOTO, privileges: { standard: true, secure: true, supportFetchAPI: true } }])
}

const negado = (status: number): Response => new Response(null, { status })

/** Liga o tratamento do protocolo. Chamar depois que o app estiver pronto. */
export function registrarProtocoloDeFotos(pastaFotos: string): void {
  protocol.handle(ESQUEMA_FOTO, async (requisicao) => {
    try {
      const url = new URL(requisicao.url)
      if (url.hostname !== 'foto') return negado(404)
      let nome: string
      try {
        nome = decodeURIComponent(url.pathname.slice(1))
      } catch {
        return negado(400)
      }
      const caminho = caminhoSeguroDaFoto(pastaFotos, nome)
      if (!caminho || !ehArquivoComum(caminho)) return negado(404)
      const bytes = await readFile(caminho)
      return new Response(new Uint8Array(bytes), { headers: { 'content-type': tipoPorNome(nome), 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache' } })
    } catch (erro) {
      registrarLog('Falha ao servir foto', erro)
      return negado(500)
    }
  })
}
