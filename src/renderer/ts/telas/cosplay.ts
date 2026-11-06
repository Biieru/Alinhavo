import { dataLonga } from '@shared/datas'
import { TIPOS } from '@shared/constantes'
import { esc, letraDe, reais } from '@shared/formato'
import type { Cosplay, TipoPeca } from '@shared/tipos'
import { comprasDe, cosplayPorId, etapaAtual, etapasDe, eventoPorId, progresso, resumoCustos } from '../consultas'
import { estado } from '../estado'
import { urlFoto } from '../imagens'
import { ui, type AbaCosplay } from '../ui-estado'
import { linhaTarefa } from './componentes'
import { telaCosplays } from './cosplays'

/** Tela de um cosplay (o "envelope do molde") com as abas Peças, Tarefas, Referências, Custos e Diário. */

function abaPecas(c: Cosplay): string {
  const grupos = (Object.keys(TIPOS) as TipoPeca[])
    .map((tipo) => {
      const lista = c.pecas.filter((p) => p.tipo === tipo)
      if (!lista.length) return ''
      return `<section class="painel"><h2 class="rotulo">${TIPOS[tipo]}</h2>${lista
        .map((p) => {
          const e = etapasDe(p)
          return `<button class="linha" data-a="abrirPeca" data-c="${esc(c.id)}" data-id="${esc(p.id)}">
        <span class="letra">${letraDe(c.pecas.indexOf(p))}</span>
        <span class="linha-texto">
          <span class="forte">${esc(p.nome)}</span>
          <span class="pontos" aria-hidden="true">${e.map((_, i) => `<span class="${i < p.feitas ? 'ok' : ''}"></span>`).join('')}</span>
          <span class="apoio" style="font-size:15px">${esc(etapaAtual(p))}</span>
        </span>
      </button>`
        })
        .join('')}</section>`
    })
    .join('')
  return `${grupos || `<div class="painel"><p class="vazio">Nenhuma peça neste molde.</p></div>`}
    <button class="botao" data-a="novaPeca" data-c="${esc(c.id)}">Adicionar peça</button>`
}

function abaTarefas(c: Cosplay): string {
  const ordenadas = [...c.tarefas].sort((a, b) => Number(a.feita) - Number(b.feita) || (a.prazo || '9999').localeCompare(b.prazo || '9999'))
  return `<section class="painel">${ordenadas.length ? ordenadas.map((t) => linhaTarefa(t, c)).join('') : `<p class="vazio">Divida as peças em tarefas pequenas, com prazo e tempo estimado.</p>`}</section>
    <button class="botao" data-a="novaTarefa" data-c="${esc(c.id)}">Adicionar tarefa</button>`
}

function abaReferencias(c: Cosplay): string {
  return `${
    c.referencias.length
      ? `<div class="galeria">${c.referencias
          .map(
            (r) => `<button class="foto" data-a="editarReferencia" data-c="${esc(c.id)}" data-id="${esc(r.id)}">
      <img src="${esc(urlFoto(r.arquivo))}" alt="${esc(r.nota || 'Imagem de referência')}">${r.nota ? `<span>${esc(r.nota)}</span>` : ''}</button>`
          )
          .join('')}</div>`
      : `<div class="painel"><p class="vazio">Guarde aqui as imagens de frente, lado, costas e detalhes.</p></div>`
  }
    <button class="botao" data-a="novaImagem" data-destino="referencia" data-c="${esc(c.id)}">Adicionar imagem</button>`
}

function abaCustos(c: Cosplay): string {
  const itens = comprasDe(c.id)
  const { orcamento, previsto, comprado, acima, diferenca } = resumoCustos(c)
  return `<div class="contas">
      <div class="conta"><span>Orçamento</span><strong>${reais(orcamento)}</strong></div>
      <div class="conta"><span>Comprado</span><strong>${reais(comprado)}</strong></div>
      <div class="conta"><span>Previsto</span><strong>${reais(previsto)}</strong></div>
      <div class="conta"><span>${acima ? 'Acima do orçamento' : 'Sobra prevista'}</span><strong>${reais(diferenca)}</strong></div>
    </div>
    <section class="painel"><h2 class="rotulo">Itens do molde</h2>${
      itens.length
        ? itens.map((i) => `<button class="linha" data-a="editarCompra" data-id="${esc(i.id)}"><span class="linha-texto"><span class="forte">${esc(i.nome)}</span><span class="apoio italico">${esc(i.status)}</span></span><span class="preco">${reais(i.preco)}</span></button>`).join('')
        : `<p class="vazio">Os itens de compra deste molde aparecem aqui.</p>`
    }</section>
    <button class="botao" data-a="novaCompra" data-c="${esc(c.id)}">Adicionar item</button>`
}

function abaDiario(c: Cosplay): string {
  const lista = [...c.diario].sort((a, b) => b.data.localeCompare(a.data))
  return `<section class="painel">${
    lista.length
      ? lista.map((n) => `<button class="linha" data-a="editarDiario" data-c="${esc(c.id)}" data-id="${esc(n.id)}"><span class="linha-texto"><span class="rotulo">${dataLonga(n.data)}</span><span>${esc(n.texto)}</span>${n.arquivo ? `<img class="diario-foto" src="${esc(urlFoto(n.arquivo))}" alt="Foto do diário">` : ''}</span></button>`).join('')
      : `<p class="vazio">Anote soluções, erros e o que funcionou. Isso ajuda no próximo cosplay.</p>`
  }</section>
    <div class="botoes"><button class="botao" data-a="novaNota" data-c="${esc(c.id)}">Escrever nota</button><button class="botao" data-a="novaImagem" data-destino="diario" data-c="${esc(c.id)}">Nota com foto</button></div>`
}

export function telaCosplay(): string {
  const c = cosplayPorId(ui.cosplayId ?? '')
  if (!c) {
    ui.tela = 'cosplays'
    return telaCosplays()
  }
  const n = estado.cosplays.indexOf(c) + 1
  const ev = eventoPorId(c.eventoId)
  const abas: Record<AbaCosplay, (c: Cosplay) => string> = { Peças: abaPecas, Tarefas: abaTarefas, Referências: abaReferencias, Custos: abaCustos, Diário: abaDiario }
  return `<div class="pagina">
    <button class="voltar" style="margin-block:-12px -8px" data-a="ir" data-tela="cosplays">&#8592; Catálogo</button>
    <header class="envelope">
      <span class="entre"><span class="rotulo">Molde Nº ${n}</span><span class="rotulo">${c.pecas.length} peça${c.pecas.length === 1 ? '' : 's'}</span></span>
      <h1>${esc(c.nome)}</h1>
      <p class="apoio italico">${esc([c.obra, ev ? `para ${ev.nome}${ev.data ? ', ' + dataLonga(ev.data) : ''}` : ''].filter(Boolean).join(', ')) || 'Sem evento definido'}</p>
      <p class="apoio">${esc(c.status)}, ${progresso(c)} de 100</p>
      <button class="botao" data-a="editarCosplay" data-id="${esc(c.id)}">Editar molde</button>
    </header>
    <div class="abas" role="tablist">${(Object.keys(abas) as AbaCosplay[]).map((a) => `<button role="tab" aria-selected="${a === ui.aba}" data-a="aba" data-aba="${a}">${a}</button>`).join('')}</div>
    ${abas[ui.aba](c)}
  </div>`
}
