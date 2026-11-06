import type Database from 'better-sqlite3'
import { ErroApp } from '../erros'

/**
 * Migrações do banco.
 *
 * Cada migração leva o banco de uma versão para a seguinte. A versão atual fica gravada no próprio
 * arquivo SQLite (`PRAGMA user_version`). Regras:
 * - Nunca edite uma migração que já foi lançada: crie uma nova com o número seguinte.
 * - Cada migração roda dentro de uma transação, junto com a atualização do número da versão.
 *   Se qualquer comando falhar, nada daquela migração fica pela metade.
 */
export interface Migracao {
  versao: number
  nome: string
  aplicar(db: Database.Database): void
}

/** Versão 1: o esquema completo do app. */
const ESQUEMA_V1 = `
  -- Valores soltos: data da última alteração, horário do resumo diário, marca da carga inicial.
  CREATE TABLE meta (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  -- Etapas de cada tipo de peça (tecido, armadura, arma, comprar), em ordem.
  CREATE TABLE etapas (
    tipo    TEXT NOT NULL,
    posicao INTEGER NOT NULL,
    nome    TEXT NOT NULL,
    PRIMARY KEY (tipo, posicao)
  );

  CREATE TABLE cosplays (
    id        TEXT PRIMARY KEY,
    posicao   INTEGER NOT NULL,
    nome      TEXT NOT NULL,
    obra      TEXT NOT NULL DEFAULT '',
    status    TEXT NOT NULL,
    orcamento REAL NOT NULL DEFAULT 0,
    evento_id TEXT NOT NULL DEFAULT ''
  );

  -- Tudo que pertence a um cosplay some junto com ele (ON DELETE CASCADE).
  CREATE TABLE pecas (
    id        TEXT PRIMARY KEY,
    cosplay_id TEXT NOT NULL REFERENCES cosplays(id) ON DELETE CASCADE,
    posicao   INTEGER NOT NULL,
    nome      TEXT NOT NULL,
    tipo      TEXT NOT NULL,
    feitas    INTEGER NOT NULL DEFAULT 0,
    nota      TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE tarefas (
    id        TEXT PRIMARY KEY,
    cosplay_id TEXT NOT NULL REFERENCES cosplays(id) ON DELETE CASCADE,
    posicao   INTEGER NOT NULL,
    nome      TEXT NOT NULL,
    peca_id   TEXT NOT NULL DEFAULT '',
    prazo     TEXT NOT NULL DEFAULT '',
    minutos   INTEGER NOT NULL DEFAULT 0,
    feita     INTEGER NOT NULL DEFAULT 0
  );

  -- Fotos: o banco guarda só o NOME do arquivo; a imagem fica na pasta "fotos".
  CREATE TABLE referencias (
    id        TEXT PRIMARY KEY,
    cosplay_id TEXT NOT NULL REFERENCES cosplays(id) ON DELETE CASCADE,
    posicao   INTEGER NOT NULL,
    arquivo   TEXT NOT NULL,
    nota      TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE diario (
    id        TEXT PRIMARY KEY,
    cosplay_id TEXT NOT NULL REFERENCES cosplays(id) ON DELETE CASCADE,
    posicao   INTEGER NOT NULL,
    data      TEXT NOT NULL,
    texto     TEXT NOT NULL,
    arquivo   TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE eventos (
    id      TEXT PRIMARY KEY,
    posicao INTEGER NOT NULL,
    nome    TEXT NOT NULL,
    data    TEXT NOT NULL DEFAULT '',
    local   TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE compras (
    id        TEXT PRIMARY KEY,
    posicao   INTEGER NOT NULL,
    nome      TEXT NOT NULL,
    cosplay_id TEXT NOT NULL DEFAULT '',
    status    TEXT NOT NULL,
    preco     REAL NOT NULL DEFAULT 0,
    loja      TEXT NOT NULL DEFAULT '',
    prazo     TEXT NOT NULL DEFAULT '',
    link      TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE medidas (
    id      TEXT PRIMARY KEY,
    posicao INTEGER NOT NULL,
    grupo   TEXT NOT NULL,
    nome    TEXT NOT NULL,
    valor   TEXT NOT NULL DEFAULT ''
  );

  -- Notificações já enviadas. A chave inclui o tipo, o item e o dia; por isso reiniciar o app
  -- não repete a notificação.
  CREATE TABLE avisos_enviados (
    chave      TEXT PRIMARY KEY,
    enviado_em INTEGER NOT NULL
  );

  CREATE INDEX idx_pecas_cosplay       ON pecas(cosplay_id);
  CREATE INDEX idx_tarefas_cosplay     ON tarefas(cosplay_id);
  CREATE INDEX idx_referencias_cosplay ON referencias(cosplay_id);
  CREATE INDEX idx_diario_cosplay      ON diario(cosplay_id);
`

/** Lista oficial de migrações, em ordem crescente e sem lacunas. */
export const MIGRACOES: Migracao[] = [{ versao: 1, nome: 'esquema inicial', aplicar: (db) => db.exec(ESQUEMA_V1) }]

export const versaoDoBanco = (db: Database.Database): number => Number(db.pragma('user_version', { simple: true }))

/** Última versão que este programa conhece. */
export const ultimaVersao = (migracoes: Migracao[] = MIGRACOES): number => migracoes[migracoes.length - 1]?.versao ?? 0

/** Confere se a lista de migrações é 1, 2, 3... sem buracos nem repetições. */
function conferirLista(migracoes: Migracao[]): void {
  migracoes.forEach((m, i) => {
    if (m.versao !== i + 1) throw new Error(`Lista de migrações inválida: esperado ${i + 1}, encontrado ${m.versao}.`)
  })
}

/**
 * Aplica as migrações que faltam. Devolve as versões aplicadas.
 * Se o banco for de uma versão MAIS NOVA que a deste programa, recusa (para não danificar dados).
 */
export function executarMigracoes(db: Database.Database, migracoes: Migracao[] = MIGRACOES): number[] {
  conferirLista(migracoes)
  const atual = versaoDoBanco(db)
  if (atual > ultimaVersao(migracoes)) {
    throw new ErroApp('Seus dados foram criados por uma versão mais nova do Alinhavo. Atualize o app para abri-los.')
  }
  const aplicadas: number[] = []
  for (const m of migracoes.filter((x) => x.versao > atual)) {
    // Migração + novo número de versão na mesma transação: ou entra tudo, ou nada.
    db.transaction(() => {
      m.aplicar(db)
      db.pragma(`user_version = ${m.versao}`)
    })()
    aplicadas.push(m.versao)
  }
  return aplicadas
}
