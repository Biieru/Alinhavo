import { DIAS, dataLonga, hojeISO } from '@shared/datas'
import { esc } from '@shared/formato'
import { cosplayAtivo, gerarAvisos, pecaPronta, progresso, tarefasAbertas, tituloHoje } from '../consultas'
import { estado } from '../estado'
import { linhaTarefa, regua } from './componentes'

/** Tela "Hoje": contagem para o próximo evento, molde em andamento, avisos e próximos pontos. */
export function telaHoje(): string {
  const agora = new Date()
  const c = cosplayAtivo()
  const avisos = gerarAvisos()
  const abertas = tarefasAbertas().slice(0, 5)
  const restantes = c ? c.pecas.filter((p) => !pecaPronta(p)).length : 0
  return `<div class="pagina">
    <header class="cabeca">
      <p class="rotulo">${DIAS[agora.getDay()]}, ${dataLonga(hojeISO())}</p>
      <h1>${esc(tituloHoje())}</h1>
    </header>
    ${
      c
        ? `<button class="cartao" data-a="abrirCosplay" data-id="${esc(c.id)}">
      <span class="rotulo">Molde em andamento</span>
      <span class="titulo-cartao">${esc(c.nome)}${c.obra ? ', ' + esc(c.obra) : ''}</span>
      ${regua(progresso(c))}
      <span class="apoio">${progresso(c)} de 100. ${restantes ? `Falta${restantes > 1 ? 'm' : ''} ${restantes} peça${restantes > 1 ? 's' : ''} para terminar.` : 'Todas as peças prontas.'}</span>
    </button>`
        : `<button class="botao" data-a="novoCosplay">Criar o primeiro cosplay</button>`
    }
    ${avisos.map((a) => `<button class="cartao cartao-aviso" data-a="irAviso" data-tela="${a.tela}" data-id="${a.id || ''}"><span class="rotulo">${esc(a.rotulo)}</span><span class="forte">${esc(a.texto)}</span></button>`).join('')}
    <section class="painel" aria-labelledby="pontos">
      <h2 id="pontos" class="rotulo">Próximos pontos</h2>
      ${abertas.length ? abertas.map(({ t, c: cc }) => linhaTarefa(t, cc, estado.cosplays.length > 1)).join('') : `<p class="vazio">Nenhuma tarefa aberta. Adicione o próximo passo.</p>`}
    </section>
    <button class="botao cheio" data-a="adicionarRapido">Adicionar</button>
  </div>`
}
