import { MESES, dataLonga, diasAte, hojeISO, paraISO } from '@shared/datas'
import { esc } from '@shared/formato'
import type { Marco } from '@shared/calculos'
import { eventosFuturos, marcosDoDia } from '../consultas'
import { ui } from '../ui-estado'

/** Tela "Agenda": calendário do mês, o que existe no dia escolhido e os próximos eventos. */
export function telaAgenda(): string {
  const base = ui.mes || hojeISO().slice(0, 7)
  const [a, m] = base.split('-').map(Number)
  const inicio = new Date(a, m - 1, 1).getDay()
  const total = new Date(a, m, 0).getDate()
  const vazios = Array.from({ length: inicio }, () => `<i aria-hidden="true"></i>`).join('')
  const dias = Array.from({ length: total }, (_, i) => {
    const iso = paraISO(new Date(a, m - 1, i + 1))
    const tem = marcosDoDia(iso).length > 0
    const cl = [new Date(a, m - 1, i + 1).getDay() === 0 ? 'domingo' : '', tem ? 'prazo' : '', iso === hojeISO() ? 'hoje' : '', iso === ui.dia ? 'dia-ativo' : ''].join(' ')
    return `<button class="${cl}" aria-label="${i + 1} de ${MESES[m - 1]}${tem ? ', com prazo' : ''}" data-a="dia" data-dia="${iso}">${i + 1}</button>`
  }).join('')
  const doDia = marcosDoDia(ui.dia)
  const proximos = eventosFuturos().slice(0, 4)
  const linhaMarco = (mc: Marco): string =>
    `<button class="linha" data-a="abrirMarco" data-tipo="${mc.tipo}" data-id="${esc(mc.id)}"><span class="linha-texto"><span class="forte">${esc(mc.titulo)}</span><span class="apoio italico">${esc(mc.info)}</span></span></button>`
  return `<div class="pagina">
    <header class="cabeca">
      <p class="rotulo">Calendário de ${a}</p>
      <div class="mes"><h1>${MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1)}</h1>
        <span><button class="seta" aria-label="Mês anterior" data-a="mudarMes" data-p="-1">&#8592;</button><button class="seta" aria-label="Próximo mês" data-a="mudarMes" data-p="1">&#8594;</button></span></div>
    </header>
    <div class="grade">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => `<span>${d}</span>`).join('')}${vazios}${dias}</div>
    <section class="painel"><h2 class="rotulo">${dataLonga(ui.dia)}</h2>${doDia.length ? doDia.map(linhaMarco).join('') : `<p class="vazio">Nada marcado neste dia.</p>`}</section>
    <section class="painel"><h2 class="rotulo">Próximos eventos</h2>${proximos.length ? proximos.map((e) => linhaMarco({ tipo: 'evento', id: e.id, titulo: e.nome, info: `${dataLonga(e.data)}, faltam ${diasAte(e.data)} dias` })).join('') : `<p class="vazio">Marque um evento para ver a contagem regressiva.</p>`}</section>
    <button class="botao" data-a="novoEvento">Adicionar evento</button>
  </div>`
}
