import type Database from 'better-sqlite3'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gravarArquivoSeguro, renomearComTentativas } from '../arquivos'
import { nomeFotoValido } from '@shared/fotos'
import type { Estado } from '@shared/tipos'
import { fotosUsadas } from '@shared/validacao'
import { gravarEstado, lerEstado } from '../banco/repositorio'
import { ErroApp } from '../erros'
import { registrarLog } from '../log'
import { caminhoSeguroDaFoto } from '../fotos'
import type { Pastas } from '../pastas'
import { criarBackupZip } from './zip'

/**
 * Restauração segura de um backup.
 *
 * Objetivo: se algo falhar em QUALQUER ponto, os dados atuais continuam intactos.
 * Estratégia ("montar ao lado e trocar no final"):
 *   1. Antes de tudo, quem chama já validou o backup inteiro e criou uma cópia de segurança automática.
 *   2. As fotos novas são gravadas numa pasta temporária ao lado (fotos.novas-N), sem tocar em "fotos".
 *   3. Troca de pastas: "fotos" -> "fotos.antigas-N" e "fotos.novas-N" -> "fotos" (dois renames).
 *   4. O banco é substituído numa transação. Se falhar, o SQLite desfaz tudo e as pastas são
 *      trocadas de volta.
 *   5. Só depois do sucesso a pasta antiga é apagada.
 * Se o programa for interrompido no meio, `recuperarRestauracaoInterrompida` conserta no próximo início.
 */

export interface DadosParaRestaurar {
  estado: Estado
  fotos: Map<string, Uint8Array>
}

export interface OpcoesRestauracao {
  /** Permite os testes simularem uma falha na gravação do banco. */
  gravar?: (db: Database.Database, estado: Estado) => void
}

export function restaurarDados(db: Database.Database, pastas: Pastas, novo: DadosParaRestaurar, opcoes: OpcoesRestauracao = {}): void {
  const gravar = opcoes.gravar ?? gravarEstado
  const selo = Date.now()
  const novas = `${pastas.fotos}.novas-${selo}`
  const antigas = `${pastas.fotos}.antigas-${selo}`

  try {
    // Passo 2: pasta temporária com as fotos novas.
    mkdirSync(novas, { recursive: true })
    for (const [nome, bytes] of novo.fotos) {
      const destino = caminhoSeguroDaFoto(novas, nome)
      if (!destino) throw new ErroApp('O backup contém um nome de foto inseguro. Nada foi alterado.')
      writeFileSync(destino, bytes)
    }
  } catch (e) {
    rmSync(novas, { recursive: true, force: true })
    throw e instanceof ErroApp ? e : new ErroApp('Não foi possível preparar as fotos do backup. Seus dados atuais foram mantidos.')
  }

  // Passo 3: troca das pastas.
  try {
    // Renomear pastas com tentativas: o antivírus pode segurar a pasta por um instante.
    if (existsSync(pastas.fotos)) renomearComTentativas(pastas.fotos, antigas)
    renomearComTentativas(novas, pastas.fotos)
  } catch {
    // Desfaz o que tiver sido feito e mantém tudo como estava.
    try {
      if (!existsSync(pastas.fotos) && existsSync(antigas)) renomearComTentativas(antigas, pastas.fotos)
    } catch (e) {
      registrarLog('Falha ao desfazer a troca de pastas de fotos', e)
    }
    rmSync(novas, { recursive: true, force: true })
    throw new ErroApp('Não foi possível substituir as fotos (algum programa pode estar usando a pasta). Seus dados atuais foram mantidos.')
  }

  // Passo 4: banco (transação). Falhou? Volta as pastas.
  try {
    gravar(db, novo.estado)
  } catch (e) {
    try {
      // Devolve a pasta antiga ao lugar (a nova, já trocada, é descartada).
      rmSync(pastas.fotos, { recursive: true, force: true })
      if (existsSync(antigas)) renomearComTentativas(antigas, pastas.fotos)
      else mkdirSync(pastas.fotos, { recursive: true })
    } catch (e2) {
      registrarLog('Falha ao restaurar a pasta de fotos depois de erro no banco', e2)
    }
    registrarLog('Falha ao gravar o backup importado no banco', e)
    throw new ErroApp('Não foi possível gravar os dados importados. Seus dados atuais foram mantidos.')
  }

  // Passo 5: sucesso. Apagar a pasta antiga é só limpeza; se falhar, o app segue normalmente.
  try {
    rmSync(antigas, { recursive: true, force: true })
  } catch (e) {
    registrarLog('Não foi possível apagar a pasta antiga de fotos', e)
  }
}

