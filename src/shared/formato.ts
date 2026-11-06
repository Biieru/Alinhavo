/** Funções de formatação e conversão de texto, dinheiro e números. */

/** Cria um identificador único para cada registro. */
export const novoId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Escapa texto digitado antes de colocá-lo no HTML. Sem isso, um "<" quebraria a tela. */
export const esc = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])

/** Mostra centavos só quando existem: "R$ 180" ou "R$ 180,50". */
export const reais = (n: unknown): string => {
  const valor = Number(n || 0)
  const c = Number.isInteger(valor) ? 0 : 2
  return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: 2 })
}

/** Aceita "12,50" e "12.50". Retorna 0 quando o campo está vazio ou inválido. */
export const numero = (v: unknown): number => {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Converte minutos em texto curto, como "1 h 30". */
export const duracao = (minutos: unknown): string => {
  const min = Number(minutos) || 0
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h} h${m ? ' ' + m : ''}` : `${m} min`
}

/** Letra da peça: A, B, C... depois de Z vira AA, AB... */
export const letraDe = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26))
