import { hojeISO, paraISO } from '@shared/datas'
import { esc } from '@shared/formato'
import type { TipoPeca } from '@shared/tipos'
import { exportarBackup, importarBackup } from './backup'
import { cosplayAtivo, cosplayPorId, eventoPorId } from './consultas'
import { desenhar } from './desenhar'
import { estado } from './estado'
import { concluir } from './fluxo'
import { formCompra } from './formularios/compra'
import { formCosplay } from './formularios/cosplay'
import { formEvento } from './formularios/evento'
import { abrirFolha, fecharFolha, obterFolha } from './formularios/folha'
import { formNota } from './formularios/nota'
import { formAvisos, formEtapas, formMedida } from './formularios/oficina'
import { detalhePeca, formPeca } from './formularios/peca'
import { formTarefa } from './formularios/tarefa'
import { urlFoto } from './imagens'
import { salvar } from './persistencia'
import { avisar } from './aviso'
import { ui, type AbaCosplay, type NomeTela } from './ui-estado'

/**
 * Ações: tudo o que acontece em cada toque/clique.
 * Todo botão tem data-a="nomeDaAcao"; o ouvinte único (eventos.ts) chama a função certa daqui.
 * Os atributos data-* do elemento chegam como `d` (por exemplo, data-id vira d.id).
 */
type Dados = Record<string, string>

/** Guarda quem pediu a imagem enquanto o seletor de arquivos está aberto. */
export let pedidoImagem: { destino: string; c: string } | null = null
export const limparPedidoImagem = (): void => {
  pedidoImagem = null
}

export const acoes: Record<string, (d: Dados, ev?: Event) => void> = {
  ir(d) {
    ui.tela = d.tela as NomeTela
    desenhar()
  },
  aba(d) {
    ui.aba = d.aba as AbaCosplay
    desenhar()
  },
  abaCompra(d) {
    ui.abaCompra = d.aba
    desenhar()
  },
  dia(d) {
    ui.dia = d.dia
    desenhar()
  },
  mudarMes(d) {
    const [a, m] = (ui.mes || hojeISO().slice(0, 7)).split('-').map(Number)
    ui.mes = paraISO(new Date(a, m - 1 + Number(d.p), 1)).slice(0, 7)
    desenhar()
  },
  abrirCosplay(d) {
    ui.cosplayId = d.id
    ui.tela = 'cosplay'
    ui.aba = 'Peças'
    desenhar()
  },
  irAviso(d) {
    if (d.tela === 'cosplay') acoes.abrirCosplay(d)
    else {
      ui.tela = 'compras'
      ui.abaCompra = 'A comprar'
      desenhar()
    }
  },
  abrirMarco(d) {
    if (d.tipo === 'evento') formEvento(eventoPorId(d.id))
    else if (d.tipo === 'compra') formCompra(estado.compras.find((i) => i.id === d.id))
    else {
      ui.aba = 'Tarefas'
      ui.cosplayId = d.id
      ui.tela = 'cosplay'
      desenhar()
    }
  },
  novoCosplay() {
    formCosplay()
  },
  editarCosplay(d) {
    formCosplay(cosplayPorId(d.id))
  },
  novaPeca(d) {
    const c = cosplayPorId(d.c)
    if (c) formPeca(c)
  },
  abrirPeca(d) {
    const c = cosplayPorId(d.c)
    const p = c?.pecas.find((x) => x.id === d.id)
    if (c && p) detalhePeca(c, p)
  },
  editarPeca(d) {
    const c = cosplayPorId(d.c)
    const p = c?.pecas.find((x) => x.id === d.id)
    if (c && p) formPeca(c, p)
  },
  novaTarefa(d) {
    const c = cosplayPorId(d.c)
    if (c) formTarefa(c)
  },
  editarTarefa(d) {
    const c = cosplayPorId(d.c)
    const t = c?.tarefas.find((x) => x.id === d.id)
    if (c && t) formTarefa(c, t)
  },
  novaCompra(d) {
    formCompra(undefined, d.c)
  },
  editarCompra(d) {
    formCompra(estado.compras.find((i) => i.id === d.id))
  },
  novoEvento() {
    formEvento()
  },
  novaNota(d) {
    const c = cosplayPorId(d.c)
    if (c) formNota(c)
  },
  editarDiario(d) {
    const c = cosplayPorId(d.c)
    const n = c?.diario.find((x) => x.id === d.id)
    if (c && n) formNota(c, n)
  },
  novaImagem(d) {
    pedidoImagem = { destino: d.destino, c: d.c }
    document.getElementById('arquivo-imagem')?.click()
  },
  editarReferencia(d) {
    const c = cosplayPorId(d.c)
    const r = c?.referencias.find((x) => x.id === d.id)
    if (!c || !r) return
    abrirFolha({
      titulo: 'Referência',
      conteudo: `<img class="diario-foto" style="max-height:none" src="${esc(urlFoto(r.arquivo))}" alt="${esc(r.nota || 'Imagem de referência')}">`,
      campos: [{ nome: 'nota', rotulo: 'Legenda', valor: r.nota }],
      aoSalvar(v) {
        r.nota = v.nota
        concluir('Legenda salva')
      },
      aoExcluir() {
        c.referencias = c.referencias.filter((x) => x !== r)
        concluir('Imagem excluída')
      }
    })
  },
  adicionarRapido() {
    if (!estado.cosplays.length) {
      formCosplay()
      return
    }
    const c = cosplayAtivo() || estado.cosplays[0]
    abrirFolha({
      titulo: 'Adicionar',
      conteudo: `<div class="botoes">
        <button class="botao" type="button" data-a="novaTarefa" data-c="${esc(c.id)}">Tarefa</button>
        <button class="botao" type="button" data-a="novaCompra" data-c="${esc(c.id)}">Compra</button>
        <button class="botao" type="button" data-a="novaNota" data-c="${esc(c.id)}">Nota</button>
        <button class="botao" type="button" data-a="novoEvento">Evento</button>
      </div>`
    })
  },
  novaMedida() {
    formMedida()
  },
  removerMedida(d) {
    estado.medidas = estado.medidas.filter((m) => m.id !== d.id)
    salvar()
    desenhar()
    avisar('Medida removida')
  },
  editarEtapas(d) {
    formEtapas(d.tipo as TipoPeca)
  },
  editarAvisos() {
    formAvisos()
  },
  exportar() {
    void exportarBackup()
  },
  importar() {
    void importarBackup()
  },
  excluir() {
    const folha = obterFolha()
    const b = document.querySelector('[data-a="excluir"]')
    if (!folha || !b) return
    // Primeiro toque arma o botão; o segundo exclui. Evita perda por toque acidental.
    if (!folha.armado) {
      folha.armado = true
      b.classList.add('armado')
      b.textContent = 'Confirmar exclusão'
      return
    }
    folha.aoExcluir?.()
  },
  fecharFolha() {
    fecharFolha()
  },
  fecharVeu(_d, ev) {
    if ((ev?.target as HTMLElement | null)?.classList.contains('veu')) fecharFolha()
  }
}
