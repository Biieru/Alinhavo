/**
 * Roteiro de testes ponta a ponta do Alinhavo (abre o app de verdade e usa a interface).
 *
 * Uso (na pasta do projeto, depois de `npm run build`):
 *   node scripts/teste-e2e/fluxo.mjs --exe <executavel> [--app <pasta-do-app>] [--dados <pasta>] [--secoes a,b,c] [--capturas <pasta>]
 *
 * Exemplos:
 *   Desenvolvimento (app compilado em out/):
 *     node scripts/teste-e2e/fluxo.mjs --exe node_modules/electron/dist/electron.exe --app . --dados %TEMP%\alinhavo-e2e
 *   App instalado, nos dados reais do usuário (sem --dados):
 *     node scripts/teste-e2e/fluxo.mjs --exe "%LOCALAPPDATA%\Programs\Alinhavo\Alinhavo.exe" --secoes inicio,crud,persistencia,bandeja,backup
 *
 * Seções: inicio, crud, persistencia, imagens, seguranca, notificacoes, bandeja, backup, layout
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { abrirApp, esperar, esperarAte, pagina } from './cdp.mjs'

const requerer = createRequire(resolve(import.meta.dirname, '../../package.json'))
const Database = requerer('better-sqlite3')
const { unzipSync, zipSync, strToU8 } = requerer('fflate')

// ---------- Argumentos ----------
const arg = (nome, padrao) => {
  const i = process.argv.indexOf(`--${nome}`)
  return i >= 0 ? process.argv[i + 1] : padrao
}
const exe = resolve(arg('exe'))
const appPasta = arg('app') ? resolve(arg('app')) : null
const dadosArg = arg('dados') ? resolve(arg('dados')) : null
const pastaDados = dadosArg ?? join(process.env.APPDATA, 'Alinhavo')
const capturas = arg('capturas') ? resolve(arg('capturas')) : null
const todas = ['inicio', 'crud', 'persistencia', 'imagens', 'seguranca', 'notificacoes', 'bandeja', 'backup', 'layout']
const secoes = (arg('secoes', todas.join(',')) ?? '').split(',').filter(Boolean)
if (capturas) mkdirSync(capturas, { recursive: true })
const pastaTemp = mkdtempSync(join(tmpdir(), 'alinhavo-e2e-arquivos-'))

// ---------- Mini-framework de testes ----------
const resultados = []
let secaoAtual = ''
async function etapa(nome, funcao) {
  const titulo = `[${secaoAtual}] ${nome}`
  try {
    await funcao()
    resultados.push({ titulo, ok: true })
    console.log(`  OK    ${titulo}`)
  } catch (e) {
    resultados.push({ titulo, ok: false, erro: e.message })
    console.log(`  FALHA ${titulo}\n        -> ${e.message}`)
  }
}
const confirmar = (condicao, mensagem) => {
  if (!condicao) throw new Error(mensagem)
}
const igual = (real, esperado, o_que) => {
  if (JSON.stringify(real) !== JSON.stringify(esperado)) throw new Error(`${o_que}: esperado ${JSON.stringify(esperado)}, recebido ${JSON.stringify(real)}`)
}

// ---------- Utilidades ----------
const iso = (dias = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const caminhoBanco = () => join(pastaDados, 'alinhavo.db')
function sql(consulta, ...params) {
  const bd = new Database(caminhoBanco(), { readonly: true, fileMustExist: true })
  try {
    return bd.prepare(consulta).all(...params)
  } finally {
    bd.close()
  }
}
const contar = (tabela) => sql(`SELECT COUNT(*) AS n FROM ${tabela}`)[0].n
const lerLog = () => (existsSync(join(pastaDados, 'logs', 'alinhavo.log')) ? readFileSync(join(pastaDados, 'logs', 'alinhavo.log'), 'utf8') : '')
const notificacoesNoLog = () => lerLog().split('\n').filter((l) => l.includes('Notificação exibida')).length
/** Espera o salvamento assíncrono chegar ao banco. */
const aguardarBanco = (condicao, descricao) => esperarAte(() => condicao(), descricao, 8000)

let app = null
async function abrir() {
  app = await abrirApp({ exe, argumentos: appPasta ? [appPasta] : [], dados: dadosArg ?? undefined })
  return app
}
async function sairDoApp() {
  await app.sair()
  app = null
}
async function reabrir() {
  await sairDoApp()
  await abrir()
}
const texto = () => pagina.texto(app)
const tela = (nome) => pagina.irPara(app, nome)
const botao = (t, raiz) => pagina.clicarTexto(app, t, raiz)
const folha = "document.querySelector('.folha')"
const errosDaInterface = () => app.errosPagina.filter((e) => !/Autofill|favicon/i.test(e))

/** Exclui o item aberto na folha (dois toques: Excluir, depois Confirmar exclusão). */
async function excluirNaFolha() {
  await botao('Excluir', folha)
  confirmar((await app.pagina.avaliar("document.querySelector('[data-a=\"excluir\"]').textContent")) === 'Confirmar exclusão', 'o botão deveria pedir confirmação')
  await botao('Confirmar exclusão', folha)
}

/** Troca as caixas de diálogo do Windows (que não dá para clicar) por respostas combinadas. */
async function combinarDialogos({ salvarEm, abrir, confirmacao = 0 }) {
  await app.principalAvaliar(`
    const d = electron.dialog;
    d.showSaveDialog = async () => (${JSON.stringify(salvarEm ?? null)} ? { canceled: false, filePath: ${JSON.stringify(salvarEm ?? '')} } : { canceled: true });
    d.showOpenDialog = async () => (${JSON.stringify(abrir ?? null)} ? { canceled: false, filePaths: [${JSON.stringify(abrir ?? '')}] } : { canceled: true, filePaths: [] });
    d.showMessageBox = async () => ({ response: ${confirmacao} });
    return 1;`)
}
async function combinarLinksExternos() {
  await app.principalAvaliar(`
    globalThis.__linksAbertos = [];
    electron.shell.openExternal = async (u) => { globalThis.__linksAbertos.push(u); };
    return 1;`)
}
const linksAbertos = () => app.principalAvaliar('return JSON.stringify(globalThis.__linksAbertos ?? [])').then(JSON.parse)

