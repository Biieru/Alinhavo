/**
 * Funções de data.
 *
 * Regra do app: datas são guardadas como texto "AAAA-MM-DD". Assim não existe problema
 * de fuso horário nem de horário de verão: a data é só o dia, sem hora.
 */

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** Converte um objeto Date em "AAAA-MM-DD" usando o calendário local. */
export const paraISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Converte "AAAA-MM-DD" em Date, à meia-noite local. */
export const deISO = (s: string): Date => {
  const [a, m, d] = s.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** Data de hoje em "AAAA-MM-DD". O parâmetro existe para os testes poderem fixar "agora". */
export const hojeISO = (agora: Date = new Date()): string => paraISO(agora)

/**
 * Quantos dias faltam até a data (negativo se já passou).
 * Arredonda porque a diferença entre duas meias-noites pode variar uma hora em dias de horário de verão.
 */
export const diasAte = (iso: string, hoje: string = hojeISO()): number =>
  Math.round((deISO(iso).getTime() - deISO(hoje).getTime()) / 86400000)

/** "5 mar" */
export const dataCurta = (iso: string): string => {
  const d = deISO(iso)
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`
}

/** "5 de março" */
export const dataLonga = (iso: string): string => {
  const d = deISO(iso)
  return `${d.getDate()} de ${MESES[d.getMonth()]}`
}

/** Confere se o texto é uma data real no formato "AAAA-MM-DD" (rejeita, por exemplo, 2025-02-30). */
export const dataValida = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return paraISO(deISO(s)) === s
}

/** Confere o formato "HH:MM" (00:00 a 23:59). */
export const horaValida = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

/** Hora e minuto de um Date no formato "HH:MM", para comparar com o horário do resumo diário. */
export const horaDe = (d: Date): string => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
