import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirEstado } from '../src/renderer/ts/estado'
import { ui } from '../src/renderer/ts/ui-estado'
import { telaCosplays } from '../src/renderer/ts/telas/cosplays'
import { telaCosplay } from '../src/renderer/ts/telas/cosplay'
import { telaCompras } from '../src/renderer/ts/telas/compras'
import { telaOficina } from '../src/renderer/ts/telas/oficina'
import { telaAgenda } from '../src/renderer/ts/telas/agenda'
import { telaHoje } from '../src/renderer/ts/telas/hoje'
import { linhaTarefa } from '../src/renderer/ts/telas/componentes'
import { normalizarEstado } from '../src/shared/validacao'
import { estadoBase } from './ajuda'

vi.mock('../src/renderer/ts/imagens', () => ({ urlFoto: (nome: string) => `alinhavo-foto://foto/${encodeURIComponent(nome)}` }))

// Identificadores também chegam de backups: não podem criar atributos ou tags na interface.
const injetado = '"><img src=x data-injetado="sim">'
const base = () => {
  const e = estadoBase()
  e.cosplays[0].id = injetado
  e.cosplays[0].pecas[0].id = injetado
  e.cosplays[0].tarefas = [{ id: injetado, nome: 'Costurar', pecaId: injetado, prazo: '2026-11-11', minutos: 30, feita: false }]
  e.compras = [{ id: injetado, nome: 'Tecido', cosplayId: injetado, status: 'A comprar', preco: 10, loja: '', prazo: '2026-11-11', link: '' }]
  e.eventos = [{ id: injetado, nome: 'Evento', data: '2026-11-11', local: '' }]
  e.medidas[0].id = injetado
  return normalizarEstado(e)
}

describe('identificadores importados são tratados como texto no HTML', () => {
  beforeEach(() => {
    definirEstado(base())
    Object.assign(ui, { cosplayId: injetado, aba: 'Peças', abaCompra: 'A comprar', dia: '2026-11-11', mes: '2026-11' })
  })
  afterEach(() => {
    definirEstado(estadoBase())
    Object.assign(ui, { cosplayId: null, aba: 'Peças', abaCompra: 'A comprar', mes: null })
  })
  it.each([
    ['catálogo', telaCosplays], ['molde', telaCosplay], ['compras', telaCompras],
    ['oficina', telaOficina], ['agenda', telaAgenda], ['hoje', telaHoje]
  ] as const)('não injeta marcação na tela %s', (_nome, renderizar) => {
    const html = renderizar()
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('data-injetado="sim"')
    expect(html).toContain('&lt;img')
  })
  it('protege os identificadores do checkbox e do botão de tarefa', () => {
    const e = base()
    const html = linhaTarefa(e.cosplays[0].tarefas[0], e.cosplays[0])
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('data-injetado="sim"')
  })
})
