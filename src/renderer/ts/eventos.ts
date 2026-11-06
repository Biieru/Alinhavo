import { hojeISO } from '@shared/datas'
import { acoes, limparPedidoImagem, pedidoImagem } from './acoes'
import { avisar } from './aviso'
import { cosplayPorId } from './consultas'
import { desenhar } from './desenhar'
import { estado } from './estado'
import { fecharFolha, obterFolha, type Valores } from './formularios/folha'
import { formNota } from './formularios/nota'
import { ErroFoto, guardarImagem } from './imagens'
import { salvar } from './persistencia'
import { novoId } from '@shared/formato'

/**
 * Ouvintes de eventos do documento. Poucos ouvintes cuidam de tudo:
 * um para cliques, um para formulários, um para o teclado e um para as caixas de marcar e campos.
 */
export function registrarEventos(): void {
  // Um único ouvinte cuida de todos os cliques do app (delegação de eventos).
  document.addEventListener('click', (ev) => {
    const alvo = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-a]')
    const nome = alvo?.dataset.a
    if (alvo && nome && acoes[nome]) acoes[nome](alvo.dataset as Record<string, string>, ev)
  })

  // Envio de qualquer formulário em folha.
  document.addEventListener('submit', (ev) => {
    ev.preventDefault()
    const folha = obterFolha()
    if (!folha || !folha.aoSalvar) return
    folha.aoSalvar(Object.fromEntries(new FormData(ev.target as HTMLFormElement)) as Valores)
  })

  // Esc fecha a folha aberta.
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && obterFolha()) fecharFolha()
  })

  // Caixas de marcar (tarefas e etapas) e campos de medidas.
  document.addEventListener('change', (ev) => {
    const el = ev.target as HTMLInputElement
    const d = el.dataset
    if (d.mudar === 'tarefa') {
      const t = cosplayPorId(d.c ?? '')?.tarefas.find((x) => x.id === d.id)
      if (!t) return
      t.feita = el.checked
      // Mostra o risco primeiro e só depois reorganiza a lista.
      el.closest('.linha')?.classList.toggle('feita', el.checked)
      salvar()
      setTimeout(desenhar, 240)
    }
    if (d.mudar === 'etapa') {
      const p = cosplayPorId(d.c ?? '')?.pecas.find((x) => x.id === d.id)
      if (!p) return
      const i = Number(d.i)
      // Marcar uma etapa conclui as anteriores; desmarcar reabre a partir dela.
      p.feitas = el.checked ? i + 1 : i
      document.querySelectorAll<HTMLInputElement>('[data-mudar="etapa"]').forEach((x) => {
        const ok = Number(x.dataset.i) < p.feitas
        x.checked = ok
        x.closest('.linha')?.classList.toggle('feita', ok)
      })
      salvar()
      desenhar()
    }
    if (d.mudar === 'medida') {
      const m = estado.medidas.find((x) => x.id === d.id)
      if (!m) return
      m.valor = el.value.trim()
      salvar()
    }
  })

  // Foto escolhida no seletor de arquivos.
  document.getElementById('arquivo-imagem')?.addEventListener('change', async (ev) => {
    const entrada = ev.target as HTMLInputElement
    const arquivo = entrada.files?.[0]
    entrada.value = ''
    const pedido = pedidoImagem
    if (!arquivo || !pedido) return
    limparPedidoImagem()
    avisar('Preparando imagem')
    try {
      const nome = await guardarImagem(arquivo)
      const cos = cosplayPorId(pedido.c)
      if (!cos) return
      if (pedido.destino === 'referencia') {
        cos.referencias.push({ id: novoId(), arquivo: nome, nota: '' })
        salvar()
        desenhar()
        avisar('Imagem adicionada')
      } else formNota(cos, undefined, nome)
    } catch (erro) {
      avisar(erro instanceof ErroFoto ? erro.message : 'Não foi possível abrir essa imagem. Tente outro arquivo.')
    }
  })

  // Se o app ficou aberto na bandeja até virar o dia, ao voltar a data de "Hoje" é atualizada.
  let diaDesenhado = hojeISO()
  window.addEventListener('focus', () => {
    if (hojeISO() !== diaDesenhado && !obterFolha()) {
      diaDesenhado = hojeISO()
      desenhar()
    }
  })
}
