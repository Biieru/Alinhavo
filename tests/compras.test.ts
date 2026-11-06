import { describe, expect, it } from 'vitest'
import { comprasDe, resumoCustos, totalCompras } from '../src/shared/calculos'
import type { Compra } from '../src/shared/tipos'
import { estadoBase } from './ajuda'

const compra = (id: string, cosplayId: string, status: Compra['status'], preco: number): Compra => ({ id, nome: id, cosplayId, status, preco, loja: '', prazo: '', link: '' })

describe('compras e custos', () => {
  it('sem compras, tudo zero e a sobra é o orçamento', () => {
    const e = estadoBase()
    e.cosplays[0].orcamento = 500
    expect(resumoCustos(e, e.cosplays[0])).toEqual({ orcamento: 500, previsto: 0, comprado: 0, acima: false, diferenca: 500 })
  })

  it('previsto soma tudo; comprado soma só o que já foi pedido ou chegou', () => {
    const e = estadoBase()
    const c = e.cosplays[0]
    c.orcamento = 300
    e.compras = [compra('a', c.id, 'A comprar', 100), compra('b', c.id, 'A caminho', 80), compra('c', c.id, 'Chegou', 50.5), compra('x', 'outro-molde', 'Chegou', 999)]
    const r = resumoCustos(e, c)
    expect(r.previsto).toBe(230.5)
    expect(r.comprado).toBe(130.5)
    expect(r.acima).toBe(false)
    expect(r.diferenca).toBe(69.5)
    expect(comprasDe(e, c.id)).toHaveLength(3)
  })

  it('avisa "acima do orçamento" quando o previsto passa do orçamento', () => {
    const e = estadoBase()
    const c = e.cosplays[0]
    c.orcamento = 100
    e.compras = [compra('a', c.id, 'A comprar', 150)]
    expect(resumoCustos(e, c)).toMatchObject({ acima: true, diferenca: 50 })
  })

  it('sem orçamento definido nunca diz que está acima', () => {
    const e = estadoBase()
    const c = e.cosplays[0]
    c.orcamento = 0
    e.compras = [compra('a', c.id, 'A comprar', 150)]
    expect(resumoCustos(e, c).acima).toBe(false)
  })

  it('total de uma lista de compras (usado na tela Compras)', () => {
    expect(totalCompras([compra('a', 'x', 'A comprar', 10), compra('b', 'x', 'A comprar', 5.25)])).toBe(15.25)
    expect(totalCompras([])).toBe(0)
  })
})
