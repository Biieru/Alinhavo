import Database from 'better-sqlite3'
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { abrirBanco } from '../src/main/banco/conexao'
import { executarMigracoes, MIGRACOES, ultimaVersao, versaoDoBanco, type Migracao } from '../src/main/banco/migracoes'
import { lerEstado } from '../src/main/banco/repositorio'
import { pastasDeTeste } from './ajuda'

const tabelas = (db: Database.Database): string[] =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((r) => r.name)

describe('migrações do banco', () => {
  it('a lista oficial começa na versão 1 e é contínua', () => {
    expect(MIGRACOES.map((m) => m.versao)).toEqual(MIGRACOES.map((_, i) => i + 1))
    expect(ultimaVersao()).toBeGreaterThanOrEqual(1)
  })

  it('banco novo recebe o esquema completo e a versão final', () => {
    const db = new Database(':memory:')
    const aplicadas = executarMigracoes(db)
    expect(aplicadas).toEqual(MIGRACOES.map((m) => m.versao))
    expect(versaoDoBanco(db)).toBe(ultimaVersao())
    expect(tabelas(db)).toEqual(['avisos_enviados', 'compras', 'cosplays', 'diario', 'etapas', 'eventos', 'medidas', 'meta', 'pecas', 'referencias', 'tarefas'])
  })

  it('rodar de novo não faz nada (idempotente)', () => {
    const db = new Database(':memory:')
    executarMigracoes(db)
    expect(executarMigracoes(db)).toEqual([])
  })

  it('aplica só as migrações que faltam, em ordem, mantendo os dados', () => {
    const db = new Database(':memory:')
    const v1: Migracao = { versao: 1, nome: 'a', aplicar: (d) => d.exec('CREATE TABLE t (a TEXT)') }
    const v2: Migracao = { versao: 2, nome: 'b', aplicar: (d) => d.exec('ALTER TABLE t ADD COLUMN b TEXT DEFAULT "novo"') }
    executarMigracoes(db, [v1])
    db.prepare('INSERT INTO t (a) VALUES (?)').run('antigo')
    expect(executarMigracoes(db, [v1, v2])).toEqual([2])
    expect(db.prepare('SELECT a, b FROM t').all()).toEqual([{ a: 'antigo', b: 'novo' }])
    expect(versaoDoBanco(db)).toBe(2)
  })

  it('migração que falha no meio é desfeita por inteiro e a versão não avança', () => {
    const db = new Database(':memory:')
    const v1: Migracao = { versao: 1, nome: 'a', aplicar: (d) => d.exec('CREATE TABLE t (a TEXT)') }
    const v2: Migracao = {
      versao: 2,
      nome: 'quebra',
      aplicar: (d) => {
        d.exec('CREATE TABLE criada_antes_do_erro (x TEXT)')
        d.exec('COMANDO INVÁLIDO')
      }
    }
    executarMigracoes(db, [v1])
    expect(() => executarMigracoes(db, [v1, v2])).toThrow()
    expect(versaoDoBanco(db)).toBe(1)
    expect(tabelas(db)).toEqual(['t']) // a tabela criada antes do erro também sumiu
  })

  it('recusa um banco de versão mais nova que a do app, sem tocar nele', () => {
    const db = new Database(':memory:')
    db.pragma('user_version = 999')
    expect(() => executarMigracoes(db)).toThrow('versão mais nova')
    expect(versaoDoBanco(db)).toBe(999)
  })

  it('recusa listas de migrações com buracos', () => {
    const db = new Database(':memory:')
    expect(() => executarMigracoes(db, [{ versao: 2, nome: 'x', aplicar: () => undefined }])).toThrow('Lista de migrações inválida')
  })

  it('abrirBanco cria o banco com a carga inicial do Gambit 97, só uma vez', async () => {
    const p = pastasDeTeste()
    const db = await abrirBanco(p.banco)
    expect(lerEstado(db).cosplays.map((c) => c.nome)).toEqual(['Gambit'])
    // Apaga o Gambit: ao reabrir, ele NÃO volta (a carga inicial só acontece na criação).
    db.prepare('DELETE FROM cosplays').run()
    db.close()
    const db2 = await abrirBanco(p.banco)
    expect(lerEstado(db2).cosplays).toEqual([])
    db2.close()
  })

  it('abrirBanco migra um banco antigo guardando uma cópia antes', async () => {
    const p = pastasDeTeste()
    // Banco "antigo": só a versão 1 oficial, com um dado guardado.
    const v1 = MIGRACOES[0]
    const antigo = new Database(p.banco)
    executarMigracoes(antigo, [v1])
    antigo.prepare("INSERT INTO meta (chave, valor) VALUES ('dado', 'dado-antigo')").run()
    antigo.close()

    // O app "novo" conhece uma versão 2.
    const v2: Migracao = { versao: 2, nome: 'b', aplicar: (d) => d.exec('CREATE TABLE extra (x TEXT)') }
    const db = await abrirBanco(p.banco, [v1, v2])
    expect(versaoDoBanco(db)).toBe(2)
    expect(db.prepare("SELECT valor FROM meta WHERE chave = 'dado'").get()).toEqual({ valor: 'dado-antigo' })
    expect(existsSync(`${p.banco}.antes-v1.bak`)).toBe(true)
    const copia = new Database(`${p.banco}.antes-v1.bak`, { readonly: true })
    expect(copia.prepare("SELECT valor FROM meta WHERE chave = 'dado'").all()).toEqual([{ valor: 'dado-antigo' }])
    expect(versaoDoBanco(copia)).toBe(1)
    copia.close()
    db.close()
  })

  it('arquivo que não é um banco gera erro claro e não é alterado', async () => {
    const p = pastasDeTeste()
    writeFileSync(p.banco, 'isto não é um banco sqlite, é só texto'.repeat(10))
    const copia = `${p.banco}.copia`
    copyFileSync(p.banco, copia)
    await expect(abrirBanco(p.banco)).rejects.toThrow(/banco de dados/)
    expect(existsSync(copia)).toBe(true)
  })
})
