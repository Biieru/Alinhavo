import { novoId, numero } from '@shared/formato'
import type { Cosplay, Tarefa } from '@shared/tipos'
import { cosplayPorId, opcoesCosplay } from '../consultas'
import { concluir } from '../fluxo'
import { abrirFolha } from './folha'

/** Formulário de tarefa: cria uma nova quando `t` é omitida; senão edita `t`. A tarefa pode mudar de molde. */
export function formTarefa(c: Cosplay, t?: Tarefa): void {
  abrirFolha({
    titulo: t ? 'Editar tarefa' : 'Nova tarefa',
    campos: [
      { nome: 'cosplay', rotulo: 'Molde', tipo: 'select', opcoes: opcoesCosplay(), valor: c.id },
      { nome: 'nome', rotulo: 'O que fazer', valor: t?.nome, obrigatorio: true },
      { nome: 'pecaId', rotulo: 'Peça', tipo: 'select', opcoes: [['', 'Sem peça'], ...c.pecas.map((p): [string, string] => [p.id, p.nome])], valor: t?.pecaId },
      { nome: 'prazo', rotulo: 'Prazo', tipo: 'date', valor: t?.prazo },
      { nome: 'minutos', rotulo: 'Tempo estimado em minutos', tipo: 'number', valor: t?.minutos || '' }
    ],
    aoSalvar(v) {
      const destino = cosplayPorId(v.cosplay) || c
      // A peça pertence ao molde de origem; se a tarefa muda de molde, a ligação com a peça é desfeita.
      const dados = { nome: v.nome, pecaId: destino === c ? v.pecaId : '', prazo: v.prazo, minutos: numero(v.minutos) }
      if (t) {
        Object.assign(t, dados)
        if (destino !== c) {
          c.tarefas = c.tarefas.filter((x) => x !== t)
          destino.tarefas.push(t)
        }
      } else destino.tarefas.push({ id: novoId(), feita: false, ...dados })
      concluir('Tarefa salva')
    },
    aoExcluir: t
      ? () => {
          c.tarefas = c.tarefas.filter((x) => x !== t)
          concluir('Tarefa excluída')
        }
      : null
  })
}
