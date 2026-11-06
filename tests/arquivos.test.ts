import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'

vi.mock('node:fs', async (original) => {
  const real = await original<typeof import('node:fs')>()
  return { ...real, renameSync: vi.fn(real.renameSync) }
})
import { gravarArquivoSeguro, renomearComTentativas } from '../src/main/arquivos'
import { pastasDeTeste } from './ajuda'

describe('gravação robusta de arquivos', () => {
  it('grava um arquivo novo e não deixa o temporário para trás', () => {
    const p = pastasDeTeste()
    const alvo = join(p.base, 'novo.json')
    gravarArquivoSeguro(alvo, '{"a":1}')
    expect(readFileSync(alvo, 'utf8')).toBe('{"a":1}')
    expect(existsSync(`${alvo}.tmp`)).toBe(false)
  })

  it('substitui um arquivo que já existe', () => {
    const p = pastasDeTeste()
    const alvo = join(p.base, 'janela.json')
    gravarArquivoSeguro(alvo, 'antigo')
    gravarArquivoSeguro(alvo, 'novo')
    expect(readFileSync(alvo, 'utf8')).toBe('novo')
    expect(readdirSync(p.base).filter((n) => n.endsWith('.tmp'))).toEqual([])
  })

  it('preserva o arquivo anterior quando a troca do temporário falha', () => {
    const p = pastasDeTeste()
    const alvo = join(p.base, 'backup.zip')
    writeFileSync(alvo, 'backup anterior')
    const falha = Object.assign(new Error('falha de disco'), { code: 'EIO' })
    const renomear = vi.mocked(fs.renameSync).mockImplementationOnce(() => { throw falha })
    try {
      expect(() => gravarArquivoSeguro(alvo, 'backup novo')).toThrow('falha de disco')
      expect(readFileSync(alvo, 'utf8')).toBe('backup anterior')
      expect(existsSync(`${alvo}.tmp`)).toBe(false)
    } finally { renomear.mockRestore() }
  })

  it('renomear pastas funciona e erros que não são passageiros são repassados na hora', () => {
    const p = pastasDeTeste()
    mkdirSync(join(p.base, 'a'))
    writeFileSync(join(p.base, 'a', 'x.txt'), 'x')
    renomearComTentativas(join(p.base, 'a'), join(p.base, 'b'))
    expect(existsSync(join(p.base, 'b', 'x.txt'))).toBe(true)
    // Origem inexistente (ENOENT) não é um erro passageiro: falha logo, sem ficar tentando.
    const inicio = Date.now()
    expect(() => renomearComTentativas(join(p.base, 'nao-existe'), join(p.base, 'c'))).toThrow()
    expect(Date.now() - inicio).toBeLessThan(500)
  })
})
