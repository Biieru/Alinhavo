import { strToU8, zipSync, type Zippable } from 'fflate'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { converterPrototipo } from '../src/main/backup/prototipo'
import { criarCopiaAutomatica, recuperarRestauracaoInterrompida, restaurarDados } from '../src/main/backup/restaurar'
import { aplicarImportacao, exportarParaArquivo, lerArquivoDeBackup } from '../src/main/backup/servico'
import { criarBackupZip, lerBackupZip } from '../src/main/backup/zip'
import { abrirBanco } from '../src/main/banco/conexao'
import { gravarEstado, lerEstado } from '../src/main/banco/repositorio'
import { FORMATO_BACKUP } from '../src/shared/constantes'
import type { Estado } from '../src/shared/tipos'
import { estadoBase, jpegFalso, pastasDeTeste } from './ajuda'

/** Estado com duas fotos (uma referência e uma nota do diário). */
function estadoComFotos(): Estado {
  const e = estadoBase()
  e.cosplays[0].nome = 'Gambit com fotos'
  e.cosplays[0].referencias = [{ id: 'r1', arquivo: 'ref1.jpg', nota: 'frente' }]
  e.cosplays[0].diario = [{ id: 'n1', data: '2026-06-01', texto: 'nota', arquivo: 'nota1.jpg' }]
  return e
}

/** Monta um zip de backup válido, com possibilidade de alterar o conteúdo. */
function zipValido(extra: Zippable = {}, estado: Estado = estadoComFotos()): Uint8Array {
  return zipSync({
    'dados.json': strToU8(JSON.stringify({ formato: FORMATO_BACKUP, versaoFormato: 1, exportadoEm: 'x', estado })),
    'fotos/ref1.jpg': jpegFalso(10),
    'fotos/nota1.jpg': jpegFalso(20),
    ...extra
  })
}

describe('backup .zip: criar e ler', () => {
  it('ida e volta: o zip tem dados.json e as fotos, e a leitura devolve tudo igual', () => {
    const e = estadoComFotos()
    const zip = criarBackupZip(e, (nome) => (nome === 'ref1.jpg' ? jpegFalso(10) : nome === 'nota1.jpg' ? jpegFalso(20) : null))
    const lido = lerBackupZip(zip)
    expect(lido.estado).toEqual(e)
    expect([...lido.fotos.keys()].sort()).toEqual(['nota1.jpg', 'ref1.jpg'])
    expect(lido.fotos.get('ref1.jpg')).toEqual(jpegFalso(10))
    expect(lido.avisos).toEqual([])
  })

  it('exportação ignora fotos que sumiram do disco e o backup continua consistente', () => {
    const e = estadoComFotos()
    const zip = criarBackupZip(e, (nome) => (nome === 'ref1.jpg' ? jpegFalso(10) : null))
    const lido = lerBackupZip(zip)
    expect([...lido.fotos.keys()]).toEqual(['ref1.jpg'])
    expect(lido.estado.cosplays[0].diario[0].arquivo).toBe('')
    expect(lido.estado.cosplays[0].referencias).toHaveLength(1)
  })

  it('na importação, foto citada mas ausente do zip é removida e a pessoa é avisada', () => {
    const semUma = zipSync({
      'dados.json': strToU8(JSON.stringify({ formato: FORMATO_BACKUP, versaoFormato: 1, exportadoEm: 'x', estado: estadoComFotos() })),
      'fotos/nota1.jpg': jpegFalso(20)
    })
    const lido = lerBackupZip(semUma)
    expect(lido.avisos.join(' ')).toMatch(/1 foto não estava no backup/)
    expect(lido.estado.cosplays[0].referencias).toEqual([])
    expect(lido.estado.cosplays[0].diario[0].arquivo).toBe('nota1.jpg')
  })
})

