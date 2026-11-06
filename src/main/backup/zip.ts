import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { FORMATO_BACKUP, VERSAO_FORMATO_BACKUP } from '@shared/constantes'
import { extensaoPorConteudo, nomeFotoValido, TAMANHO_MAXIMO_FOTO } from '@shared/fotos'
import { ErroValidacao, fotosUsadas, normalizarEstado } from '@shared/validacao'
import type { Estado } from '@shared/tipos'
import { ErroApp } from '../erros'

/**
 * Formato do backup: um .zip com
 *   dados.json        -> { formato, versaoFormato, exportadoEm, estado }
 *   fotos/<nome>.jpg  -> todas as fotos usadas pelos dados
 *
 * Estas funções trabalham só com bytes na memória (sem tocar em disco), por isso a LEITURA pode
 * validar tudo antes de qualquer arquivo ser alterado.
 */

// Limites de segurança contra arquivos gigantes ou "bombas de compressão".
export const LIMITE_ZIP_TOTAL = 1024 * 1024 * 1024 // 1 GB descompactado
export const LIMITE_DADOS_JSON = 100 * 1024 * 1024 // 100 MB
export const LIMITE_ARQUIVOS = 20000

export interface BackupLido {
  estado: Estado
  /** nome do arquivo -> bytes da foto (já conferidos). */
  fotos: Map<string, Uint8Array>
  /** Observações para mostrar à pessoa. */
  avisos: string[]
}

const inseguro = () => new ErroApp('O backup contém um caminho inseguro e foi recusado. Nada foi alterado.')

/** Remove do estado as referências a fotos que não existem (cada foto ausente vira um aviso). */
export function removerFotosAusentes(estado: Estado, existentes: Set<string>): { estado: Estado; removidas: number } {
  let removidas = 0
  const copia: Estado = structuredClone(estado)
  copia.cosplays.forEach((c) => {
    c.referencias = c.referencias.filter((r) => {
      if (existentes.has(r.arquivo)) return true
      removidas++
      return false
    })
    c.diario.forEach((n) => {
      if (n.arquivo && !existentes.has(n.arquivo)) {
        n.arquivo = ''
        removidas++
      }
    })
  })
  return { estado: copia, removidas }
}

/** Monta o .zip a partir do estado e das fotos lidas do disco. Fotos ausentes são ignoradas. */
export function criarBackupZip(estado: Estado, lerFoto: (nome: string) => Uint8Array | null, agora: Date = new Date()): Uint8Array {
  const fotos = new Map<string, Uint8Array>()
  for (const nome of fotosUsadas(estado)) {
    const bytes = lerFoto(nome)
    if (bytes) fotos.set(nome, bytes)
  }
  // Se alguma foto sumiu do disco, o backup não deve apontar para ela.
  const { estado: limpo } = removerFotosAusentes(estado, new Set(fotos.keys()))

  const conteudo: Zippable = {
    'dados.json': strToU8(JSON.stringify({ formato: FORMATO_BACKUP, versaoFormato: VERSAO_FORMATO_BACKUP, exportadoEm: agora.toISOString(), estado: limpo }, null, 2))
  }
  // JPEG/PNG/WebP já são comprimidos; guardar sem compressão é mais rápido e do mesmo tamanho.
  for (const [nome, bytes] of fotos) conteudo[`fotos/${nome}`] = [bytes, { level: 0 }]
  return zipSync(conteudo)
}

/** Confere o caminho de uma entrada do zip. Devolve a categoria ou lança erro. */
function classificarEntrada(nome: string): 'dados' | 'pasta-fotos' | 'foto' {
  // Qualquer sinal de caminho perigoso rejeita o arquivo inteiro.
  if (nome.includes('\\') || nome.includes(':') || nome.startsWith('/') || nome.includes('\0')) throw inseguro()
  const partes = nome.split('/')
  if (partes.some((p, i) => p === '..' || p === '.' || (p === '' && i !== partes.length - 1))) throw inseguro()

  if (nome === 'dados.json') return 'dados'
  if (nome === 'fotos/') return 'pasta-fotos'
  if (partes.length === 2 && partes[0] === 'fotos') {
    if (!nomeFotoValido(partes[1])) throw inseguro()
    return 'foto'
  }
  throw new ErroApp('O backup contém arquivos inesperados. Esse arquivo não parece ser um backup do Alinhavo.')
}

