import { existsSync, mkdirSync, readdirSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { caminhoSeguroDaFoto, ehArquivoComum, limparFotosSemUso, salvarFoto } from '../src/main/fotos'
import { extensaoPorConteudo, nomeFotoValido, tipoPorNome } from '../src/shared/fotos'
import { jpegFalso, pastasDeTeste } from './ajuda'

describe('fotos: nomes e caminhos seguros', () => {
  it('aceita nomes comuns de foto e recusa o resto', () => {
    for (const ok of ['a.jpg', '0f8e1c2e-aaaa-bbbb.png', 'Foto_1-final.JPEG', 'x.webp', 'y.gif']) expect(nomeFotoValido(ok), ok).toBe(true)
    for (const ruim of ['', '..', '../a.jpg', 'a/../b.jpg', '/etc/passwd', 'C:\\Windows\\x.jpg', 'a\\b.jpg', 'a b.jpg', 'a.jpg.exe', 'semextensao', '.oculto.jpg', 'a..b.jpg', 'a'.repeat(120) + '.jpg', 'a\0.jpg', 123, null, undefined]) {
      expect(nomeFotoValido(ruim), String(ruim)).toBe(false)
    }
  })

  it('o protocolo só resolve arquivos dentro da pasta de fotos e bloqueia ".." e variações', () => {
    const p = pastasDeTeste()
    expect(caminhoSeguroDaFoto(p.fotos, 'a.jpg')).toBe(join(p.fotos, 'a.jpg'))
    const tentativas = ['../alinhavo.db', '..\\alinhavo.db', '../fotos/a.jpg', '%2e%2e/a.jpg', 'sub/a.jpg', '/a.jpg', 'a.jpg/..', '....//a.jpg', '..', '.', '', 'C:/Windows/win.ini', '\\\\servidor\\x.jpg', 'a.jpg\0.png']
    for (const t of tentativas) expect(caminhoSeguroDaFoto(p.fotos, t), t).toBeNull()
  })

  it('não serve links simbólicos nem pastas como se fossem fotos', () => {
    const p = pastasDeTeste()
    mkdirSync(join(p.fotos, 'pasta.jpg'))
    expect(ehArquivoComum(join(p.fotos, 'pasta.jpg'))).toBe(false)
    writeFileSync(join(p.base, 'segredo.txt'), 'segredo')
    try {
      symlinkSync(join(p.base, 'segredo.txt'), join(p.fotos, 'atalho.jpg'))
      expect(ehArquivoComum(join(p.fotos, 'atalho.jpg'))).toBe(false)
    } catch {
      /* Windows sem permissão para criar link simbólico: este trecho não se aplica. */
    }
  })

  it('reconhece o tipo real da imagem pelos primeiros bytes', () => {
    expect(extensaoPorConteudo(jpegFalso())).toBe('jpg')
    expect(extensaoPorConteudo(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('png')
    expect(extensaoPorConteudo(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('gif')
    expect(extensaoPorConteudo(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('webp')
    expect(extensaoPorConteudo(new TextEncoder().encode('<html>não sou imagem</html>'))).toBeNull()
    expect(extensaoPorConteudo(new Uint8Array([]))).toBeNull()
    expect(tipoPorNome('a.PNG')).toBe('image/png')
  })
})

describe('fotos: gravação e limpeza', () => {
  it('salva a foto como arquivo com nome gerado e sem sobras temporárias', () => {
    const p = pastasDeTeste()
    const nome = salvarFoto(p.fotos, jpegFalso(100))
    expect(nome).toMatch(/^[0-9a-f-]{36}\.jpg$/)
    expect(existsSync(join(p.fotos, nome))).toBe(true)
    expect(readdirSync(p.fotos)).toEqual([nome])
  })

  it('recusa vazio, texto disfarçado de imagem, tipos errados e tamanhos absurdos', () => {
    const p = pastasDeTeste()
    expect(() => salvarFoto(p.fotos, new Uint8Array([]))).toThrow('Não foi possível ler')
    expect(() => salvarFoto(p.fotos, new TextEncoder().encode('MZ executável'))).toThrow('não é uma imagem')
    expect(() => salvarFoto(p.fotos, 'texto')).toThrow()
    expect(() => salvarFoto(p.fotos, null)).toThrow()
    expect(readdirSync(p.fotos)).toEqual([])
  })

  it('limpeza só apaga fotos sem uso e antigas; não mexe no resto', () => {
    const p = pastasDeTeste()
    const agora = Date.now()
    const antiga = join(p.fotos, 'antiga.jpg')
    const usada = join(p.fotos, 'usada.jpg')
    const recente = join(p.fotos, 'recente.jpg')
    const estranha = join(p.fotos, 'notas.txt')
    for (const f of [antiga, usada, recente, estranha]) writeFileSync(f, 'x')
    const velho = new Date(agora - 3 * 86400000)
    utimesSync(antiga, velho, velho)
    utimesSync(usada, velho, velho)
    utimesSync(estranha, velho, velho)
    expect(limparFotosSemUso(p.fotos, new Set(['usada.jpg']), agora)).toEqual(['antiga.jpg'])
    expect(readdirSync(p.fotos).sort()).toEqual(['notas.txt', 'recente.jpg', 'usada.jpg'])
  })
})