describe('backup .zip: rejeita arquivos inseguros ou inválidos (antes de alterar qualquer coisa)', () => {
  const caminhosInseguros = ['../fora.txt', 'fotos/../../fora.jpg', 'fotos\\ref1.jpg', '/absoluto.txt', 'C:/Windows/x.jpg', 'C:\\x.jpg', 'fotos/sub/x.jpg', './dados.json', 'fotos//x.jpg']

  for (const caminho of caminhosInseguros) {
    it(`recusa o caminho ${JSON.stringify(caminho)}`, () => {
      const zip = zipValido({ [caminho]: jpegFalso() })
      expect(() => lerBackupZip(zip)).toThrow(/inseguro|inesperados/)
    })
  }

  it('recusa arquivos desconhecidos dentro do zip', () => {
    expect(() => lerBackupZip(zipValido({ 'programa.exe': strToU8('MZ') }))).toThrow('inesperados')
  })

  it('recusa zip sem dados.json', () => {
    expect(() => lerBackupZip(zipSync({ 'fotos/a.jpg': jpegFalso() }))).toThrow('falta o dados.json')
  })

  it('recusa arquivo que não é zip', () => {
    expect(() => lerBackupZip(strToU8('isto não é um zip de verdade, só texto qualquer'))).toThrow('corrompido ou não é um backup')
  })

  it('recusa dados.json corrompido, de outro formato ou de versão futura', () => {
    expect(() => lerBackupZip(zipSync({ 'dados.json': strToU8('{ quebrado') }))).toThrow('dados.json do backup está corrompido')
    expect(() => lerBackupZip(zipSync({ 'dados.json': strToU8(JSON.stringify({ formato: 'outro', versaoFormato: 1, estado: {} })) }))).toThrow('não é um backup do Alinhavo')
    expect(() => lerBackupZip(zipSync({ 'dados.json': strToU8(JSON.stringify({ formato: FORMATO_BACKUP, versaoFormato: 99, estado: estadoBase() })) }))).toThrow('versão mais nova')
  })

  it('recusa estado inválido dentro do dados.json', () => {
    const ruim = estadoComFotos()
    ruim.cosplays[0].referencias[0].arquivo = '../../fora.jpg'
    expect(() => lerBackupZip(zipValido({}, ruim))).toThrow(/Backup recusado/)
  })

  it('recusa "foto" que na verdade não é imagem', () => {
    expect(() => lerBackupZip(zipValido({ 'fotos/ref1.jpg': strToU8('<script>alert(1)</script>') }))).toThrow('não é imagem')
  })
})

