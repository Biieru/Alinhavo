/** Mensagem curta que aparece depois de uma ação ("Molde salvo", "Backup concluído"...). */
let tempoAviso: ReturnType<typeof setTimeout> | undefined

export function avisar(texto: string): void {
  const el = document.getElementById('aviso')
  if (!el) return
  el.textContent = texto
  el.hidden = false
  clearTimeout(tempoAviso)
  // 2,6 s como no protótipo; mensagens longas ficam mais tempo para dar tempo de ler.
  tempoAviso = setTimeout(
    () => {
      el.hidden = true
    },
    Math.max(2600, texto.length * 70)
  )
}
