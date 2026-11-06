import Database from 'better-sqlite3'
import { ErroApp } from '../erros'
import { executarMigracoes, MIGRACOES, ultimaVersao, versaoDoBanco, type Migracao } from './migracoes'
import { semearSeNecessario } from './repositorio'

/**
 * Abre (ou cria) o banco, aplica as migrações pendentes e faz a carga inicial.
 *
 * Segurança dos dados:
 * - Se o banco existente precisa ser migrado, antes é feita uma cópia "alinhavo.db.antes-vN.bak".
 * - Se o banco é de uma versão mais nova que o app, ele não é tocado.
 * - Se o arquivo estiver corrompido, o erro é claro e o arquivo continua como estava.
 */
export async function abrirBanco(caminho: string, migracoes: Migracao[] = MIGRACOES): Promise<Database.Database> {
  let db: Database.Database
  try {
    db = new Database(caminho)
  } catch (e) {
    throw new ErroApp(`Não foi possível abrir o banco de dados (${(e as Error).message}). O arquivo foi mantido sem alterações.`)
  }
  try {
    db.pragma('journal_mode = WAL') // Gravação segura: um corte de energia não corrompe o arquivo.
    db.pragma('synchronous = FULL')
    db.pragma('foreign_keys = ON') // Necessário para o ON DELETE CASCADE funcionar.
    db.pragma('busy_timeout = 5000')

    const atual = versaoDoBanco(db)
    if (atual > 0 && atual < ultimaVersao(migracoes)) await db.backup(`${caminho}.antes-v${atual}.bak`)

    executarMigracoes(db, migracoes)
    semearSeNecessario(db)
    return db
  } catch (e) {
    db.close()
    if (e instanceof ErroApp) throw e
    throw new ErroApp(`Não foi possível preparar o banco de dados (${(e as Error).message}). O arquivo foi mantido sem alterações.`)
  }
}
