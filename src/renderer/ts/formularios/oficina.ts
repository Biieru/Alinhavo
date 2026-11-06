import { TIPOS } from '@shared/constantes'
import { horaValida } from '@shared/datas'
import { novoId, numero } from '@shared/formato'
import type { TipoPeca } from '@shared/tipos'
import { avisar } from '../aviso'
import { estado } from '../estado'
import { concluir } from '../fluxo'
import { abrirFolha } from './folha'

/** Formulários da tela Oficina: nova medida, etapas de um tipo de peça e configuração de avisos. */

export function formMedida(): void {
  abrirFolha({
    titulo: 'Nova medida',
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
      { nome: 'grupo', rotulo: 'Grupo', tipo: 'select', opcoes: [...new Set(['Corpo', 'Armadura', 'Cabeça', ...estado.medidas.map((m) => m.grupo)])].map((g): [string, string] => [g, g]) },
      { nome: 'valor', rotulo: 'Valor em centímetros', tipo: 'number' }
    ],
    aoSalvar(v) {
      estado.medidas.push({ id: novoId(), nome: v.nome, grupo: v.grupo, valor: v.valor ?? '' })
      concluir('Medida salva')
    }
  })
}

export function formEtapas(tipo: TipoPeca): void {
  abrirFolha({
    titulo: `Etapas: ${TIPOS[tipo]}`,
    conteudo: `<p class="apoio">Escreva uma etapa por linha. Se a lista ficar menor, as peças mantêm só as etapas que ainda existem.</p>`,
    campos: [{ nome: 'lista', rotulo: 'Etapas', tipo: 'textarea', valor: estado.etapas[tipo].join('\n'), obrigatorio: true }],
    aoSalvar(v) {
      const lista = v.lista
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      if (!lista.length) {
        avisar('Informe ao menos uma etapa')
        return
      }
      estado.etapas[tipo] = lista
      // Peças que estavam além do novo número de etapas passam a ficar "concluídas".
      estado.cosplays.forEach((c) =>
        c.pecas.forEach((p) => {
          if (p.tipo === tipo) p.feitas = Math.min(p.feitas, lista.length)
        })
      )
      concluir('Etapas salvas')
    }
  })
}

export function formAvisos(): void {
  abrirFolha({
    titulo: 'Avisos',
    campos: [
      { nome: 'hora', rotulo: 'Horário do resumo diário', tipo: 'time', valor: estado.avisos.hora },
      { nome: 'diasCompra', rotulo: 'Avisar compras quantos dias antes', tipo: 'number', valor: estado.avisos.diasCompra }
    ],
    aoSalvar(v) {
      estado.avisos = { hora: horaValida(v.hora) ? v.hora : '19:00', diasCompra: Math.round(numero(v.diasCompra)) }
      concluir('Avisos salvos')
    }
  })
}
