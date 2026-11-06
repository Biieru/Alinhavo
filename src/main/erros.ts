import { ErroValidacao } from '@shared/validacao'

/**
 * Erro "esperado" do app: a mensagem já está em português e pode ser mostrada à pessoa.
 * Qualquer outro tipo de erro é tratado como falha inesperada (vai para o log, e a pessoa
 * vê uma mensagem genérica).
 */
export class ErroApp extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroApp'
  }
}

/** True para erros "esperados" (arquivo inválido, dado recusado...), que não são defeitos do app. */
export const ehErroConhecido = (erro: unknown): boolean => erro instanceof ErroApp || erro instanceof ErroValidacao

/** Mensagem segura para mostrar à pessoa, a partir de qualquer erro capturado. */
export function mensagemParaUsuario(erro: unknown): string {
  if (erro instanceof ErroApp || erro instanceof ErroValidacao) return erro.message
  return 'Algo deu errado. Seus dados anteriores foram mantidos. Tente de novo.'
}
