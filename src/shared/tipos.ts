/**
 * Tipos de dados do Alinhavo.
 *
 * O "Estado" tem exatamente o mesmo formato do objeto `estado` do protótipo em HTML,
 * com uma única diferença: as fotos deixam de ser URLs/imagens embutidas e passam a ser
 * apenas o NOME de um arquivo na pasta de fotos (campo `arquivo`).
 * Assim o banco guarda só a referência, e a imagem fica como arquivo no disco.
 */

/** Os quatro tipos de peça; cada tipo tem sua própria lista de etapas. */
export type TipoPeca = 'tecido' | 'armadura' | 'arma' | 'comprar'

export type StatusCosplay = 'Ideia' | 'Planejando' | 'Em produção' | 'Pronto' | 'Aposentado'
export type StatusCompra = 'A comprar' | 'A caminho' | 'Chegou'

export interface Peca {
  id: string
  nome: string
  tipo: TipoPeca
  /** Quantas etapas já foram concluídas (as etapas são sempre concluídas em ordem). */
  feitas: number
  nota: string
}

export interface Tarefa {
  id: string
  nome: string
  /** Id da peça relacionada, ou "" quando a tarefa não é de uma peça específica. */
  pecaId: string
  /** Data no formato "AAAA-MM-DD", ou "" quando não há prazo. */
  prazo: string
  minutos: number
  feita: boolean
}

export interface Referencia {
  id: string
  /** Nome do arquivo da foto dentro da pasta de fotos. */
  arquivo: string
  nota: string
}

export interface NotaDiario {
  id: string
  /** Data da nota, "AAAA-MM-DD". */
  data: string
  texto: string
  /** Nome do arquivo da foto da nota, ou "" quando não há foto. */
  arquivo: string
}

export interface Cosplay {
  id: string
  nome: string
  obra: string
  status: StatusCosplay
  orcamento: number
  /** Id do evento ao qual o cosplay se destina, ou "". */
  eventoId: string
  pecas: Peca[]
  tarefas: Tarefa[]
  referencias: Referencia[]
  diario: NotaDiario[]
}

export interface Evento {
  id: string
  nome: string
  /** "AAAA-MM-DD" (pode ser "" em dados antigos). */
  data: string
  local: string
}

export interface Compra {
  id: string
  nome: string
  cosplayId: string
  status: StatusCompra
  preco: number
  loja: string
  /** Para "A comprar": comprar até. Para "A caminho": previsão de chegada. */
  prazo: string
  link: string
}

export interface Medida {
  id: string
  grupo: string
  nome: string
  /** Texto digitado pela pessoa (ex.: "172" ou "60,5"); pode ser vazio. */
  valor: string
}

export interface ConfigAvisos {
  /** Horário do resumo diário, "HH:MM". */
  hora: string
  /** Quantos dias antes do prazo uma compra passa a gerar aviso. */
  diasCompra: number
}

export interface Estado {
  /** Versão do formato do estado (não é a versão do banco). */
  versao: number
  /** Momento da última alteração, em milissegundos desde 1970. */
  atualizadoEm: number
  etapas: Record<TipoPeca, string[]>
  cosplays: Cosplay[]
  eventos: Evento[]
  compras: Compra[]
  medidas: Medida[]
  avisos: ConfigAvisos
}

/** Um aviso mostrado na tela Hoje e também enviado como notificação do Windows. */
export interface Aviso {
  /** Data do prazo, "AAAA-MM-DD". */
  data: string
  rotulo: string
  texto: string
  tela: 'compras' | 'cosplay'
  /** Id do cosplay, quando o aviso leva a um cosplay. */
  id?: string
  /** Tipo e id do item, usados para evitar notificações repetidas. */
  origem: 'compra' | 'tarefa'
  itemId: string
}

/** Resposta padrão das funções expostas pelo preload: nunca lança erro, sempre devolve isto. */
export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string }
