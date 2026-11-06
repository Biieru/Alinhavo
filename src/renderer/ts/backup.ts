import { api } from './api'
import { avisar } from './aviso'
import { desenhar } from './desenhar'
import { definirEstado } from './estado'
import { aguardarSalvamentos } from './persistencia'
import { ui } from './ui-estado'

/**
 * Backup pela tela Oficina. Os diálogos de escolher arquivo, a validação, a cópia de segurança
 * automática e a troca dos dados acontecem no processo principal; aqui só se pede e se mostra o resultado.
 */

export async function exportarBackup(): Promise<void> {
  await aguardarSalvamentos() // garante que o backup inclui a última alteração
  const r = await api.exportarBackup()
  if (!r.ok) avisar(r.erro)
  else if (!r.dados.cancelado) avisar('Backup concluído')
}

export async function importarBackup(): Promise<void> {
  await aguardarSalvamentos() // evita que um salvamento antigo passe por cima do backup importado
  const r = await api.importarBackup()
  if (!r.ok) {
    avisar(r.erro)
    return
  }
  if (r.dados.cancelado || !r.dados.estado) return
  definirEstado(r.dados.estado)
  ui.tela = 'hoje'
  ui.cosplayId = null
  desenhar()
  avisar(r.dados.avisos.length ? `Backup importado. ${r.dados.avisos.join(' ')}` : 'Backup importado')
}
