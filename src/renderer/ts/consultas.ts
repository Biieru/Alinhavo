/**
 * Atalhos para as funções de cálculo, já ligadas ao estado atual.
 * As regras em si ficam em src/shared (puras e testadas); aqui só se passa o `estado`.
 */
import * as calc from '@shared/calculos'
import { gerarAvisos as gerarAvisosDe } from '@shared/avisos'
import { hojeISO } from '@shared/datas'
import type { Cosplay, Peca } from '@shared/tipos'
import { estado } from './estado'

export const cosplayPorId = (id: string) => calc.cosplayPorId(estado, id)
export const eventoPorId = (id: string) => calc.eventoPorId(estado, id)
export const etapasDe = (p: Peca) => calc.etapasDe(estado, p)
export const progresso = (c: Cosplay) => calc.progresso(estado, c)
export const pecaPronta = (p: Peca) => calc.pecaPronta(estado, p)
export const etapaAtual = (p: Peca) => calc.etapaAtual(estado, p)
export const comprasDe = (cosplayId: string) => calc.comprasDe(estado, cosplayId)
export const eventosFuturos = () => calc.eventosFuturos(estado, hojeISO())
export const cosplayAtivo = () => calc.cosplayAtivo(estado, hojeISO())
export const tarefasAbertas = () => calc.tarefasAbertas(estado)
export const marcosDoDia = (iso: string) => calc.marcosDoDia(estado, iso)
export const resumoCustos = (c: Cosplay) => calc.resumoCustos(estado, c)
export const tituloHoje = () => calc.tituloHoje(estado, hojeISO())
export const gerarAvisos = () => gerarAvisosDe(estado, hojeISO())
export const opcoesCosplay = (): [string, string][] => estado.cosplays.map((c) => [c.id, c.nome])
