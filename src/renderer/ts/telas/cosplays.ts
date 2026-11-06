import { esc } from '@shared/formato'
import { eventoPorId, progresso } from '../consultas'
import { estado } from '../estado'
import { regua } from './componentes'

/** Tela "Cosplays": o catálogo de moldes (um envelope por cosplay). */
export function telaCosplays(): string {
  return `<div class="pagina">
    <header class="cabeca"><p class="rotulo">Catálogo de moldes</p><h1>Cosplays</h1></header>
    <div class="lista-moldes">
    ${estado.cosplays
      .map(
        (c, i) => `<button class="cartao" data-a="abrirCosplay" data-id="${esc(c.id)}">
      <span class="entre"><span class="rotulo">Molde Nº ${i + 1}</span><span class="rotulo">${esc(c.status)}</span></span>
      <span class="titulo-cartao" style="font-size:40px;line-height:1">${esc(c.nome)}</span>
      ${c.obra ? `<span class="apoio italico">${esc(c.obra)}</span>` : ''}
      ${regua(progresso(c))}
      <span class="apoio">${progresso(c)} de 100${eventoPorId(c.eventoId) ? ', ' + esc(eventoPorId(c.eventoId)?.nome) : ''}</span>
    </button>`
      )
      .join('')}
    </div>
    <button class="botao" data-a="novoCosplay">Novo molde</button>
  </div>`
}