describe('backup: restauração segura', () => {
  async function ambiente() {
    const p = pastasDeTeste()
    const db = await abrirBanco(p.banco)
    const atual = estadoBase()
    atual.cosplays[0].nome = 'DADO ATUAL'
    atual.cosplays[0].referencias = [{ id: 'ra', arquivo: 'atual.jpg', nota: '' }]
    gravarEstado(db, atual)
    writeFileSync(join(p.fotos, 'atual.jpg'), jpegFalso(5))
    return { p, db, atual }
  }

  const novo = (): { estado: Estado; fotos: Map<string, Uint8Array> } => ({ estado: estadoComFotos(), fotos: new Map([['ref1.jpg', jpegFalso(10)], ['nota1.jpg', jpegFalso(20)]]) })

  it('importação bem-sucedida troca dados e fotos e limpa as pastas temporárias', async () => {
    const { p, db } = await ambiente()
    restaurarDados(db, p, novo())
    expect(lerEstado(db).cosplays[0].nome).toBe('Gambit com fotos')
    expect(readdirSync(p.fotos).sort()).toEqual(['nota1.jpg', 'ref1.jpg'])
    expect(readdirSync(p.base).filter((n) => n.startsWith('fotos.'))).toEqual([])
    db.close()
  })

  it('falha ao gravar no banco: os dados e as fotos anteriores continuam intactos', async () => {
    const { p, db, atual } = await ambiente()
    expect(() =>
      restaurarDados(db, p, novo(), {
        gravar: () => {
          throw new Error('falha simulada no meio da gravação')
        }
      })
    ).toThrow('Seus dados atuais foram mantidos')
    expect(lerEstado(db)).toEqual(atual)
    expect(readdirSync(p.fotos)).toEqual(['atual.jpg'])
    expect(readFileSync(join(p.fotos, 'atual.jpg'))).toEqual(Buffer.from(jpegFalso(5)))
    expect(readdirSync(p.base).filter((n) => n.startsWith('fotos.'))).toEqual([])
    db.close()
  })

  it('transação do banco desfeita no meio (dado repetido) também preserva tudo', async () => {
    const { p, db, atual } = await ambiente()
    const ruim = novo()
    ruim.estado.compras = [
      { id: 'dup', nome: 'a', cosplayId: 'x', status: 'A comprar', preco: 1, loja: '', prazo: '', link: '' },
      { id: 'dup', nome: 'b', cosplayId: 'x', status: 'A comprar', preco: 1, loja: '', prazo: '', link: '' }
    ]
    expect(() => restaurarDados(db, p, ruim)).toThrow('Seus dados atuais foram mantidos')
    expect(lerEstado(db)).toEqual(atual)
    expect(readdirSync(p.fotos)).toEqual(['atual.jpg'])
    db.close()
  })

  it('nome de foto inseguro em tempo de restauração aborta sem tocar nos dados atuais', async () => {
    const { p, db, atual } = await ambiente()
    const ruim = novo()
    ruim.fotos.set('../fora.jpg', jpegFalso())
    expect(() => restaurarDados(db, p, ruim)).toThrow('inseguro')
    expect(lerEstado(db)).toEqual(atual)
    expect(readdirSync(p.fotos)).toEqual(['atual.jpg'])
    expect(existsSync(join(p.base, 'fora.jpg'))).toBe(false)
    db.close()
  })

  it('cria a cópia de segurança automática, que é um backup válido dos dados atuais', async () => {
    const { p, db, atual } = await ambiente()
    const caminho = criarCopiaAutomatica(db, p)
    expect(caminho.startsWith(p.copias)).toBe(true)
    const lido = lerBackupZip(new Uint8Array(readFileSync(caminho)))
    expect(lido.estado.cosplays[0].nome).toBe('DADO ATUAL')
    expect(lido.estado).toEqual(atual)
    expect([...lido.fotos.keys()]).toEqual(['atual.jpg'])
    db.close()
  })

  it('aplicarImportacao: cópia automática antes e dados novos depois', async () => {
    const { p, db } = await ambiente()
    const origem = join(p.base, 'externo.zip')
    writeFileSync(origem, zipValido())
    const lido = lerArquivoDeBackup(origem)
    const copia = aplicarImportacao(db, p, lido)
    expect(lerBackupZip(new Uint8Array(readFileSync(copia))).estado.cosplays[0].nome).toBe('DADO ATUAL')
    expect(lerEstado(db).cosplays[0].nome).toBe('Gambit com fotos')
    db.close()
  })

  it('arquivo inválido na importação não cria cópia nem altera nada (a validação vem primeiro)', async () => {
    const { p, db, atual } = await ambiente()
    const origem = join(p.base, 'ruim.zip')
    writeFileSync(origem, zipValido({ '../fora.txt': strToU8('x') }))
    expect(() => lerArquivoDeBackup(origem)).toThrow('inseguro')
    expect(readdirSync(p.copias)).toEqual([])
    expect(lerEstado(db)).toEqual(atual)
    db.close()
  })

  it('exportar para arquivo gera um .zip que pode ser reimportado', async () => {
    const { p, db } = await ambiente()
    const destino = join(p.base, 'saida.zip')
    exportarParaArquivo(db, p, destino)
    expect(existsSync(`${destino}.tmp`)).toBe(false)
    const lido = lerArquivoDeBackup(destino)
    expect(lido.estado.cosplays[0].nome).toBe('DADO ATUAL')
    expect(lido.fotos.has('atual.jpg')).toBe(true)
    db.close()
  })

  it('mantém só as 10 cópias automáticas mais recentes', async () => {
    const { p, db } = await ambiente()
    for (let i = 0; i < 12; i++) criarCopiaAutomatica(db, p, new Date(2026, 0, 1, 0, 0, i))
    expect(readdirSync(p.copias)).toHaveLength(10)
    db.close()
  })

  it('recupera uma importação interrompida: apaga rascunhos e recupera fotos que faltam', async () => {
    const { p, db } = await ambiente()
    // Situação: queda de energia depois de trocar as pastas e antes de gravar o banco.
    // O banco ainda aponta para atual.jpg, mas ela ficou na pasta antiga.
    const antigas = `${p.fotos}.antigas-1`
    const novas = `${p.fotos}.novas-2`
    mkdirSync(antigas)
    mkdirSync(novas)
    writeFileSync(join(antigas, 'atual.jpg'), jpegFalso(5))
    writeFileSync(join(novas, 'qualquer.jpg'), jpegFalso(5))
    rmSync(join(p.fotos, 'atual.jpg'))
    recuperarRestauracaoInterrompida(db, p)
    expect(existsSync(join(p.fotos, 'atual.jpg'))).toBe(true)
    expect(existsSync(antigas)).toBe(false)
    expect(existsSync(novas)).toBe(false)
    db.close()
  })
})


