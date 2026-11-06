import { TIPOS, TIPOS_CHAVES } from '@shared/constantes'
import { esc } from '@shared/formato'
import { estado } from '../estado'

/** Tela "Oficina": medidas, etapas por tipo de peça, avisos e backup. */
export function telaOficina(): string {
  const grupos = [...new Set(estado.medidas.map((m) => m.grupo))]
  return `<div class="pagina">
    <header class="cabeca"><p class="rotulo">Oficina</p><h1>Minhas medidas</h1></header>
    ${grupos
      .map(
        (g) => `<section class="painel"><h2 class="rotulo">${esc(g)}</h2>${estado.medidas
          .filter((m) => m.grupo === g)
          .map(
            (m) => `<div class="medida">
      <label for="medida-${esc(m.id)}">${esc(m.nome)}</label>
      <input id="medida-${esc(m.id)}" inputmode="decimal" autocomplete="off" aria-label="${esc(m.nome)}, em centímetros" value="${esc(m.valor)}" data-mudar="medida" data-id="${esc(m.id)}">
      <span class="apoio">cm</span>
      <button class="tirar" aria-label="Remover ${esc(m.nome)}" data-a="removerMedida" data-id="${esc(m.id)}">&times;</button>
    </div>`
          )
          .join('')}</section>`
      )
      .join('')}
    <button class="botao" data-a="novaMedida">Adicionar medida</button>
    <section class="painel"><h2 class="rotulo">Etapas por tipo de peça</h2>${TIPOS_CHAVES.map((t) => `<button class="linha" data-a="editarEtapas" data-tipo="${t}"><span class="linha-texto"><span class="forte">${TIPOS[t]}</span><span class="apoio">${esc(estado.etapas[t].join(', '))}</span></span></button>`).join('')}</section>
    <section class="painel"><h2 class="rotulo">Avisos</h2>
      <button class="linha" data-a="editarAvisos"><span class="linha-texto"><span class="forte">Resumo às ${esc(estado.avisos.hora)}</span><span class="apoio">Compras avisam ${estado.avisos.diasCompra} dias antes. Os avisos aparecem em Hoje e como notificações do Windows.</span></span></button>
    </section>
    <section class="painel"><h2 class="rotulo">Backup</h2><p class="apoio">O arquivo .zip guarda textos, datas, medidas, valores e todas as fotos.</p>
      <div class="botoes" style="margin-top:10px"><button class="botao" data-a="exportar">Exportar</button><button class="botao" data-a="importar">Importar</button></div>
    </section>
  </div>`
}
