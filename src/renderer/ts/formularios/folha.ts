import { esc } from '@shared/formato'

/**
 * Folha de formulário: uma única "folha" que sobe da parte de baixo e serve para qualquer
 * formulário. `abrirFolha` monta a folha a partir de uma lista de campos.
 */

/** Definição de um campo de formulário. */
export interface Campo {
  nome: string
  rotulo: string
  /** "select", "textarea" ou um tipo de <input> (text, number, date, time, url...). */
  tipo?: string
  /** Opções do "select": pares [valor, texto]. */
  opcoes?: [string, string][]
  valor?: unknown
  obrigatorio?: boolean
}

/** Valores enviados pelo formulário, por nome de campo. */
export type Valores = Record<string, string>

export interface OpcoesFolha {
  titulo: string
  campos?: Campo[]
  aoSalvar?: (valores: Valores) => void
  aoExcluir?: (() => void) | null
  /** HTML extra mostrado acima do formulário. */
  conteudo?: string
  textoSalvar?: string
}

/** A folha aberta no momento (ou null). `armado` controla a confirmação em dois toques do botão Excluir. */
export interface FolhaAberta {
  aoSalvar?: (valores: Valores) => void
  aoExcluir?: (() => void) | null
  armado: boolean
}

let folhaAtual: FolhaAberta | null = null
export const obterFolha = (): FolhaAberta | null => folhaAtual

function htmlCampo(c: Campo, i: number): string {
  const id = `campo-${i}`
  const req = c.obrigatorio ? 'required' : ''
  let controle: string
  if (c.tipo === 'select') {
    controle = `<select id="${id}" name="${c.nome}">${(c.opcoes ?? []).map(([v, r]) => `<option value="${esc(v)}" ${String(v) === String(c.valor ?? '') ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>`
  } else if (c.tipo === 'textarea') {
    controle = `<textarea id="${id}" name="${c.nome}" ${req}>${esc(c.valor)}</textarea>`
  } else {
    controle = `<input id="${id}" name="${c.nome}" type="${c.tipo || 'text'}" ${c.tipo === 'number' ? 'inputmode="decimal" step="any" min="0"' : ''} value="${esc(c.valor)}" ${req} autocomplete="off">`
  }
  return `<div class="campo"><label class="rotulo" for="${id}">${esc(c.rotulo)}</label>${controle}</div>`
}

export function abrirFolha({ titulo, campos = [], aoSalvar, aoExcluir, conteudo = '', textoSalvar = 'Salvar' }: OpcoesFolha): void {
  const raiz = document.getElementById('folha-raiz')
  if (!raiz) return
  folhaAtual = { aoSalvar, aoExcluir, armado: false }
  raiz.innerHTML = `<div class="veu" data-a="fecharVeu"><div class="folha" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <h2>${esc(titulo)}</h2>${conteudo}
    <form id="form-folha">${campos.map(htmlCampo).join('')}
      <div class="botoes">
        ${aoSalvar ? `<button class="botao cheio" type="submit">${esc(textoSalvar)}</button>` : ''}
        <button class="botao" type="button" data-a="fecharFolha">${aoSalvar ? 'Cancelar' : 'Fechar'}</button>
      </div>
      ${aoExcluir ? `<button class="botao perigo" type="button" data-a="excluir">Excluir</button>` : ''}
    </form></div></div>`
  const primeiro = document.querySelector<HTMLElement>('.folha input, .folha select, .folha textarea, .folha button')
  primeiro?.focus({ preventScroll: true })
}

export function fecharFolha(): void {
  const raiz = document.getElementById('folha-raiz')
  if (raiz) raiz.innerHTML = ''
  folhaAtual = null
}
