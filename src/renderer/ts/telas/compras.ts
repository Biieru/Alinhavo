import { totalCompras } from '@shared/calculos'
import { STATUS_COMPRA } from '@shared/constantes'
import { dataCurta } from '@shared/datas'
import { esc, reais } from '@shared/formato'
import type { Compra } from '@shared/tipos'
import { cosplayPorId } from '../consultas'
import { estado } from '../estado'
import { ui } from '../ui-estado'

/** Tela "Compras": etiquetas de compra separadas por situação (A comprar, A caminho, Chegou). */
export function telaCompras(): string {
  const lista = estado.compras.filter((i) => i.status === ui.abaCompra).sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'))
  const texto = (i: Compra): string =>
    i.status === 'A comprar' ? (i.prazo ? 'até ' + dataCurta(i.prazo) : 'sem prazo') : i.status === 'A caminho' ? (i.prazo ? 'chega ' + dataCurta(i.prazo) : 'a caminho') : 'recebido'
  return `<div class="pagina">
    <header class="cabeca-linha"><div class="cabeca"><p class="rotulo">Lista do armarinho</p><h1>Compras</h1></div><span class="preco" style="font-size:22px">${reais(totalCompras(lista))}</span></header>
    <div class="abas" role="tablist">${STATUS_COMPRA.map((s) => `<button role="tab" aria-selected="${s === ui.abaCompra}" data-a="abaCompra" data-aba="${s}">${s}</button>`).join('')}</div>
    ${
      lista.length
        ? `<div class="etiquetas">${lista
            .map(
              (i) => `<button class="etiqueta" data-a="editarCompra" data-id="${esc(i.id)}">
      <span class="forte" style="overflow-wrap:anywhere">${esc(i.nome)}</span><span class="preco">${reais(i.preco)}</span>
      <span class="apoio italico" style="color:var(--suave)">${esc(i.loja || cosplayPorId(i.cosplayId)?.nome || '')}</span><span class="rotulo direita">${esc(texto(i))}</span></button>`
            )
            .join('')}</div>`
        : `<div class="painel"><p class="vazio">Nada em ${esc(ui.abaCompra.toLowerCase())}.</p></div>`
    }
    <button class="botao" data-a="novaCompra">Adicionar item</button>
  </div>`
}
