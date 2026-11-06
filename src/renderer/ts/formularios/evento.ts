import { novoId } from '@shared/formato'
import type { Evento } from '@shared/tipos'
import { cosplayPorId, opcoesCosplay } from '../consultas'
import { estado } from '../estado'
import { concluir } from '../fluxo'
import { ui } from '../ui-estado'
import { abrirFolha } from './folha'

/**
 * Formulário de evento: cria um novo quando `e` é omitido; senão edita `e`.
 * O vínculo com o cosplay é guardado no cosplay (campo eventoId); por isso, ao salvar, o vínculo
 * antigo é limpo e o novo é gravado.
 */
export function formEvento(e?: Evento): void {
  abrirFolha({
    titulo: e ? 'Editar evento' : 'Novo evento',
    campos: [
      { nome: 'nome', rotulo: 'Nome do evento', valor: e?.nome, obrigatorio: true },
      { nome: 'data', rotulo: 'Data', tipo: 'date', valor: e?.data || ui.dia, obrigatorio: true },
      { nome: 'local', rotulo: 'Local', valor: e?.local },
      { nome: 'cosplayId', rotulo: 'Cosplay', tipo: 'select', opcoes: [['', 'Definir depois'], ...opcoesCosplay()], valor: e ? (estado.cosplays.find((c) => c.eventoId === e.id) || { id: '' }).id : '' }
    ],
    aoSalvar(v) {
      const dados = { nome: v.nome, data: v.data, local: v.local }
      let alvo: Evento
      if (e) {
        Object.assign(e, dados)
        alvo = e
      } else {
        alvo = { id: novoId(), ...dados }
        estado.eventos.push(alvo)
      }
      estado.cosplays.forEach((c) => {
        if (c.eventoId === alvo.id) c.eventoId = ''
      })
      const cos = v.cosplayId ? cosplayPorId(v.cosplayId) : undefined
      if (cos) cos.eventoId = alvo.id
      ui.dia = alvo.data
      ui.mes = alvo.data.slice(0, 7)
      concluir('Evento salvo')
    },
    aoExcluir: e
      ? () => {
          estado.eventos = estado.eventos.filter((x) => x !== e)
          estado.cosplays.forEach((c) => {
            if (c.eventoId === e.id) c.eventoId = ''
          })
          concluir('Evento excluído')
        }
      : null
  })
}