// =====================================================================
async function secaoInicio() {
  await abrir()
  await etapa('abre a janela do app, com visual e título corretos', async () => {
    await esperarAte(() => app.principalAvaliar('return electron.BrowserWindow.getAllWindows()[0].isVisible()'), 'a janela ficar visível')
    igual(await app.principalAvaliar('return electron.BrowserWindow.getAllWindows()[0].getTitle()'), 'Alinhavo', 'título da janela')
    igual(await app.pagina.avaliar('getComputedStyle(document.body).backgroundColor'), 'rgb(184, 164, 124)', 'cor de fundo')
    igual(await app.pagina.avaliar('getComputedStyle(document.querySelector("h1")).fontFamily.startsWith("\\"Old Standard TT\\"")'), true, 'fonte dos títulos')
  })
  await etapa('as fontes do projeto carregam sem internet (Old Standard TT e Special Elite)', async () => {
    const fontes = await app.pagina.avaliar(`(async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight + ' ' + f.style) })()`)
    confirmar(fontes.some((f) => f.includes('Old Standard TT')), 'Old Standard TT não carregou: ' + fontes)
    confirmar(fontes.some((f) => f.includes('Special Elite')), 'Special Elite não carregou: ' + fontes)
  })
  await etapa('mostra a tela Hoje com o projeto do Gambit 97 e a navegação de 5 abas', async () => {
    const t = await texto()
    for (const esperado of ['Nenhum evento marcado', 'Gambit, X-Men 97', '0 de 100. Faltam 12 peças para terminar.', 'Nenhuma tarefa aberta. Adicione o próximo passo.']) confirmar(t.includes(esperado), `falta o texto "${esperado}"`)
    igual(await app.pagina.avaliar('[...document.querySelectorAll("#barra button")].map(b => b.textContent)'), ['Hoje', 'Cosplays', 'Agenda', 'Compras', 'Oficina'], 'navegação')
  })
  await etapa('o banco SQLite foi criado nos dados do usuário com a carga inicial correta', async () => {
    confirmar(existsSync(caminhoBanco()), 'banco não existe em ' + caminhoBanco())
    igual(sql('PRAGMA user_version')[0].user_version, 1, 'versão do banco (migração)')
    igual(sql('SELECT nome, obra FROM cosplays'), [{ nome: 'Gambit', obra: 'X-Men 97' }], 'cosplays')
    igual(contar('pecas'), 12, 'peças do Gambit')
    for (const t of ['eventos', 'compras', 'tarefas', 'referencias', 'diario']) igual(contar(t), 0, `linhas em ${t} (sem dados inventados)`)
    igual(contar('medidas'), 9, 'medidas iniciais')
  })
  await etapa('percorre todas as telas sem erros no console', async () => {
    for (const nome of ['Cosplays', 'Agenda', 'Compras', 'Oficina', 'Hoje']) {
      await tela(nome)
      confirmar((await texto()).length > 20, `tela ${nome} vazia`)
      if (capturas) writeFileSync(join(capturas, `tela-${nome}.png`), await pagina.capturar(app))
    }
    igual(errosDaInterface(), [], 'erros na interface')
  })
  await etapa('textos do protótipo preservados (e os dois textos ajustados para o desktop)', async () => {
    await tela('Oficina')
    const t = await texto()
    for (const esperado of ['Minhas medidas', 'Etapas por tipo de peça', 'Resumo às 19:00', 'Compras avisam 3 dias antes.', 'Os avisos aparecem em Hoje e como notificações do Windows.', 'O arquivo .zip guarda textos, datas, medidas, valores e todas as fotos.', 'Exportar', 'Importar', 'Altura', 'Perímetro da panturrilha']) confirmar(t.includes(esperado), `falta "${esperado}"`)
    confirmar(!t.includes('protótipo'), 'ainda menciona "protótipo"')
    await tela('Hoje')
  })
}

