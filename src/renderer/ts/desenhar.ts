import { ui, type NomeTela } from './ui-estado'
import { telaAgenda } from './telas/agenda'
import { telaCompras } from './telas/compras'
import { telaCosplay } from './telas/cosplay'
import { telaCosplays } from './telas/cosplays'
import { telaHoje } from './telas/hoje'
import { telaOficina } from './telas/oficina'

const TELAS: Record<NomeTela, () => string> = { hoje: telaHoje, cosplays: telaCosplays, cosplay: telaCosplay, agenda: telaAgenda, compras: telaCompras, oficina: telaOficina }
const NAV: [NomeTela, string][] = [['hoje', 'Hoje'], ['cosplays', 'Cosplays'], ['agenda', 'Agenda'], ['compras', 'Compras'], ['oficina', 'Oficina']]

let ultimaTela = ''

/**
 * Redesenha a tela atual e a barra de navegação.
 * A animação de entrada só roda quando a tela muda, e a posição da rolagem é mantida
 * quando é a mesma tela (por exemplo, depois de marcar uma tarefa).
 */
export function desenhar(): void {
  const tela = document.getElementById('tela')
  const barra = document.getElementById('barra')
  if (!tela || !barra) return
  const chave = ui.tela + (ui.tela === 'cosplay' ? ui.cosplayId : '')
  const mudou = chave !== ultimaTela
  const rolagem = tela.scrollTop
  tela.innerHTML = TELAS[ui.tela]()
  tela.scrollTop = mudou ? 0 : rolagem
  if (mudou) tela.firstElementChild?.classList.add('entrar')
  ultimaTela = chave
  const ativa = ui.tela === 'cosplay' ? 'cosplays' : ui.tela
  barra.innerHTML = NAV.map(([id, nome]) => `<button ${id === ativa ? 'aria-current="page"' : ''} data-a="ir" data-tela="${id}">${nome}</button>`).join('')
}