describe('importação do JSON do protótipo', () => {
  const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString('base64')

  function prototipo() {
    const e = estadoBase() as unknown as Record<string, unknown> & { cosplays: Record<string, unknown>[] }
    e.cosplays[0].referencias = [
      { id: 'r1', url: `data:image/png;base64,${pngBase64}`, nota: 'embutida' },
      { id: 'r2', url: 'https://example.com/foto-online.jpg', nota: 'on-line' }
    ]
    e.cosplays[0].diario = [
      { id: 'n1', data: '2026-06-01', texto: 'com foto', url: `data:image/png;base64,${pngBase64}` },
      { id: 'n2', data: '2026-06-02', texto: 'foto on-line', url: 'https://exemplo.com/x.jpg' },
      { id: 'n3', data: '2026-06-03', texto: 'sem foto' }
    ]
    return e
  }

  it('converte imagens embutidas em arquivos e avisa sobre as que estavam on-line', () => {
    const r = converterPrototipo(prototipo())
    expect(r.estado.cosplays[0].referencias).toHaveLength(1)
    expect(r.estado.cosplays[0].referencias[0]).toMatchObject({ id: 'r1', nota: 'embutida' })
    expect(r.estado.cosplays[0].referencias[0].arquivo).toMatch(/^[0-9a-f-]{36}\.png$/)
    expect(r.estado.cosplays[0].diario.map((n) => [n.id, n.arquivo !== ''])).toEqual([['n1', true], ['n2', false], ['n3', false]])
    expect(r.fotos.size).toBe(2)
    expect(r.avisos.join(' ')).toMatch(/2 fotos.*não puderam ser trazidas/)
  })

  it('importa o JSON do protótipo (sem fotos) por inteiro e sem alterar o original', () => {
    const base = estadoBase()
    base.cosplays[0].tarefas = [{ id: 't1', nome: 'Tarefa', pecaId: '', prazo: '2026-07-01', minutos: 30, feita: false }]
    const copia = JSON.stringify(base)
    const r = converterPrototipo(JSON.parse(copia))
    expect(r.estado.cosplays[0].tarefas).toEqual(base.cosplays[0].tarefas)
    expect(r.estado.etapas).toEqual(base.etapas)
    expect(r.avisos).toEqual([])
  })

  it('arquivo .json do protótipo passa por lerArquivoDeBackup; outro JSON qualquer é recusado', async () => {
    const p = pastasDeTeste()
    const arq = join(p.base, 'alinhavo-backup-2026-06-01.json')
    writeFileSync(arq, JSON.stringify(prototipo()))
    const lido = lerArquivoDeBackup(arq)
    expect(lido.estado.cosplays[0].nome).toBe('Gambit')
    const outro = join(p.base, 'outro.json')
    writeFileSync(outro, JSON.stringify({ nome: 'qualquer coisa' }))
    expect(() => lerArquivoDeBackup(outro)).toThrow('não é um backup do Alinhavo')
    const texto = join(p.base, 'texto.json')
    writeFileSync(texto, 'não é json')
    expect(() => lerArquivoDeBackup(texto)).toThrow('não é um backup do Alinhavo')
  })

  it('imagem embutida com conteúdo que não é imagem é descartada (não vira arquivo)', () => {
    const e = prototipo()
    e.cosplays[0].referencias = [{ id: 'r1', url: `data:image/png;base64,${Buffer.from('texto qualquer').toString('base64')}`, nota: '' }]
    const r = converterPrototipo(e)
    expect(r.estado.cosplays[0].referencias).toEqual([])
    expect(r.fotos.size).toBe(1) // só a do diário n1
  })
})
