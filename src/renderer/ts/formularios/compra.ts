import { STATUS_COMPRA } from '@shared/constantes'
import { esc, novoId, numero } from '@shared/formato'
import type { Compra, StatusCompra } from '@shared/tipos'
import { opcoesCosplay } from '../consultas'
import { estado } from '../estado'
import { avisar } from '../aviso'
import { concluir } from '../fluxo'
import { ui } from '../ui-estado'
import { abrirFolha } from './folha'

/** Formulário de item de compra: cria um novo quando `i` é omitido; senão edita `i`. */
export function formCompra(i?: Compra, cosplayId?: string): void {
  if (!estado.cosplays.length) {
    avisar('Crie um molde primeiro')
    return
  }
  abrirFolha({
    titulo: i ? 'Editar item' : 'Novo item',
    // O link da loja abre no navegador padrão (o app bloqueia a navegação da própria janela).
    conteudo: i?.link && /^https?:\/\//i.test(i.link) ? `<a class="botao botao-link" href="${esc(i.link)}" target="_blank" rel="noopener">Abrir link da loja</a>` : '',
    campos: [
      { nome: 'nome', rotulo: 'Item', valor: i?.nome, obrigatorio: true },
      { nome: 'cosplayId', rotulo: 'Molde', tipo: 'select', opcoes: opcoesCosplay(), valor: i?.cosplayId || cosplayId || ui.cosplayId || estado.cosplays[0].id },
      { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: STATUS_COMPRA.map((s) => [s, s]), valor: i?.status || 'A comprar' },
      { nome: 'preco', rotulo: 'Preço em reais', tipo: 'number', valor: i?.preco || '' },
      { nome: 'loja', rotulo: 'Loja', valor: i?.loja },
      { nome: 'prazo', rotulo: 'Comprar até ou previsão de chegada', tipo: 'date', valor: i?.prazo },
      { nome: 'link', rotulo: 'Link', tipo: 'url', valor: i?.link }
    ],
    aoSalvar(v) {
      const dados = { nome: v.nome, cosplayId: v.cosplayId, status: v.status as StatusCompra, preco: numero(v.preco), loja: v.loja, prazo: v.prazo, link: v.link }
      if (i) Object.assign(i, dados)
      else estado.compras.push({ id: novoId(), ...dados })
      ui.abaCompra = v.status
      concluir('Item salvo')
    },
    aoExcluir: i
      ? () => {
          estado.compras = estado.compras.filter((x) => x !== i)
          concluir('Item excluído')
        }
      : null
  })
}