/** Quantas cópias automáticas manter na pasta. */
const COPIAS_MANTIDAS = 10

/**
 * Cria a cópia de segurança automática (um .zip completo dos dados atuais) em "copias-automaticas".
 * Devolve o caminho. Se não conseguir criar, lança erro: a importação NÃO deve continuar sem cópia.
 */
export function criarCopiaAutomatica(db: Database.Database, pastas: Pastas, agora: Date = new Date()): string {
  try {
    mkdirSync(pastas.copias, { recursive: true })
    const estado = lerEstado(db)
    const zip = criarBackupZip(
      estado,
      (nome) => {
        const c = caminhoSeguroDaFoto(pastas.fotos, nome)
        return c && existsSync(c) ? new Uint8Array(readFileSync(c)) : null
      },
      agora
    )
    const carimbo = agora.toISOString().replace(/[:.]/g, '-')
    const destino = join(pastas.copias, `copia-antes-da-importacao-${carimbo}.zip`)
    gravarArquivoSeguro(destino, zip)

    // Mantém só as mais recentes.
    const antigas = readdirSync(pastas.copias)
      .filter((n) => /^copia-antes-da-importacao-.*\.zip$/.test(n))
      .map((n) => ({ n, t: statSync(join(pastas.copias, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
      .slice(COPIAS_MANTIDAS)
    antigas.forEach((a) => rmSync(join(pastas.copias, a.n), { force: true }))
    return destino
  } catch (e) {
    registrarLog('Falha ao criar a cópia de segurança automática', e)
    throw new ErroApp('Não foi possível criar a cópia de segurança antes de importar. Nada foi alterado.')
  }
}

/**
 * Chamar na inicialização. Conserta o que uma importação interrompida (queda de energia, app fechado
 * no meio) possa ter deixado:
 * - pastas "fotos.novas-N": nunca chegaram a valer; são apagadas;
 * - pastas "fotos.antigas-N": se algum arquivo que o banco usa não está em "fotos", ele é
 *   recuperado da pasta antiga; a pasta antiga só é apagada quando não falta mais nada.
 */
export function recuperarRestauracaoInterrompida(db: Database.Database, pastas: Pastas): void {
  const pai = pastas.base
  const prefixo = 'fotos.'
  for (const nome of readdirSync(pai)) {
    const completo = join(pai, nome)
    if (!nome.startsWith(prefixo)) continue
    if (nome.startsWith('fotos.novas-')) {
      rmSync(completo, { recursive: true, force: true })
    } else if (nome.startsWith('fotos.antigas-')) {
      const usadas = fotosUsadas(lerEstado(db))
      mkdirSync(pastas.fotos, { recursive: true })
      let faltando = 0
      for (const foto of usadas) {
        if (!nomeFotoValido(foto)) continue
        const destino = caminhoSeguroDaFoto(pastas.fotos, foto)
        const origem = caminhoSeguroDaFoto(completo, foto)
        if (!destino || !origem || existsSync(destino)) continue
        if (existsSync(origem)) copyFileSync(origem, destino)
        else faltando++
      }
      if (faltando === 0) rmSync(completo, { recursive: true, force: true })
      else registrarLog(`A pasta ${nome} foi mantida: ${faltando} foto(s) em uso não foram encontradas.`)
    }
  }
}
