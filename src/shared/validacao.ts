/**
 * Validação e normalização do estado.
 *
 * Tudo que entra no banco passa por aqui: o que a interface manda salvar, o conteúdo de
 * um backup .zip e o JSON do protótipo. A função `normalizarEstado` recebe qualquer coisa
 * ("unknown"), confere cada campo e devolve um Estado limpo e completo, ou lança um
 * ErroValidacao com uma mensagem em português. Nada é alterado em disco antes dessa conferência.
 */
import { STATUS_COMPRA, STATUS_COSPLAY, TIPOS_CHAVES, VERSAO_ESTADO } from './constantes'
import { dataValida, horaValida } from './datas'
import { nomeFotoValido } from './fotos'
import { numero } from './formato'
import type { Compra, Cosplay, Estado, Evento, Medida, NotaDiario, Peca, Referencia, Tarefa, TipoPeca } from './tipos'

/** Erro de dados inválidos. A mensagem já é própria para ser mostrada à pessoa. */
export class ErroValidacao extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroValidacao'
  }
}

// Limites generosos para uso real, mas que barram arquivos absurdos ou corrompidos.
const MAX_ITENS = 20000
const MAX_TEXTO_CURTO = 500
const MAX_TEXTO_LONGO = 20000

type Obj = Record<string, unknown>

function objeto(v: unknown, onde: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new ErroValidacao(`Dados inválidos em "${onde}".`)
  return v as Obj
}

function lista(v: unknown, onde: string): unknown[] {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) throw new ErroValidacao(`Dados inválidos em "${onde}": era esperada uma lista.`)
  if (v.length > MAX_ITENS) throw new ErroValidacao(`Há itens demais em "${onde}".`)
  return v
}

/** Texto: aceita ausente (vira ""), número (vira texto) e string; rejeita o resto. */
function texto(v: unknown, onde: string, max = MAX_TEXTO_CURTO): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v !== 'string') throw new ErroValidacao(`Dados inválidos em "${onde}": era esperado um texto.`)
  if (v.length > max) throw new ErroValidacao(`O texto de "${onde}" é grande demais.`)
  return v
}

function textoObrigatorio(v: unknown, onde: string, max = MAX_TEXTO_CURTO): string {
  const t = texto(v, onde, max)
  if (!t.trim()) throw new ErroValidacao(`Falta o campo "${onde}".`)
  return t
}

/** Id: texto não vazio e sem repetição dentro do mesmo tipo de registro. */
function idUnico(v: unknown, onde: string, usados: Set<string>): string {
  if (typeof v !== 'string' || !v || v.length > 200) throw new ErroValidacao(`Registro sem identificador válido em "${onde}".`)
  if (usados.has(v)) throw new ErroValidacao(`Identificador repetido em "${onde}".`)
  usados.add(v)
  return v
}

/** Data "AAAA-MM-DD" real ou "" (quando permitido). */
function data(v: unknown, onde: string, obrigatoria = false): string {
  if (v === undefined || v === null || v === '') {
    if (obrigatoria) throw new ErroValidacao(`Falta a data em "${onde}".`)
    return ''
  }
  if (!dataValida(v)) throw new ErroValidacao(`Data inválida em "${onde}".`)
  return v
}

/** Número decimal não negativo (dinheiro, minutos). */
function decimal(v: unknown, maximo = 1e12): number {
  const n = typeof v === 'number' ? v : numero(v)
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), maximo) : 0
}

function inteiro(v: unknown, minimo: number, maximo: number, padrao: number): number {
  const n = typeof v === 'number' ? v : numero(v)
  if (!Number.isFinite(n)) return padrao
  return Math.min(Math.max(Math.round(n), minimo), maximo)
}

function enumerado<T extends string>(v: unknown, opcoes: readonly T[], onde: string): T {
  if (typeof v !== 'string' || !opcoes.includes(v as T)) throw new ErroValidacao(`Valor inválido em "${onde}".`)
  return v as T
}

/** Nome de arquivo de foto: "" (sem foto) ou um nome seguro. */
function arquivoFoto(v: unknown, onde: string): string {
  if (v === undefined || v === null || v === '') return ''
  if (!nomeFotoValido(v)) throw new ErroValidacao(`Nome de foto inválido em "${onde}".`)
  return v
}

function lerEtapas(v: unknown): Record<TipoPeca, string[]> {
  const o = objeto(v, 'etapas')
  const r = {} as Record<TipoPeca, string[]>
  for (const tipo of TIPOS_CHAVES) {
    const itens = lista(o[tipo], `etapas.${tipo}`)
      .map((e) => texto(e, `etapas.${tipo}`).trim())
      .filter(Boolean)
    if (!itens.length) throw new ErroValidacao(`A lista de etapas "${tipo}" está vazia.`)
    if (itens.length > 50) throw new ErroValidacao(`Há etapas demais em "${tipo}".`)
    r[tipo] = itens
  }
  return r
}

/**
 * Confere e limpa um estado vindo de fora. Devolve sempre um objeto novo (nunca reutiliza o recebido),
 * com todos os campos presentes e nos tipos certos.
 */
