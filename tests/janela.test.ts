import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ajustarAosMonitores, ALTURA_MINIMA, JANELA_PADRAO, lerEstadoJanela, LARGURA_MINIMA, salvarEstadoJanela } from '../src/main/estado-janela'
import { pastasDeTeste } from './ajuda'

const monitor = { x: 0, y: 0, width: 1920, height: 1040 }

describe('tamanho e posição da janela', () => {
  it('mantém a posição quando a janela está dentro do monitor', () => {
    expect(ajustarAosMonitores({ x: 100, y: 80, width: 900, height: 700, maximizada: false }, [monitor])).toEqual({ x: 100, y: 80, width: 900, height: 700, maximizada: false })
  })

  it('descarta a posição se ela ficou fora de todos os monitores (ex.: monitor desconectado)', () => {
    const r = ajustarAosMonitores({ x: 2500, y: 100, width: 900, height: 700, maximizada: false }, [monitor])
    expect(r.x).toBeUndefined()
    expect(r.y).toBeUndefined()
    expect(r.width).toBe(900)
  })

  it('aceita posições negativas quando existe um monitor à esquerda', () => {
    const esquerda = { x: -1920, y: 0, width: 1920, height: 1040 }
    expect(ajustarAosMonitores({ x: -1500, y: 50, width: 900, height: 700, maximizada: false }, [esquerda, monitor]).x).toBe(-1500)
  })

  it('nunca fica menor que o mínimo que preserva o layout', () => {
    const r = ajustarAosMonitores({ width: 100, height: 100, maximizada: false }, [monitor])
    expect(r.width).toBe(LARGURA_MINIMA)
    expect(r.height).toBe(ALTURA_MINIMA)
  })

  it('salva e lê de volta; arquivo ausente ou corrompido volta ao padrão', () => {
    const p = pastasDeTeste()
    expect(lerEstadoJanela(p.janela, [monitor])).toEqual(ajustarAosMonitores(JANELA_PADRAO, [monitor]))
    salvarEstadoJanela(p.janela, { x: 10, y: 20, width: 800, height: 650, maximizada: true })
    expect(lerEstadoJanela(p.janela, [monitor])).toEqual({ x: 10, y: 20, width: 800, height: 650, maximizada: true })
    writeFileSync(join(p.base, 'janela.json'), '{ quebrado')
    expect(lerEstadoJanela(p.janela, [monitor]).width).toBe(JANELA_PADRAO.width)
  })
})
