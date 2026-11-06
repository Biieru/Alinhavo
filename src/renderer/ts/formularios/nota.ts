import { hojeISO } from '@shared/datas'
import { esc, novoId } from '@shared/formato'
import type { Cosplay, NotaDiario } from '@shared/tipos'
import { cosplayPorId, opcoesCosplay } from '../consultas'
import { concluir } from '../fluxo'
import { urlFoto } from '../imagens'
import { abrirFolha } from './folha'

/**
 * Formulário de nota do diário. `arquivoFoto` é o arquivo de uma foto recém-escolhida ("Nota com foto").
 * Ao editar, a foto existente da nota continua a mesma.
 */
export function formNota(c: Cosplay, n?: NotaDiario, arquivoFoto?: string): void {
  const foto = arquivoFoto || n?.arquivo
  abrirFolha({
    titulo: n ? 'Editar nota' : 'Nova nota',
    conteudo: foto ? `<img class="diario-foto" src="${esc(urlFoto(foto))}" alt="Foto da nota">` : '',
    campos: [
      { nome: 'cosplay', rotulo: 'Molde', tipo: 'select', opcoes: opcoesCosplay(), valor: c.id },
      { nome: 'data', rotulo: 'Data', tipo: 'date', valor: n?.data || hojeISO(), obrigatorio: true },
      { nome: 'texto', rotulo: 'Nota', tipo: 'textarea', valor: n?.texto, obrigatorio: true }
    ],
    aoSalvar(v) {
      const destino = cosplayPorId(v.cosplay) || c
      if (n) {
        Object.assign(n, { data: v.data, texto: v.texto })
        if (destino !== c) {
          c.diario = c.diario.filter((x) => x !== n)
          destino.diario.push(n)
        }
      } else destino.diario.push({ id: novoId(), data: v.data, texto: v.texto, arquivo: arquivoFoto || '' })
      concluir('Nota salva')
    },
    aoExcluir: n
      ? () => {
          c.diario = c.diario.filter((x) => x !== n)
          concluir('Nota excluída')
        }
      : null
  })
}
