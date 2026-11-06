import { STATUS_COSPLAY } from '@shared/constantes'
import { novoId, numero } from '@shared/formato'
import type { Cosplay, StatusCosplay } from '@shared/tipos'
import { estado } from '../estado'
import { concluir } from '../fluxo'
import { ui } from '../ui-estado'
import { abrirFolha } from './folha'

/** Formulário de molde (cosplay): cria um novo quando `c` é omitido; senão edita `c`. */
export function formCosplay(c?: Cosplay): void {
  abrirFolha({
    titulo: c ? 'Editar molde' : 'Novo molde',
    campos: [
      { nome: 'nome', rotulo: 'Personagem', valor: c?.nome, obrigatorio: true },
      { nome: 'obra', rotulo: 'Obra ou versão', valor: c?.obra },
      { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: STATUS_COSPLAY.map((s) => [s, s]), valor: c?.status || 'Ideia' },
      { nome: 'eventoId', rotulo: 'Evento', tipo: 'select', opcoes: [['', 'Sem evento'], ...estado.eventos.map((e): [string, string] => [e.id, e.nome])], valor: c?.eventoId },
      { nome: 'orcamento', rotulo: 'Orçamento em reais', tipo: 'number', valor: c?.orcamento || '' }
    ],
    aoSalvar(v) {
      const dados = { nome: v.nome, obra: v.obra, status: v.status as StatusCosplay, eventoId: v.eventoId, orcamento: numero(v.orcamento) }
      if (c) Object.assign(c, dados)
      else {
        const novo: Cosplay = { id: novoId(), ...dados, pecas: [], tarefas: [], referencias: [], diario: [] }
        estado.cosplays.push(novo)
        ui.cosplayId = novo.id
        ui.tela = 'cosplay'
        ui.aba = 'Peças'
      }
      concluir('Molde salvo')
    },
    aoExcluir: c
      ? () => {
          // Excluir um molde leva junto as compras ligadas a ele.
          estado.cosplays = estado.cosplays.filter((x) => x !== c)
          estado.compras = estado.compras.filter((i) => i.cosplayId !== c.id)
          ui.tela = 'cosplays'
          concluir('Molde excluído')
        }
      : null
  })
}
