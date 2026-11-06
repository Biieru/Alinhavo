/**
 * Estado do ciclo de vida do app, compartilhado entre janela, bandeja e índice.
 *
 * Fechar a janela NÃO encerra o app: ele vai para a bandeja do sistema, para as notificações
 * continuarem. Só "Sair" (menu da bandeja) ou o desligamento do Windows encerram de verdade.
 */
let saindo = false

export const estaSaindo = (): boolean => saindo
export const marcarSaida = (): void => {
  saindo = true
}
