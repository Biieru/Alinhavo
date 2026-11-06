import { TIPOS } from '@shared/constantes'
import { esc, novoId } from '@shared/formato'
import type { Cosplay, Peca, TipoPeca } from '@shared/tipos'
import { etapasDe } from '../consultas'
import { concluir } from '../fluxo'
import { abrirFolha } from './folha'

/** Formulário de peça: cria uma nova quando `p` é omitida; senão edita `p`. */
export function formPeca(c: Cosplay, p?: Peca): void {
  abrirFolha({
    titulo: p ? 'Editar peça' : 'Nova peça',
    campos: [
      { nome: 'nome', rotulo: 'Nome da peça', valor: p?.nome, obrigatorio: true },
      { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: Object.entries(TIPOS), valor: p?.tipo || 'tecido' },
      { nome: 'nota', rotulo: 'Anotações', tipo: 'textarea', valor: p?.nota }
    ],
    aoSalvar(v) {
      const dados = { nome: v.nome, tipo: v.tipo as TipoPeca, nota: v.nota }
      if (p) {
        // Mudar o tipo troca a lista de etapas; por isso o andamento recomeça.
        if (dados.tipo !== p.tipo) p.feitas = 0
        Object.assign(p, dados)
      } else c.pecas.push({ id: novoId(), feitas: 0, ...dados })
      concluir('Peça salva')
    },
    aoExcluir: p
      ? () => {
          c.pecas = c.pecas.filter((x) => x !== p)
          c.tarefas.forEach((t) => {
            if (t.pecaId === p.id) t.pecaId = ''
          })
          concluir('Peça excluída')
        }
      : null
  })
}

/** Detalhe da peça: lista de etapas para marcar (marcar uma etapa conclui as anteriores). */
export function detalhePeca(c: Cosplay, p: Peca): void {
  const et = etapasDe(p)
  abrirFolha({
    titulo: p.nome,
    conteudo: `<p class="apoio">${esc(TIPOS[p.tipo])}. Toque na etapa concluída.</p>
      ${p.nota ? `<p class="apoio italico">${esc(p.nota)}</p>` : ''}
      <div>${et
        .map(
          (e, i) => `<label class="linha ${i < p.feitas ? 'feita' : ''}" style="min-height:50px">
        <span class="marcar"><input type="checkbox" data-mudar="etapa" data-c="${esc(c.id)}" data-id="${esc(p.id)}" data-i="${i}" ${i < p.feitas ? 'checked' : ''}></span>
        <span class="forte riscavel">${esc(e)}</span></label>`
        )
        .join('')}</div>
      <button class="botao" type="button" data-a="editarPeca" data-c="${esc(c.id)}" data-id="${esc(p.id)}">Editar peça</button>`
  })
}
