// Estilos (a ordem importa: variáveis e base primeiro, janelas grandes por último).
import '../styles/fontes.css'
import '../styles/variaveis.css'
import '../styles/base.css'
import '../styles/superficies.css'
import '../styles/botoes.css'
import '../styles/abas.css'
import '../styles/listas.css'
import '../styles/envelope.css'
import '../styles/calendario.css'
import '../styles/compras.css'
import '../styles/referencias.css'
import '../styles/custos.css'
import '../styles/medidas.css'
import '../styles/navegacao.css'
import '../styles/formularios.css'
import '../styles/janelas-grandes.css'

import { esc } from '@shared/formato'
import { api } from './api'
import { desenhar } from './desenhar'
import { definirEstado } from './estado'
import { registrarEventos } from './eventos'

/**
 * Inicialização da interface:
 * 1) pede ao processo principal os dados salvos (banco SQLite);
 * 2) registra os ouvintes de eventos;
 * 3) desenha a primeira tela.
 * Se os dados não puderem ser lidos, mostra o motivo e NÃO deixa a pessoa editar nada,
 * para nunca sobrescrever dados existentes com um estado vazio.
 */
async function iniciar(): Promise<void> {
  const resposta = await api.carregarEstado().catch(() => null)
  if (!resposta || !resposta.ok) {
    const motivo = resposta && !resposta.ok ? resposta.erro : 'Tente fechar e abrir o Alinhavo de novo.'
    const tela = document.getElementById('tela')
    if (tela) tela.innerHTML = `<div class="pagina"><header class="cabeca"><p class="rotulo">Alinhavo</p><h1>Não foi possível abrir seus dados</h1></header><p class="apoio">${esc(motivo)}</p></div>`
    return
  }
  definirEstado(resposta.dados)
  registrarEventos()
  desenhar()
}

void iniciar()