// =====================================================================
async function secaoCrud() {
  if (!app) await abrir()
  await combinarLinksExternos()
  const idGambit = () => sql("SELECT id FROM cosplays WHERE nome = 'Gambit'")[0].id

  await etapa('criar evento (ligado ao Gambit) e ver a contagem regressiva em Hoje', async () => {
    await tela('Agenda')
    await botao('Adicionar evento')
    await pagina.preencher(app, { 'Nome do evento': 'Evento Teste', Data: iso(10), Local: 'Centro de Convenções', Cosplay: 'Gambit' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => contar('eventos') === 1, 'evento gravado')
    igual(sql('SELECT nome, data, local FROM eventos'), [{ nome: 'Evento Teste', data: iso(10), local: 'Centro de Convenções' }], 'evento no banco')
    igual(sql("SELECT evento_id FROM cosplays WHERE nome = 'Gambit'")[0].evento_id !== '', true, 'vínculo evento-cosplay')
    await tela('Hoje')
    confirmar((await texto()).includes('Faltam 10 dias para Evento Teste'), 'contagem regressiva ausente: ' + (await texto()).slice(0, 120))
    confirmar((await app.principalAvaliar('return 1')) === 1, 'principal responde')
  })
  await etapa('editar evento', async () => {
    await tela('Agenda')
    await botao('Evento Teste', "document.getElementById('tela')")
    await pagina.preencher(app, { 'Nome do evento': 'Evento Editado', Local: 'Outro local' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => sql('SELECT nome FROM eventos')[0]?.nome === 'Evento Editado', 'edição gravada')
    igual(sql('SELECT local FROM eventos')[0].local, 'Outro local', 'local editado')
  })
  await etapa('excluir evento pede confirmação e remove do banco e do cosplay', async () => {
    await botao('Evento Editado', "document.getElementById('tela')")
    await excluirNaFolha()
    await aguardarBanco(() => contar('eventos') === 0, 'evento excluído')
    igual(sql("SELECT evento_id FROM cosplays WHERE nome = 'Gambit'")[0].evento_id, '', 'vínculo removido')
  })

  await etapa('criar um molde, editar e abrir o envelope', async () => {
    await tela('Cosplays')
    await botao('Novo molde')
    await pagina.preencher(app, { Personagem: 'Teste Cosplay', 'Obra ou versão': 'Obra Teste', Situação: 'Em produção', 'Orçamento em reais': '300.5' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => contar('cosplays') === 2, 'molde gravado')
    igual(sql("SELECT obra, status, orcamento FROM cosplays WHERE nome = 'Teste Cosplay'"), [{ obra: 'Obra Teste', status: 'Em produção', orcamento: 300.5 }], 'molde no banco')
    confirmar((await texto()).includes('Molde Nº 2') && (await texto()).includes('Teste Cosplay'), 'envelope do molde ausente')
    await botao('Editar molde')
    await pagina.preencher(app, { 'Obra ou versão': 'Obra Editada' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => sql("SELECT obra FROM cosplays WHERE nome = 'Teste Cosplay'")[0].obra === 'Obra Editada', 'edição do molde')
  })
  await etapa('criar peça, marcar etapas e acompanhar o progresso', async () => {
    await botao('Adicionar peça')
    await pagina.preencher(app, { 'Nome da peça': 'Capa de teste', Tipo: 'Tecido', Anotações: 'Usar forro' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => contar('pecas') === 13, 'peça gravada')
    await botao('Capa de teste', "document.getElementById('tela')")
    await pagina.clicar(app, 'input[data-mudar="etapa"][data-i="1"]') // marca "Corte": conclui Molde e Corte
    await aguardarBanco(() => sql("SELECT feitas FROM pecas WHERE nome = 'Capa de teste'")[0].feitas === 2, 'etapas gravadas')
    confirmar((await texto()).includes('50 de 100'), 'progresso 50 de 100 esperado: ' + (await texto()).slice(0, 200))
    await pagina.clicar(app, 'input[data-mudar="etapa"][data-i="0"]') // desmarcar a primeira reabre tudo
    await aguardarBanco(() => sql("SELECT feitas FROM pecas WHERE nome = 'Capa de teste'")[0].feitas === 0, 'reabrir etapas')
    await botao('Editar peça', folha)
    await pagina.preencher(app, { 'Nome da peça': 'Capa editada' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => sql("SELECT nome FROM pecas WHERE nome = 'Capa editada'").length === 1, 'peça editada')
  })
  await etapa('criar tarefa atrasada, ver aviso em Hoje, concluir e excluir', async () => {
    await botao('Tarefas', "document.querySelector('.abas')")
    await botao('Adicionar tarefa')
    await pagina.preencher(app, { 'O que fazer': 'Cortar o tecido', Prazo: iso(-2), 'Tempo estimado em minutos': '90' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => contar('tarefas') === 1, 'tarefa gravada')
    igual(sql('SELECT nome, prazo, minutos, feita FROM tarefas'), [{ nome: 'Cortar o tecido', prazo: iso(-2), minutos: 90, feita: 0 }], 'tarefa no banco')
    await tela('Hoje')
    const t = await texto()
    confirmar(t.includes('Tarefa atrasada') && t.includes('Cortar o tecido, Teste Cosplay'), 'aviso de tarefa atrasada ausente')
    await pagina.clicar(app, 'input[data-mudar="tarefa"]')
    await aguardarBanco(() => sql('SELECT feita FROM tarefas')[0].feita === 1, 'tarefa concluída')
    await esperar(400)
    confirmar(!(await texto()).includes('Tarefa atrasada'), 'aviso deveria sumir após concluir')
    await botao('Teste Cosplay', "document.getElementById('tela')")
    await botao('Tarefas', "document.querySelector('.abas')")
    await botao('Cortar o tecido', "document.getElementById('tela')")
    await excluirNaFolha()
    await aguardarBanco(() => contar('tarefas') === 0, 'tarefa excluída')
  })
  await etapa('criar compra, ver nas abas e nos custos, abrir link da loja no navegador padrão', async () => {
    await tela('Compras')
    await botao('Adicionar item')
    await pagina.preencher(app, { Item: 'Tecido azul', Molde: 'Teste Cosplay', Situação: 'A comprar', 'Preço em reais': '59.9', Loja: 'Armarinho Central', 'Comprar até ou previsão de chegada': iso(1), Link: 'https://exemplo.com/tecido' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => contar('compras') === 1, 'compra gravada')
    igual(sql('SELECT nome, status, preco, loja, prazo, link FROM compras'), [{ nome: 'Tecido azul', status: 'A comprar', preco: 59.9, loja: 'Armarinho Central', prazo: iso(1), link: 'https://exemplo.com/tecido' }], 'compra no banco')
    const t = await texto()
    confirmar(t.includes('Tecido azul') && t.includes('R$ 59,90') && t.includes('Armarinho Central'), 'etiqueta da compra ausente')
    await botao('Tecido azul', "document.getElementById('tela')")
    await botao('Abrir link da loja', folha)
    await esperar(400)
    igual(await linksAbertos(), ['https://exemplo.com/tecido'], 'links abertos no navegador padrão')
    await botao('Cancelar', folha)
    await tela('Hoje')
    confirmar((await texto()).includes('Comprar até amanhã'), 'aviso de compra ausente em Hoje')
    await botao('Teste Cosplay', "document.getElementById('tela')")
    await botao('Custos', "document.querySelector('.abas')")
    const c = await texto()
    confirmar(c.includes('R$ 300,50') && c.includes('R$ 59,90') && c.includes('R$ 240,60'), 'números dos custos incorretos: ' + c.slice(0, 200))
  })
  await etapa('editar compra (muda para "A caminho") e excluir', async () => {
    await tela('Compras')
    await botao('Tecido azul', "document.getElementById('tela')")
    await pagina.preencher(app, { Situação: 'A caminho' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => sql('SELECT status FROM compras')[0].status === 'A caminho', 'status editado')
    confirmar((await texto()).includes('chega'), 'aba "A caminho" deveria mostrar a previsão')
    await botao('Tecido azul', "document.getElementById('tela')")
    await excluirNaFolha()
    await aguardarBanco(() => contar('compras') === 0, 'compra excluída')
  })
  await etapa('escrever, editar e excluir nota do diário', async () => {
    await tela('Cosplays')
    await botao('Teste Cosplay', "document.getElementById('tela')")
    await botao('Diário', "document.querySelector('.abas')")
    await botao('Escrever nota')
    await pagina.preencher(app, { Data: iso(0), Nota: 'Costurei a barra hoje' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => contar('diario') === 1, 'nota gravada')
    await botao('Costurei a barra hoje', "document.getElementById('tela')")
    await pagina.preencher(app, { Nota: 'Costurei a barra e a gola' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => sql('SELECT texto FROM diario')[0].texto === 'Costurei a barra e a gola', 'nota editada')
  })
  await etapa('medidas: preencher, adicionar e remover', async () => {
    await tela('Oficina')
    await app.pagina.avaliar(`(() => { const i = document.querySelector('input[aria-label^="Altura"]'); i.value = '172,5'; i.dispatchEvent(new Event('change', { bubbles: true })) })()`)
    await aguardarBanco(() => sql("SELECT valor FROM medidas WHERE nome = 'Altura'")[0].valor === '172,5', 'medida gravada')
    await botao('Adicionar medida')
    await pagina.preencher(app, { Nome: 'Pulso', Grupo: 'Corpo', 'Valor em centímetros': '15' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => contar('medidas') === 10, 'nova medida')
    await app.pagina.avaliar(`document.querySelector('button[aria-label="Remover Pulso"]').click()`)
    await aguardarBanco(() => contar('medidas') === 9, 'medida removida')
  })
  await etapa('etapas por tipo e avisos: editar', async () => {
    await app.pagina.avaliar(`document.querySelector('button[data-a="editarEtapas"][data-tipo="arma"]').click()`)
    await pagina.preencher(app, { Etapas: 'Núcleo\nForma\nPintura' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => sql("SELECT COUNT(*) AS n FROM etapas WHERE tipo = 'arma'")[0].n === 3, 'etapas gravadas')
    await botao('Resumo às', "document.getElementById('tela')")
    await pagina.preencher(app, { 'Horário do resumo diário': '07:45', 'Avisar compras quantos dias antes': '5' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => sql("SELECT valor FROM meta WHERE chave = 'avisos.hora'")[0].valor === '07:45', 'hora gravada')
    confirmar((await texto()).includes('Resumo às 07:45') && (await texto()).includes('Compras avisam 5 dias antes'), 'texto de avisos não atualizou')
  })
  await etapa('excluir o molde de teste leva junto peças, tarefas e diário (cascata)', async () => {
    await tela('Cosplays')
    await botao('Teste Cosplay', "document.getElementById('tela')")
    await botao('Editar molde')
    await excluirNaFolha()
    await aguardarBanco(() => contar('cosplays') === 1, 'molde excluído')
    igual([contar('pecas'), contar('diario'), contar('tarefas')], [12, 0, 0], 'filhos removidos em cascata')
    igual(errosDaInterface(), [], 'erros na interface')
  })
  await etapa('formulário: "Cancelar", Esc e clique fora fecham sem salvar', async () => {
    await tela('Agenda')
    await botao('Adicionar evento')
    await pagina.preencher(app, { 'Nome do evento': 'Não deve salvar' })
    await botao('Cancelar', folha)
    igual(await pagina.folhaAberta(app), false, 'folha após Cancelar')
    await botao('Adicionar evento')
    await app.pagina.avaliar(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
    igual(await pagina.folhaAberta(app), false, 'folha após Esc')
    await botao('Adicionar evento')
    await app.pagina.avaliar(`document.querySelector('.veu').click()`)
    igual(await pagina.folhaAberta(app), false, 'folha após clique fora')
    igual(contar('eventos'), 0, 'nada deveria ter sido gravado')
  })
  await etapa('o "novo molde" sem nome obrigatório não salva (validação do formulário)', async () => {
    await tela('Cosplays')
    await botao('Novo molde')
    const valido = await app.pagina.avaliar(`document.getElementById('form-folha').checkValidity()`)
    igual(valido, false, 'formulário vazio deveria ser inválido')
    await botao('Cancelar', folha)
  })
}

// =====================================================================
async function secaoPersistencia() {
  if (!app) await abrir()
  const marca = `Persistência ${Date.now()}`
  await etapa('cria dados, fecha o app por completo e reabre: tudo continua lá', async () => {
    await tela('Agenda')
    await botao('Adicionar evento')
    await pagina.preencher(app, { 'Nome do evento': marca, Data: iso(20), Local: 'Lugar X' })
    await pagina.salvarFolha(app)
    await tela('Compras')
    await botao('Adicionar item')
    await pagina.preencher(app, { Item: 'Item persistente', Molde: 'Gambit', 'Preço em reais': '12.34' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => contar('eventos') >= 1 && contar('compras') >= 1, 'gravação')
    const antes = { eventos: sql('SELECT nome FROM eventos'), compras: sql('SELECT nome, preco FROM compras') }
    await reabrir()
    igual(sql('SELECT nome FROM eventos'), antes.eventos, 'eventos após reabrir')
    igual(sql('SELECT nome, preco FROM compras'), antes.compras, 'compras após reabrir')
    await tela('Agenda')
    confirmar((await texto()).includes(marca), 'evento não aparece na interface após reabrir')
    await tela('Compras')
    confirmar((await texto()).includes('Item persistente') && (await texto()).includes('R$ 12,34'), 'compra não aparece após reabrir')
  })
  await etapa('o arquivo do banco está na pasta de dados do usuário, não na pasta do app', async () => {
    confirmar(existsSync(caminhoBanco()), 'banco ausente')
    igual(await app.principalAvaliar('return electron.app.getPath("userData")'), pastaDados, 'pasta de dados')
  })
  await etapa('limpa os dados criados nesta seção', async () => {
    await tela('Agenda')
    await botao(marca, "document.getElementById('tela')")
    await excluirNaFolha()
    await tela('Compras')
    await botao('Item persistente', "document.getElementById('tela')")
    await excluirNaFolha()
    await aguardarBanco(() => contar('eventos') === 0 && contar('compras') === 0, 'limpeza')
  })
}

// =====================================================================
async function secaoImagens() {
  if (!app) await abrir()
  const imagem = resolve(import.meta.dirname, '../../resources/icone.png')
  await etapa('adicionar imagem de referência: vira arquivo na pasta de fotos e só o nome fica no banco', async () => {
    await tela('Cosplays')
    await botao('Gambit', "document.getElementById('tela')")
    await botao('Referências', "document.querySelector('.abas')")
    app.proximoArquivo = imagem
    await botao('Adicionar imagem')
    await aguardarBanco(() => contar('referencias') === 1, 'referência gravada')
    const [ref] = sql('SELECT arquivo FROM referencias')
    confirmar(/^[0-9a-f-]{36}\.jpg$/.test(ref.arquivo), 'nome de arquivo inesperado: ' + ref.arquivo)
    const arquivos = readdirSync(join(pastaDados, 'fotos'))
    confirmar(arquivos.includes(ref.arquivo), 'arquivo da foto não está na pasta: ' + arquivos)
    const bytes = readFileSync(join(pastaDados, 'fotos', ref.arquivo))
    confirmar(bytes[0] === 0xff && bytes[1] === 0xd8, 'o arquivo deveria ser um JPEG')
    igual(sql("SELECT COUNT(*) AS n FROM referencias WHERE arquivo LIKE 'data:%' OR arquivo LIKE '%base64%'")[0].n, 0, 'o banco não deve guardar a imagem em si')
  })
  await etapa('a foto aparece na interface (carregada pelo protocolo interno) e ocupa a galeria', async () => {
    const r = await esperarAte(() => app.pagina.avaliar(`(() => { const i = document.querySelector('.galeria img'); return i && i.complete ? { w: i.naturalWidth, h: i.naturalHeight, src: i.src } : null })()`), 'a imagem carregar')
    confirmar(r.w > 0 && r.h > 0, 'imagem não carregou')
    confirmar(r.src.startsWith('alinhavo-foto://foto/'), 'a imagem deveria vir do protocolo interno: ' + r.src)
    confirmar(r.w <= 1400 && r.h <= 1400, 'a imagem deveria ter sido reduzida a no máximo 1400 px')
  })
  await etapa('editar a legenda da referência', async () => {
    await pagina.clicar(app, '.galeria .foto')
    await pagina.preencher(app, { Legenda: 'Frente do traje' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => sql('SELECT nota FROM referencias')[0].nota === 'Frente do traje', 'legenda gravada')
    confirmar((await texto()).includes('Frente do traje'), 'legenda não aparece')
  })
  await etapa('nota do diário com foto', async () => {
    await botao('Diário', "document.querySelector('.abas')")
    app.proximoArquivo = imagem
    await botao('Nota com foto')
    await esperarAte(() => pagina.folhaAberta(app), 'o formulário da nota abrir')
    await esperarAte(() => app.pagina.avaliar(`(() => { const i = document.querySelector('.folha img'); return !!i && i.complete && i.naturalWidth > 0 })()`), 'a foto aparecer no formulário')
    await pagina.preencher(app, { Data: iso(0), Nota: 'Nota com foto de teste' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => contar('diario') === 1, 'nota com foto gravada')
    confirmar(sql('SELECT arquivo FROM diario')[0].arquivo.endsWith('.jpg'), 'nota deveria referenciar um arquivo .jpg')
    await esperarAte(() => app.pagina.avaliar(`(() => { const i = document.querySelector('.diario-foto'); return !!i && i.complete && i.naturalWidth > 0 })()`), 'foto da nota aparecer no diário')
  })
  await etapa('arquivo que não é imagem é recusado com mensagem clara e nada é gravado', async () => {
    const falso = join(pastaTemp, 'falso.png')
    writeFileSync(falso, 'isto é só texto')
    app.proximoArquivo = falso
    await botao('Referências', "document.querySelector('.abas')")
    const antes = readdirSync(join(pastaDados, 'fotos')).length
    await botao('Adicionar imagem')
    await esperarAte(async () => (await pagina.avisoVisivel(app)).includes('Não foi possível abrir essa imagem'), 'mensagem de erro de imagem')
    igual(readdirSync(join(pastaDados, 'fotos')).length, antes, 'nenhuma foto nova deveria existir')
    igual(contar('referencias'), 1, 'referências')
  })
  await etapa('as fotos continuam depois de fechar e reabrir o app', async () => {
    await reabrir()
    await tela('Cosplays')
    await botao('Gambit', "document.getElementById('tela')")
    await botao('Referências', "document.querySelector('.abas')")
    await esperarAte(() => app.pagina.avaliar(`(() => { const i = document.querySelector('.galeria img'); return !!i && i.complete && i.naturalWidth > 0 })()`), 'imagem após reabrir')
  })
  await etapa('limpa as fotos de teste: excluir referência e nota remove do banco', async () => {
    await pagina.clicar(app, '.galeria .foto')
    await excluirNaFolha()
    await aguardarBanco(() => contar('referencias') === 0, 'referência excluída')
    await botao('Diário', "document.querySelector('.abas')")
    await botao('Nota com foto de teste', "document.getElementById('tela')")
    await excluirNaFolha()
    await aguardarBanco(() => contar('diario') === 0, 'nota excluída')
  })
}

// =====================================================================
async function secaoSeguranca() {
  if (!app) await abrir()
  await combinarLinksExternos()
  await etapa('janela com contextIsolation e sandbox ligados e nodeIntegration desligado', async () => {
    const p = JSON.parse(await app.principalAvaliar('const w = electron.BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(); return JSON.stringify({ ci: w.contextIsolation, sb: w.sandbox, ni: w.nodeIntegration, ws: w.webSecurity })'))
    igual(p, { ci: true, sb: true, ni: false, ws: true }, 'preferências da janela')
  })
  await etapa('a interface não enxerga Node, require nem process', async () => {
    const r = await app.pagina.avaliar('JSON.stringify({ req: typeof require, proc: typeof process, mod: typeof module, buf: typeof Buffer })')
    igual(JSON.parse(r), { req: 'undefined', proc: 'undefined', mod: 'undefined', buf: 'undefined' }, 'globais de Node na interface')
  })
  await etapa('a ponte expõe só as 5 funções combinadas', async () => {
    const chaves = await app.pagina.avaliar('Object.keys(window.alinhavo).sort()')
    igual(chaves, ['carregarEstado', 'exportarBackup', 'importarBackup', 'salvarEstado', 'salvarFoto'], 'funções da ponte')
  })
  await etapa('dados inválidos enviados pela ponte são recusados e nada é alterado', async () => {
    const antes = sql('SELECT COUNT(*) AS n FROM cosplays')[0].n
    const r = await app.pagina.avaliar(`window.alinhavo.salvarEstado({ cosplays: 'lixo', etapas: {} })`)
    igual(r.ok, false, 'resposta')
    confirmar(typeof r.erro === 'string' && r.erro.length > 5, 'mensagem de erro em português esperada')
    const r2 = await app.pagina.avaliar(`window.alinhavo.salvarFoto(new Uint8Array([1,2,3,4,5]))`)
    igual(r2.ok, false, 'foto inválida')
    const r3 = await app.pagina.avaliar(`window.alinhavo.salvarEstado('texto')`)
    igual(r3.ok, false, 'estado que não é objeto')
    igual(sql('SELECT COUNT(*) AS n FROM cosplays')[0].n, antes, 'cosplays no banco')
  })
  await etapa('navegar a janela para fora do app é bloqueado e abre o navegador padrão', async () => {
    const urlAntes = await app.pagina.avaliar('location.href')
    await app.pagina.avaliar(`setTimeout(() => { location.href = 'https://exemplo.com/fora' }, 0); 1`)
    await esperar(800)
    igual(await app.pagina.avaliar('location.href'), urlAntes, 'endereço da janela')
    igual(await linksAbertos(), ['https://exemplo.com/fora'], 'links abertos')
  })
  await etapa('window.open vai para o navegador padrão e não cria janela nova; só http/https são aceitos', async () => {
    await app.pagina.avaliar(`window.open('https://exemplo.com/novo', '_blank'); window.open('file:///C:/Windows/System32/calc.exe', '_blank'); window.open('javascript:alert(1)'); 1`)
    await esperar(800)
    const abertos = await linksAbertos()
    confirmar(abertos.includes('https://exemplo.com/novo'), 'link https deveria abrir no navegador: ' + abertos)
    confirmar(!abertos.some((u) => u.startsWith('file:') || u.startsWith('javascript:')), 'file: e javascript: não podem ser abertos: ' + abertos)
    igual(await app.principalAvaliar('return electron.BrowserWindow.getAllWindows().length'), 1, 'número de janelas')
  })
  await etapa('o protocolo de fotos entrega fotos válidas e bloqueia "..", barras e caminhos fora da pasta', async () => {
    writeFileSync(join(pastaDados, 'fotos', 'teste-protocolo.png'), readFileSync(resolve(import.meta.dirname, '../../resources/bandeja.png')))
    const carrega = (url) => app.pagina.avaliar(`new Promise((ok) => { const i = new Image(); i.onload = () => ok(true); i.onerror = () => ok(false); i.src = ${JSON.stringify(url)} })`)
    igual(await carrega('alinhavo-foto://foto/teste-protocolo.png'), true, 'foto válida')
    const ataques = ['alinhavo-foto://foto/..%2Falinhavo.db', 'alinhavo-foto://foto/%2e%2e%2falinhavo.db', 'alinhavo-foto://foto/..%5Calinhavo.db', 'alinhavo-foto://foto/../alinhavo.db', 'alinhavo-foto://foto/%2e%2e/%2e%2e/Windows/win.ini', 'alinhavo-foto://foto/C:%5CWindows%5Cweb%5Cwallpaper.jpg', 'alinhavo-foto://outro/teste-protocolo.png', 'alinhavo-foto://foto/inexistente.png', 'alinhavo-foto://foto/teste-protocolo.png%00.txt']
    for (const a of ataques) igual(await carrega(a), false, `bloqueio de ${a}`)
  })
  await etapa('páginas externas (http/https) não carregam na interface (sem rede para a interface)', async () => {
    const carrega = await app.pagina.avaliar(`new Promise((ok) => { const i = new Image(); i.onload = () => ok(true); i.onerror = () => ok(false); i.src = 'https://www.google.com/favicon.ico' })`)
    igual(carrega, false, 'imagem externa deveria ser bloqueada pela política de segurança (CSP)')
  })
  await etapa('o menu do app está desativado e as ferramentas de desenvolvedor só existem fora do instalado', async () => {
    igual(await app.principalAvaliar('return electron.Menu.getApplicationMenu() === null'), true, 'menu removido')
  })
}

// =====================================================================
async function secaoNotificacoes() {
  if (!app) await abrir()
  await etapa('notificações do Windows são suportadas e o resumo do dia é entregue (horário do resumo ajustado para 00:00)', async () => {
    igual(await app.principalAvaliar('return electron.Notification.isSupported()'), true, 'suporte a notificações')
    // Para o teste não depender da hora em que roda, o resumo é configurado para a meia-noite (já passou).
    await tela('Oficina')
    await botao('Resumo às', "document.getElementById('tela')")
    await pagina.preencher(app, { 'Horário do resumo diário': '00:00' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => sql("SELECT valor FROM meta WHERE chave = 'avisos.hora'")[0].valor === '00:00', 'hora gravada')
    await esperarAte(() => lerLog().includes('Notificação exibida: resumo:'), 'o resumo diário ser exibido (log do app)', 10000)
    igual(sql("SELECT COUNT(*) AS n FROM avisos_enviados WHERE chave LIKE 'resumo:%'")[0].n >= 1, true, 'resumo registrado no banco')
  })
  let antesCompra
  await etapa('compra com prazo próximo e tarefa atrasada geram notificações (uma vez cada)', async () => {
    await tela('Compras')
    await botao('Adicionar item')
    await pagina.preencher(app, { Item: 'Fivela de teste', Molde: 'Gambit', 'Comprar até ou previsão de chegada': iso(1), 'Preço em reais': '20' })
    await pagina.salvarFolha(app)
    await tela('Cosplays')
    await botao('Gambit', "document.getElementById('tela')")
    await botao('Tarefas', "document.querySelector('.abas')")
    await botao('Adicionar tarefa')
    await pagina.preencher(app, { 'O que fazer': 'Tarefa de teste atrasada', Prazo: iso(-3) })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => contar('compras') === 1 && contar('tarefas') === 1, 'dados gravados')
    antesCompra = notificacoesNoLog()
    // O agendador verifica a cada 30 s e o horário do resumo (19:00) já passou.
    await esperarAte(() => lerLog().includes('Notificação exibida: compra:') && lerLog().includes('Notificação exibida: tarefa:'), 'notificações de compra e tarefa (até 40 s)', 45000)
    const chaves = sql('SELECT chave FROM avisos_enviados').map((r) => r.chave)
    confirmar(chaves.some((c) => c.startsWith('compra:')) && chaves.some((c) => c.startsWith('tarefa:')), 'chaves não registradas: ' + chaves)
  })
  await etapa('esperar mais um ciclo não repete as notificações', async () => {
    const n = notificacoesNoLog()
    await esperar(35000)
    igual(notificacoesNoLog(), n, 'notificações no log após novo ciclo')
    confirmar(n > antesCompra, 'deveriam ter saído notificações novas')
  })
  await etapa('fechar e reabrir o app NÃO repete as notificações do dia', async () => {
    const n = notificacoesNoLog()
    const chavesAntes = sql('SELECT chave FROM avisos_enviados ORDER BY chave').map((r) => r.chave)
    await reabrir()
    await esperar(4000) // a verificação roda assim que o app abre
    igual(notificacoesNoLog(), n, 'notificações no log após reabrir')
    igual(sql('SELECT chave FROM avisos_enviados ORDER BY chave').map((r) => r.chave), chavesAntes, 'chaves registradas')
  })
  await etapa('mudar o horário do resumo para depois de agora segura as notificações de um dia novo (regra do horário)', async () => {
    // O horário configurado vale para o dia seguinte; aqui só confirmamos que a configuração é gravada e respeitada pelo cálculo.
    await tela('Oficina')
    await botao('Resumo às', "document.getElementById('tela')")
    await pagina.preencher(app, { 'Horário do resumo diário': '23:59' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => sql("SELECT valor FROM meta WHERE chave = 'avisos.hora'")[0].valor === '23:59', 'hora gravada')
  })
  await etapa('limpa os dados criados nesta seção', async () => {
    await tela('Compras')
    await botao('Fivela de teste', "document.getElementById('tela')")
    await excluirNaFolha()
    await tela('Cosplays')
    await botao('Gambit', "document.getElementById('tela')")
    await botao('Tarefas', "document.querySelector('.abas')")
    await botao('Tarefa de teste atrasada', "document.getElementById('tela')")
    await excluirNaFolha()
    await tela('Oficina')
    await botao('Resumo às', "document.getElementById('tela')")
    await pagina.preencher(app, { 'Horário do resumo diário': '19:00' })
    await pagina.salvarFolha(app)
    await aguardarBanco(() => contar('compras') === 0 && contar('tarefas') === 0, 'limpeza')
  })
}

// =====================================================================
async function secaoBandeja() {
  if (!app) await abrir()
  const janelaVisivel = () => app.principalAvaliar('return electron.BrowserWindow.getAllWindows()[0].isVisible()')
  await etapa('lembra o tamanho e a posição da janela entre aberturas', async () => {
    await app.principalAvaliar('const w = electron.BrowserWindow.getAllWindows()[0]; if (w.isMaximized()) w.unmaximize(); w.setBounds({ x: 120, y: 90, width: 1111, height: 777 }); return 1')
    await esperar(900) // o app guarda 400 ms depois de mexer
    await reabrir()
    const b = JSON.parse(await app.principalAvaliar('return JSON.stringify(electron.BrowserWindow.getAllWindows()[0].getBounds())'))
    igual([b.x, b.y, b.width, b.height], [120, 90, 1111, 777], 'posição e tamanho restaurados')
  })
  await etapa('a largura mínima da janela impede encolher abaixo do layout', async () => {
    await app.principalAvaliar('const w = electron.BrowserWindow.getAllWindows()[0]; w.setSize(200, 200); return 1')
    await esperar(300)
    const b = JSON.parse(await app.principalAvaliar('return JSON.stringify(electron.BrowserWindow.getAllWindows()[0].getBounds())'))
    confirmar(b.width >= 420 && b.height >= 600, `a janela encolheu demais: ${b.width}x${b.height}`)
    await app.principalAvaliar('electron.BrowserWindow.getAllWindows()[0].setSize(1000, 800); return 1')
  })
  await etapa('fechar a janela (X) esconde o app na bandeja e ele continua rodando', async () => {
    const pid = app.processo.pid
    // WM_CLOSE: é o que o botão X da janela envia.
    execFileSync('powershell', ['-NoProfile', '-Command', `$p = Get-Process -Id ${pid}; $null = $p.CloseMainWindow()`])
    await esperarAte(async () => !(await janelaVisivel()), 'a janela esconder', 8000)
    confirmar(!app.encerrou, 'o app não pode encerrar ao fechar a janela')
    igual(await app.principalAvaliar('return electron.BrowserWindow.getAllWindows().length'), 1, 'a janela continua existindo, só escondida')
  })
  await etapa('abrir o app de novo (ou "Abrir" na bandeja) traz a janela de volta, sem duplicar o app', async () => {
    const segundo = await abrirApp({ exe, argumentos: appPasta ? [appPasta] : [], dados: dadosArg ?? undefined, conectar: false })
    await segundo.esperarEncerrar(15000)
    confirmar(segundo.encerrou, 'a segunda instância deveria encerrar logo')
    await esperarAte(() => janelaVisivel(), 'a janela reaparecer', 8000)
  })
  await etapa('"Abrir" da bandeja: a função usada pelo menu mostra a janela escondida', async () => {
    await app.principalAvaliar('electron.BrowserWindow.getAllWindows()[0].hide(); return 1')
    igual(await janelaVisivel(), false, 'janela escondida')
    // O clique no ícone/menu chama exatamente mostrarJanela(); pela segunda instância já provamos o mesmo caminho.
    const segundo = await abrirApp({ exe, argumentos: appPasta ? [appPasta] : [], dados: dadosArg ?? undefined, conectar: false })
    await segundo.esperarEncerrar(15000)
    await esperarAte(() => janelaVisivel(), 'a janela reaparecer', 8000)
  })
  await etapa('"Sair" encerra o processo por completo e fecha o banco (sem arquivos temporários)', async () => {
    const pid = app.processo.pid
    await app.sair()
    app = null
    await esperar(800)
    const vivos = execFileSync('powershell', ['-NoProfile', '-Command', `@(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).Count`]).toString().trim()
    igual(vivos, '0', 'processos vivos com o PID do app')
    const wal = join(pastaDados, 'alinhavo.db-wal')
    confirmar(!existsSync(wal) || readFileSync(wal).length === 0, 'o arquivo -wal deveria estar vazio ou ausente após fechar o banco')
    await abrir()
    confirmar((await texto()).includes('Gambit'), 'dados presentes após reabrir')
  })
}

// =====================================================================
async function secaoBackup() {
  if (!app) await abrir()
  const zipPath = join(pastaTemp, 'backup-teste.zip')
  const imagem = resolve(import.meta.dirname, '../../resources/icone.png')
  const marca = `Cosplay do backup ${Date.now()}`
  let copiasAntes = 0
  const pastaCopias = join(pastaDados, 'copias-automaticas')
  const copias = () => (existsSync(pastaCopias) ? readdirSync(pastaCopias).filter((n) => n.endsWith('.zip')) : [])

  await etapa('prepara dados com foto para o backup', async () => {
    await tela('Cosplays')
    await botao('Novo molde')
    await pagina.preencher(app, { Personagem: marca, 'Obra ou versão': 'Backup' })
    await pagina.salvarFolha(app)
    await botao('Referências', "document.querySelector('.abas')")
    app.proximoArquivo = imagem
    await botao('Adicionar imagem')
    await aguardarBanco(() => contar('referencias') === 1, 'referência com foto')
  })
  await etapa('exporta um .zip com dados.json e todas as fotos', async () => {
    await combinarDialogos({ salvarEm: zipPath })
    await tela('Oficina')
    await botao('Exportar')
    await esperarAte(async () => (await pagina.avisoVisivel(app)) === 'Backup concluído', 'aviso "Backup concluído"')
    confirmar(existsSync(zipPath), 'o .zip não foi criado')
    const conteudo = unzipSync(new Uint8Array(readFileSync(zipPath)))
    const nomes = Object.keys(conteudo).sort()
    confirmar(nomes.includes('dados.json'), 'falta dados.json: ' + nomes)
    const fotos = nomes.filter((n) => n.startsWith('fotos/'))
    igual(fotos.length, 1, 'fotos no zip')
    const dados = JSON.parse(new TextDecoder().decode(conteudo['dados.json']))
    igual(dados.formato, 'alinhavo-backup', 'formato')
    igual(dados.estado.cosplays.some((c) => c.nome === marca), true, 'cosplay no JSON')
    igual(dados.estado.cosplays.find((c) => c.nome === marca).referencias[0].arquivo, fotos[0].replace('fotos/', ''), 'a referência aponta para a foto do zip')
    confirmar(!JSON.stringify(dados).includes('base64'), 'o JSON não deve embutir imagens')
    igual(copias().length, copiasAntes, 'exportar não deve criar cópia automática')
  })
  await etapa('cancelar a importação (no seletor ou na confirmação) não altera nada', async () => {
    await combinarDialogos({ abrir: undefined })
    await botao('Importar')
    await esperar(600)
    await combinarDialogos({ abrir: zipPath, confirmacao: 1 })
    await botao('Importar')
    await esperar(800)
    igual(contar('cosplays'), 2, 'cosplays')
    igual(copias().length, copiasAntes, 'nenhuma cópia automática deveria ter sido criada')
  })
  await etapa('apaga dados e fotos e importa o backup: tudo volta, com cópia automática antes', async () => {
    await tela('Cosplays')
    await botao(marca, "document.getElementById('tela')")
    await botao('Editar molde')
    await excluirNaFolha()
    await aguardarBanco(() => contar('cosplays') === 1, 'cosplay apagado')
    await combinarDialogos({ abrir: zipPath, confirmacao: 0 })
    await tela('Oficina')
    await botao('Importar')
    await esperarAte(async () => (await pagina.avisoVisivel(app)).startsWith('Backup importado'), 'aviso "Backup importado"')
    igual(contar('cosplays'), 2, 'cosplays após importar')
    igual(contar('referencias'), 1, 'referências após importar')
    const copiasDepois = copias()
    igual(copiasDepois.length, copiasAntes + 1, 'cópia automática criada')
    copiasAntes = copiasDepois.length
    const copia = unzipSync(new Uint8Array(readFileSync(join(pastaCopias, copiasDepois[0]))))
    confirmar(Object.keys(copia).includes('dados.json'), 'a cópia automática deveria ser um backup completo')
    await tela('Cosplays')
    confirmar((await texto()).includes(marca), 'cosplay restaurado não aparece')
    await botao(marca, "document.getElementById('tela')")
    await botao('Referências', "document.querySelector('.abas')")
    await esperarAte(() => app.pagina.avaliar(`(() => { const i = document.querySelector('.galeria img'); return !!i && i.complete && i.naturalWidth > 0 })()`), 'a foto restaurada carregar')
    const fotosNaPasta = readdirSync(join(pastaDados, 'fotos'))
    igual(fotosNaPasta.length, 1, 'fotos na pasta após restaurar')
    igual(readdirSync(pastaDados).filter((n) => n.startsWith('fotos.')), [], 'sem pastas temporárias de restauração')
  })
  await etapa('arquivo .zip com caminho inseguro é recusado ANTES de alterar qualquer coisa', async () => {
    const mau = join(pastaTemp, 'mau.zip')
    const base = unzipSync(new Uint8Array(readFileSync(zipPath)))
    writeFileSync(mau, zipSync({ ...base, '../fora.txt': strToU8('malicioso'), 'fotos/../../fora2.jpg': base[Object.keys(base).find((n) => n.startsWith('fotos/'))] }))
    const estadoAntes = JSON.stringify(sql('SELECT id, nome FROM cosplays ORDER BY id'))
    await combinarDialogos({ abrir: mau, confirmacao: 0 })
    await tela('Oficina')
    await botao('Importar')
    await esperarAte(async () => (await pagina.avisoVisivel(app)).includes('inseguro'), 'mensagem de caminho inseguro')
    igual(JSON.stringify(sql('SELECT id, nome FROM cosplays ORDER BY id')), estadoAntes, 'cosplays inalterados')
    igual(copias().length, copiasAntes, 'nenhuma cópia automática deveria ser criada (nada mudou)')
    confirmar(!existsSync(join(pastaTemp, 'fora.txt')) && !existsSync(join(pastaDados, 'fora.txt')) && !existsSync(join(pastaDados, '..', 'fora.txt')), 'nada pode ter sido extraído para fora')
  })
  await etapa('arquivo que não é backup (zip corrompido, JSON qualquer, texto) é recusado com mensagem clara', async () => {
    for (const [nome, conteudo, esperado] of [
      ['corrompido.zip', Buffer.from('PK\x03\x04isto-nao-e-um-zip-de-verdade'), 'zip'],
      ['qualquer.json', JSON.stringify({ ola: 'mundo' }), 'não é um backup do Alinhavo'],
      ['texto.txt', 'só texto', 'não é um backup do Alinhavo']
    ]) {
      const caminho = join(pastaTemp, nome)
      writeFileSync(caminho, conteudo)
      await combinarDialogos({ abrir: caminho, confirmacao: 0 })
      await botao('Importar')
      await esperarAte(async () => (await pagina.avisoVisivel(app)).includes(esperado), `mensagem para ${nome}`)
      await esperar(2800)
    }
    igual(contar('cosplays'), 2, 'cosplays inalterados')
    igual(copias().length, copiasAntes, 'sem cópias automáticas')
  })
  await etapa('importa o JSON do protótipo (com foto embutida e foto on-line)', async () => {
    const png = readFileSync(imagem).toString('base64')
    const proto = {
      versao: 1, atualizadoEm: 1,
      etapas: { tecido: ['Molde', 'Corte'], armadura: ['Molde'], arma: ['Núcleo'], comprar: ['Escolher'] },
      cosplays: [{
        id: 'p1', nome: 'Do protótipo', obra: 'Obra', status: 'Planejando', orcamento: 100, eventoId: 'ev1',
        pecas: [{ id: 'pc1', nome: 'Peça', tipo: 'tecido', feitas: 1, nota: '' }],
        tarefas: [{ id: 't1', nome: 'Tarefa antiga', feita: false, prazo: '2026-12-01', minutos: 30, pecaId: '' }],
        referencias: [{ id: 'r1', url: `data:image/png;base64,${png}`, nota: 'embutida' }, { id: 'r2', url: 'https://example.com/foto.jpg', nota: 'online' }],
        diario: []
      }],
      eventos: [{ id: 'ev1', nome: 'Evento antigo', data: '2026-12-05', local: 'X' }],
      compras: [{ id: 'cp1', nome: 'Item antigo', cosplayId: 'p1', status: 'A comprar', preco: 10, loja: '', prazo: '', link: '' }],
      medidas: [{ id: 'm1', grupo: 'Corpo', nome: 'Altura', valor: '170' }],
      avisos: { hora: '18:30', diasCompra: 2 }
    }
    const arq = join(pastaTemp, 'alinhavo-backup-2026-01-01.json')
    writeFileSync(arq, JSON.stringify(proto))
    await combinarDialogos({ abrir: arq, confirmacao: 0 })
    await botao('Importar')
    await esperarAte(async () => (await pagina.avisoVisivel(app)).startsWith('Backup importado'), 'aviso de importação do protótipo')
    confirmar((await pagina.avisoVisivel(app)).includes('1 foto do protótipo não pôde ser trazida'), 'deveria avisar da foto on-line: ' + (await pagina.avisoVisivel(app)))
    igual(sql('SELECT nome FROM cosplays'), [{ nome: 'Do protótipo' }], 'cosplays')
    igual(contar('referencias'), 1, 'só a foto embutida vira referência')
    igual(sql('SELECT nome FROM eventos'), [{ nome: 'Evento antigo' }], 'eventos')
    igual(sql("SELECT valor FROM meta WHERE chave = 'avisos.hora'")[0].valor, '18:30', 'horário dos avisos')
    igual(readdirSync(join(pastaDados, 'fotos')).length, 1, 'uma foto na pasta')
    igual(copias().length, copiasAntes + 1, 'cópia automática antes de importar o protótipo')
  })
  await etapa('restaura o backup .zip anterior para voltar ao estado de antes do teste do protótipo', async () => {
    await combinarDialogos({ abrir: zipPath, confirmacao: 0 })
    await tela('Oficina') // depois de importar, o app volta para a tela Hoje
    await botao('Importar')
    await esperarAte(async () => (await pagina.avisoVisivel(app)).startsWith('Backup importado'), 'importação')
    igual(contar('cosplays'), 2, 'cosplays')
    igual(sql('SELECT nome FROM cosplays ORDER BY posicao').map((c) => c.nome).includes(marca), true, 'cosplay do backup de volta')
  })
  await etapa('limpa: remove o cosplay e a foto do teste', async () => {
    await tela('Cosplays')
    await botao(marca, "document.getElementById('tela')")
    await botao('Editar molde')
    await excluirNaFolha()
    await aguardarBanco(() => contar('cosplays') === 1, 'cosplay removido')
    igual(errosDaInterface(), [], 'erros na interface')
  })
}

// =====================================================================
async function secaoLayout() {
  if (!app) await abrir()
  // "disponivel" é a largura útil da área de rolagem (sem a barra de rolagem vertical do Windows).
  const medir = () => app.pagina.avaliar(`JSON.stringify({ largura: innerWidth, disponivel: document.getElementById('tela').clientWidth, coluna: Math.round(document.querySelector('.pagina').getBoundingClientRect().width), rolagemHorizontal: document.documentElement.scrollWidth > innerWidth || document.getElementById('tela').scrollWidth > document.getElementById('tela').clientWidth })`).then(JSON.parse)
  const definirTamanho = async (l, a) => {
    await app.principalAvaliar(`const w = electron.BrowserWindow.getAllWindows()[0]; if (w.isMaximized()) w.unmaximize(); w.setContentSize(${l}, ${a}); return 1`)
    await esperar(500)
  }
  const casos = [[420, 760, 420], [500, 760, 480], [700, 800, 480], [900, 800, 720], [1400, 900, 960]]
  for (const [l, a, colunaEsperada] of casos) {
    await etapa(`janela de ${l} px: coluna de ${colunaEsperada} px, sem rolagem horizontal`, async () => {
      await definirTamanho(l, a)
      for (const nome of ['Hoje', 'Cosplays', 'Agenda', 'Compras', 'Oficina']) {
        await tela(nome)
        const m = await medir()
        igual(m.rolagemHorizontal, false, `rolagem horizontal em ${nome}`)
        confirmar(Math.abs(m.coluna - Math.min(colunaEsperada, m.disponivel)) <= 2, `coluna em ${nome}: ${m.coluna} (esperado ${colunaEsperada} ou o espaço disponível ${m.disponivel}), janela ${m.largura}`)
      }
      await tela('Hoje')
      if (capturas) writeFileSync(join(capturas, `layout-${l}.png`), await pagina.capturar(app))
    })
  }
  await etapa('em janela grande a barra de navegação e o fundo continuam preenchendo a largura inteira', async () => {
    await definirTamanho(1400, 900)
    const r = await app.pagina.avaliar(`(() => { const b = document.getElementById('barra'); const c = getComputedStyle(b); return { fundo: c.backgroundColor, sombra: c.boxShadow !== 'none', recorte: c.clipPath } })()`)
    igual(r.fundo, 'rgb(43, 33, 24)', 'cor da barra')
    confirmar(r.sombra, 'a barra deveria manter a sombra que a faz sangrar até as bordas')
  })
}

// =====================================================================
const funcoes = { inicio: secaoInicio, crud: secaoCrud, persistencia: secaoPersistencia, imagens: secaoImagens, seguranca: secaoSeguranca, notificacoes: secaoNotificacoes, bandeja: secaoBandeja, backup: secaoBackup, layout: secaoLayout }

console.log(`Executável: ${exe}\nDados: ${pastaDados}${dadosArg ? ' (pasta temporária de teste)' : ' (PASTA REAL DO USUÁRIO)'}\nSeções: ${secoes.join(', ')}\n`)
try {
  for (const nome of secoes) {
    secaoAtual = nome
    console.log(`\n== ${nome} ==`)
    try {
      await funcoes[nome]()
    } catch (e) {
      resultados.push({ titulo: `[${nome}] (seção)`, ok: false, erro: e.message })
      console.log(`  FALHA (seção ${nome}) -> ${e.message}`)
    }
  }
} finally {
  if (app) {
    try {
      await app.sair(8000)
    } catch {
      await app.encerrarForcado()
    }
  }
}

const falhas = resultados.filter((r) => !r.ok)
console.log(`\n==== RESUMO: ${resultados.length - falhas.length} OK, ${falhas.length} com falha ====`)
falhas.forEach((f) => console.log(` - ${f.titulo}: ${f.erro}`))
process.exit(falhas.length ? 1 : 0)