export function normalizarEstado(entrada: unknown): Estado {
  const raiz = objeto(entrada, 'dados')
  if (!Array.isArray(raiz.cosplays) || !raiz.etapas) throw new ErroValidacao('Esse arquivo não é um backup do Alinhavo.')

  const idsCosplay = new Set<string>()
  const idsPeca = new Set<string>()
  const idsTarefa = new Set<string>()
  const idsRef = new Set<string>()
  const idsDiario = new Set<string>()
  const idsEvento = new Set<string>()
  const idsCompra = new Set<string>()
  const idsMedida = new Set<string>()

  const etapas = lerEtapas(raiz.etapas)

  const cosplays: Cosplay[] = lista(raiz.cosplays, 'cosplays').map((bruto) => {
    const c = objeto(bruto, 'cosplay')
    const pecas: Peca[] = lista(c.pecas, 'peças').map((pb) => {
      const p = objeto(pb, 'peça')
      return {
        id: idUnico(p.id, 'peças', idsPeca),
        nome: textoObrigatorio(p.nome, 'nome da peça'),
        tipo: enumerado<TipoPeca>(p.tipo, TIPOS_CHAVES, 'tipo da peça'),
        feitas: inteiro(p.feitas, 0, 1000, 0),
        nota: texto(p.nota, 'anotações da peça', MAX_TEXTO_LONGO)
      }
    })
    const tarefas: Tarefa[] = lista(c.tarefas, 'tarefas').map((tb) => {
      const t = objeto(tb, 'tarefa')
      return {
        id: idUnico(t.id, 'tarefas', idsTarefa),
        nome: textoObrigatorio(t.nome, 'nome da tarefa'),
        pecaId: texto(t.pecaId, 'peça da tarefa', 200),
        prazo: data(t.prazo, 'prazo da tarefa'),
        minutos: Math.round(decimal(t.minutos, 1e7)),
        feita: t.feita === true
      }
    })
    const referencias: Referencia[] = []
    lista(c.referencias, 'referências').forEach((rb) => {
      const r = objeto(rb, 'referência')
      const id = idUnico(r.id, 'referências', idsRef)
      const arquivo = arquivoFoto(r.arquivo, 'referência')
      // Uma referência sem foto não tem utilidade; é descartada (acontece com fotos do protótipo que não puderam ser trazidas).
      if (arquivo) referencias.push({ id, arquivo, nota: texto(r.nota, 'legenda', MAX_TEXTO_CURTO * 4) })
    })
    const diario: NotaDiario[] = lista(c.diario, 'diário').map((nb) => {
      const n = objeto(nb, 'nota')
      return {
        id: idUnico(n.id, 'diário', idsDiario),
        data: data(n.data, 'data da nota', true),
        texto: textoObrigatorio(n.texto, 'texto da nota', MAX_TEXTO_LONGO),
        arquivo: arquivoFoto(n.arquivo, 'nota')
      }
    })
    return {
      id: idUnico(c.id, 'cosplays', idsCosplay),
      nome: textoObrigatorio(c.nome, 'nome do cosplay'),
      obra: texto(c.obra, 'obra'),
      status: enumerado(c.status, STATUS_COSPLAY, 'situação do cosplay'),
      orcamento: decimal(c.orcamento),
      eventoId: texto(c.eventoId, 'evento do cosplay', 200),
      pecas,
      tarefas,
      referencias,
      diario
    }
  })

  const eventos: Evento[] = lista(raiz.eventos, 'eventos').map((eb) => {
    const e = objeto(eb, 'evento')
    return { id: idUnico(e.id, 'eventos', idsEvento), nome: textoObrigatorio(e.nome, 'nome do evento'), data: data(e.data, 'data do evento'), local: texto(e.local, 'local do evento') }
  })

  const compras: Compra[] = lista(raiz.compras, 'compras').map((ib) => {
    const i = objeto(ib, 'compra')
    return {
      id: idUnico(i.id, 'compras', idsCompra),
      nome: textoObrigatorio(i.nome, 'nome do item'),
      cosplayId: texto(i.cosplayId, 'molde do item', 200),
      status: enumerado(i.status, STATUS_COMPRA, 'situação da compra'),
      preco: decimal(i.preco),
      loja: texto(i.loja, 'loja'),
      prazo: data(i.prazo, 'prazo da compra'),
      link: texto(i.link, 'link', 2000)
    }
  })

  const medidas: Medida[] = lista(raiz.medidas, 'medidas').map((mb) => {
    const m = objeto(mb, 'medida')
    return { id: idUnico(m.id, 'medidas', idsMedida), grupo: textoObrigatorio(m.grupo, 'grupo da medida'), nome: textoObrigatorio(m.nome, 'nome da medida'), valor: texto(m.valor, 'valor da medida', 50) }
  })

  const av = raiz.avisos && typeof raiz.avisos === 'object' ? (raiz.avisos as Obj) : {}

  return {
    versao: VERSAO_ESTADO,
    atualizadoEm: typeof raiz.atualizadoEm === 'number' && Number.isFinite(raiz.atualizadoEm) && raiz.atualizadoEm > 0 ? raiz.atualizadoEm : 0,
    etapas,
    cosplays,
    eventos,
    compras,
    medidas,
    avisos: { hora: horaValida(av.hora) ? av.hora : '19:00', diasCompra: inteiro(av.diasCompra, 0, 365, 3) }
  }
}

/** Todos os nomes de foto usados por um estado (sem repetições). */
export function fotosUsadas(estado: Estado): Set<string> {
  const s = new Set<string>()
  estado.cosplays.forEach((c) => {
    c.referencias.forEach((r) => r.arquivo && s.add(r.arquivo))
    c.diario.forEach((n) => n.arquivo && s.add(n.arquivo))
  })
  return s
}
