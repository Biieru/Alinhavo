import { VERSAO_ESTADO } from './constantes'
import { novoId } from './formato'
import type { Estado, Peca, TipoPeca } from './tipos'

/**
 * O que o app traz na primeira abertura: apenas o projeto do Gambit 97 e as medidas/etapas
 * que o protótipo já definia. Nenhum dado inventado (sem eventos, compras ou tarefas).
 *
 * `gerarId` pode ser trocado nos testes para obter ids previsíveis.
 */
export function dadosIniciais(gerarId: () => string = novoId): Estado {
  const peca = (nome: string, tipo: TipoPeca): Peca => ({ id: gerarId(), nome, tipo, feitas: 0, nota: '' })
  const medidas = (grupo: string, nomes: string[]) => nomes.map((nome) => ({ id: gerarId(), grupo, nome, valor: '' }))

  return {
    versao: VERSAO_ESTADO,
    atualizadoEm: 0,
    etapas: {
      tecido: ['Molde', 'Corte', 'Costura', 'Acabamento'],
      armadura: ['Molde', 'Corte', 'Modelagem', 'Selagem', 'Pintura'],
      arma: ['Núcleo', 'Forma', 'Acabamento', 'Pintura'],
      comprar: ['Escolher', 'Pedir', 'Receber']
    },
    cosplays: [
      {
        id: gerarId(),
        nome: 'Gambit',
        obra: 'X-Men 97',
        status: 'Planejando',
        orcamento: 0,
        eventoId: '',
        pecas: [
          peca('Sobretudo', 'tecido'),
          peca('Macacão', 'tecido'),
          peca('Peça magenta', 'tecido'),
          peca('Capuz', 'tecido'),
          peca('Luvas', 'tecido'),
          peca('Joelheiras', 'armadura'),
          peca('Botas', 'armadura'),
          peca('Gola e acabamentos', 'armadura'),
          peca('Bastão', 'arma'),
          peca('Cartas', 'arma'),
          peca('Peruca', 'comprar'),
          peca('Fivelas', 'comprar')
        ],
        tarefas: [],
        referencias: [],
        diario: []
      }
    ],
    eventos: [],
    compras: [],
    medidas: [
      ...medidas('Corpo', ['Altura', 'Busto', 'Cintura', 'Quadril']),
      ...medidas('Armadura', ['Ombro a ombro', 'Perímetro do joelho', 'Perímetro da panturrilha']),
      ...medidas('Cabeça', ['Circunferência', 'Testa ao queixo'])
    ],
    avisos: { hora: '19:00', diasCompra: 3 }
  }
}
