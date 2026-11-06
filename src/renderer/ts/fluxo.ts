import { avisar } from './aviso'
import { desenhar } from './desenhar'
import { fecharFolha } from './formularios/folha'
import { salvar } from './persistencia'

/** Final padrão de quase toda ação: salvar, fechar a folha, redesenhar e (opcionalmente) avisar. */
export function concluir(texto?: string): void {
  salvar()
  fecharFolha()
  desenhar()
  if (texto) avisar(texto)
}
