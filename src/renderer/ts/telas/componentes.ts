import { dataCurta } from '@shared/datas'
import { duracao, esc } from '@shared/formato'
import type { Cosplay, Tarefa } from '@shared/tipos'

/** Pedaços de HTML usados em mais de uma tela. */

/** Régua de progresso: traços impressos e uma costura vermelha. */
export const regua = (pct: number): string =>
  `<div class="regua" role="img" aria-label="Progresso de ${pct} em 100"><div class="costura" style="width:${pct}%"></div></div>`

/** Uma tarefa na lista: caixa de marcar à esquerda e nome/detalhes (que abrem a edição) à direita. */
export function linhaTarefa(t: Tarefa, c: Cosplay, comProjeto?: boolean): string {
  const peca = c.pecas.find((p) => p.id === t.pecaId)
  const meta = [comProjeto ? c.nome : '', peca ? peca.nome : '', t.prazo ? 'até ' + dataCurta(t.prazo) : '', duracao(t.minutos)].filter(Boolean).join(', ')
  return `<div class="linha ${t.feita ? 'feita' : ''}">
    <label class="marcar"><input type="checkbox" aria-label="Concluir ${esc(t.nome)}" data-mudar="tarefa" data-c="${esc(c.id)}" data-id="${esc(t.id)}" ${t.feita ? 'checked' : ''}></label>
    <button class="linha-texto botao-texto" data-a="editarTarefa" data-c="${esc(c.id)}" data-id="${esc(t.id)}">
      <span class="forte riscavel">${esc(t.nome)}</span>
      ${meta ? `<span class="apoio italico">${esc(meta)}</span>` : ''}
    </button>
  </div>`
}