/**
 * Lê e VALIDA um backup .zip, só na memória. Em qualquer problema lança um erro com mensagem
 * clara; só quando tudo está certo devolve os dados.
 */
export function lerBackupZip(bytes: Uint8Array): BackupLido {
  // Passo 1: listar as entradas SEM descompactar nada, e checar nomes e tamanhos.
  const entradas: { nome: string; tamanho: number }[] = []
  try {
    unzipSync(bytes, {
      filter: (arquivo) => {
        entradas.push({ nome: arquivo.name, tamanho: arquivo.originalSize })
        return false
      }
    })
  } catch {
    throw new ErroApp('Esse arquivo .zip está corrompido ou não é um backup do Alinhavo.')
  }
  if (entradas.length === 0 || entradas.length > LIMITE_ARQUIVOS) throw new ErroApp('Esse arquivo .zip não parece ser um backup do Alinhavo.')

  const vistos = new Set<string>()
  let total = 0
  for (const e of entradas) {
    const tipo = classificarEntrada(e.nome)
    if (vistos.has(e.nome)) throw new ErroApp('O backup contém arquivos repetidos e foi recusado.')
    vistos.add(e.nome)
    total += e.tamanho
    if (tipo === 'dados' && e.tamanho > LIMITE_DADOS_JSON) throw new ErroApp('O arquivo de dados do backup é grande demais.')
    if (tipo === 'foto' && e.tamanho > TAMANHO_MAXIMO_FOTO) throw new ErroApp('O backup contém uma foto grande demais.')
  }
  if (total > LIMITE_ZIP_TOTAL) throw new ErroApp('O backup é grande demais para ser importado.')
  if (!vistos.has('dados.json')) throw new ErroApp('Esse arquivo .zip não é um backup do Alinhavo (falta o dados.json).')

  // Passo 2: descompactar só o que é permitido.
  let conteudo: Record<string, Uint8Array>
  try {
    conteudo = unzipSync(bytes, { filter: (a) => !a.name.endsWith('/') })
  } catch {
    throw new ErroApp('Esse arquivo .zip está corrompido e não pôde ser lido.')
  }

  // Passo 3: conferir o dados.json.
  let bruto: unknown
  try {
    bruto = JSON.parse(strFromU8(conteudo['dados.json']))
  } catch {
    throw new ErroApp('O dados.json do backup está corrompido.')
  }
  const cabecalho = bruto as { formato?: unknown; versaoFormato?: unknown; estado?: unknown } | null
  if (!cabecalho || cabecalho.formato !== FORMATO_BACKUP) throw new ErroApp('Esse arquivo não é um backup do Alinhavo.')
  if (typeof cabecalho.versaoFormato !== 'number' || cabecalho.versaoFormato > VERSAO_FORMATO_BACKUP) {
    throw new ErroApp('Esse backup foi criado por uma versão mais nova do Alinhavo. Atualize o app para importá-lo.')
  }
  let estado: Estado
  try {
    estado = normalizarEstado(cabecalho.estado)
  } catch (e) {
    if (e instanceof ErroValidacao) throw new ErroApp(`Backup recusado: ${e.message}`)
    throw e
  }

  // Passo 4: conferir o conteúdo real das fotos que os dados usam.
  const fotos = new Map<string, Uint8Array>()
  for (const nome of fotosUsadas(estado)) {
    const dados = conteudo[`fotos/${nome}`]
    if (!dados) continue // tratado abaixo como foto ausente
    if (!extensaoPorConteudo(dados)) throw new ErroApp(`O backup contém um arquivo que não é imagem (${nome}) e foi recusado.`)
    fotos.set(nome, dados)
  }

  const avisos: string[] = []
  const { estado: limpo, removidas } = removerFotosAusentes(estado, new Set(fotos.keys()))
  if (removidas) avisos.push(removidas > 1 ? `${removidas} fotos não estavam no backup e ficaram de fora.` : '1 foto não estava no backup e ficou de fora.')
  return { estado: limpo, fotos, avisos }
}
