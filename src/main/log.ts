import { appendFileSync, mkdirSync, statSync, renameSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Registro simples em arquivo para investigar falhas inesperadas.
 * Não grava dados pessoais: só a hora, a descrição e a pilha do erro.
 * Quando passa de 1 MB, o arquivo vira "alinhavo.antigo.log" (só um é mantido).
 */
let pastaLogs: string | null = null

export function configurarLog(pasta: string): void {
  pastaLogs = pasta
}

export function registrarLog(descricao: string, erro?: unknown): void {
  const detalhe = erro instanceof Error ? (erro.stack ?? erro.message) : erro !== undefined ? String(erro) : ''
  const linha = `${new Date().toISOString()} ${descricao}${detalhe ? '\n' + detalhe : ''}\n`
  console.error(linha.trimEnd())
  if (!pastaLogs) return
  try {
    mkdirSync(pastaLogs, { recursive: true })
    const arquivo = join(pastaLogs, 'alinhavo.log')
    try {
      if (statSync(arquivo).size > 1024 * 1024) renameSync(arquivo, join(pastaLogs, 'alinhavo.antigo.log'))
    } catch {
      /* Arquivo ainda não existe: tudo bem. */
    }
    appendFileSync(arquivo, linha)
  } catch {
    /* Falha ao registrar não pode derrubar o app. */
  }
}
