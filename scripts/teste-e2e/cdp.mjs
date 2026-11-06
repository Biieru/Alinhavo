/**
 * Condutor de testes ponta a ponta (E2E) do Alinhavo.
 *
 * Abre o app DE VERDADE (a janela do Electron aparece) e o controla pelo protocolo de depuração:
 * - porta de depuração do Chromium (--remote-debugging-port): controla a interface (cliques, texto, capturas);
 * - inspetor do Node (--inspect): controla o processo principal (para simular as caixas de diálogo
 *   do Windows, que não dá para clicar por aqui, e para consultar a janela).
 * Nada disto está ligado no app normal: só funciona quando o app é aberto com esses dois parâmetros.
 */
import { spawn } from 'node:child_process'
import { setTimeout as esperar } from 'node:timers/promises'

export { esperar }

/** Uma conexão com um alvo do protocolo de depuração (a interface ou o processo principal). */
export class Alvo {
  constructor(ws) {
    this.ws = ws
    this.proximo = 1
    this.pendentes = new Map()
    this.ouvintes = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pendentes.has(msg.id)) {
        const { ok, erro } = this.pendentes.get(msg.id)
        this.pendentes.delete(msg.id)
        msg.error ? erro(new Error(msg.error.message)) : ok(msg.result)
      } else if (msg.method) {
        for (const f of this.ouvintes.get(msg.method) ?? []) f(msg.params)
      }
    })
  }

  static async conectar(url) {
    const ws = new WebSocket(url)
    await new Promise((ok, erro) => {
      ws.addEventListener('open', ok, { once: true })
      ws.addEventListener('error', () => erro(new Error('Falha ao conectar em ' + url)), { once: true })
    })
    return new Alvo(ws)
  }

  enviar(metodo, params = {}) {
    const id = this.proximo++
    this.ws.send(JSON.stringify({ id, method: metodo, params }))
    return new Promise((ok, erro) => this.pendentes.set(id, { ok, erro }))
  }

  quando(evento, funcao) {
    this.ouvintes.set(evento, [...(this.ouvintes.get(evento) ?? []), funcao])
  }

  /** Executa JavaScript no alvo e devolve o resultado (já convertido para valor comum). */
  async avaliar(expressao) {
    // userGesture: o código roda como se uma pessoa tivesse clicado (o Chromium só abre o seletor de arquivos assim).
    const r = await this.enviar('Runtime.evaluate', { expression: expressao, awaitPromise: true, returnByValue: true, userGesture: true })
    if (r.exceptionDetails) throw new Error('Erro no alvo: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text))
    return r.result.value
  }

  fechar() {
    try {
      this.ws.close()
    } catch {
      /* já fechado */
    }
  }
}

async function json(url) {
  const r = await fetch(url)
  return r.json()
}

/** Espera uma condição (função async) ficar verdadeira, ou falha com a descrição dada. */
export async function esperarAte(condicao, descricao, limiteMs = 15000) {
  const inicio = Date.now()
  let ultimoErro
  while (Date.now() - inicio < limiteMs) {
    try {
      const v = await condicao()
      if (v) return v
    } catch (e) {
      ultimoErro = e
    }
    await esperar(150)
  }
  throw new Error(`Tempo esgotado esperando: ${descricao}${ultimoErro ? ' (' + ultimoErro.message + ')' : ''}`)
}

/** Uma execução do app: o processo, a interface (`pagina`) e o processo principal (`principal`). */
export class App {
  constructor(processo, saida, portas) {
    this.processo = processo
    this.saida = saida
    this.portas = portas
    this.pagina = null
    this.principal = null
  }

  get encerrou() {
    return this.processo.exitCode !== null
  }

  async conectar() {
    const { depuracao, inspetor } = this.portas
    const alvoPagina = await esperarAte(async () => {
      const lista = await json(`http://127.0.0.1:${depuracao}/json/list`)
      return lista.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'))
    }, 'a janela do app aparecer no protocolo de depuração', 30000)
    this.pagina = await Alvo.conectar(alvoPagina.webSocketDebuggerUrl)
    // Erros da interface (exceções, console.error e violações de CSP) são guardados para os testes conferirem.
    this.errosPagina = []
    this.proximoArquivo = null
    this.pagina.quando('Runtime.exceptionThrown', (p) => this.errosPagina.push(p.exceptionDetails.exception?.description ?? p.exceptionDetails.text))
    this.pagina.quando('Runtime.consoleAPICalled', (p) => p.type === 'error' && this.errosPagina.push(p.args.map((a) => a.value ?? a.description).join(' ')))
    this.pagina.quando('Log.entryAdded', (p) => p.entry.level === 'error' && this.errosPagina.push(`${p.entry.source}: ${p.entry.text} ${p.entry.url ?? ''}`))
    // O seletor de arquivos do Windows não dá para clicar: quando a interface o abre, entregamos o arquivo combinado.
    this.pagina.quando('Page.fileChooserOpened', async (p) => {
      if (this.proximoArquivo) await this.pagina.enviar('DOM.setFileInputFiles', { files: [this.proximoArquivo], backendNodeId: p.backendNodeId })
    })
    await this.pagina.enviar('Runtime.enable')
    await this.pagina.enviar('Log.enable')
    await this.pagina.enviar('Page.enable')
    await this.pagina.enviar('DOM.enable')
    await this.pagina.enviar('Page.setInterceptFileChooserDialog', { enabled: true })
    const alvoNode = await esperarAte(async () => (await json(`http://127.0.0.1:${inspetor}/json/list`))[0], 'o inspetor do processo principal', 15000)
    this.principal = await Alvo.conectar(alvoNode.webSocketDebuggerUrl)
    await this.principal.enviar('Runtime.enable')
    await esperarAte(() => this.pagina.avaliar("document.readyState === 'complete' && !!document.querySelector('#barra button')"), 'a interface terminar de carregar')
  }

  /** Executa código no processo principal, com `electron` já disponível. */
  async principalAvaliar(corpo) {
    return this.principal.avaliar(`(async () => { const electron = process.mainModule.require('electron'); ${corpo} })()`)
  }

  desconectar() {
    this.pagina?.fechar()
    this.principal?.fechar()
  }

  /**
   * Faz o mesmo que "Sair" no menu da bandeja: pede o encerramento do app (app.quit) e espera o processo acabar.
   * O inspetor precisa ser desconectado, senão o Node espera o depurador sair antes de encerrar.
   */
  async sair(limiteMs = 15000) {
    await this.principalAvaliar('setTimeout(() => electron.app.quit(), 50); return 1')
    this.desconectar()
    await this.esperarEncerrar(limiteMs)
  }

  /** Espera o processo terminar sozinho (ex.: depois de "Sair"). */
  async esperarEncerrar(limiteMs = 15000) {
    await esperarAte(() => this.encerrou, 'o app encerrar', limiteMs)
  }

  async encerrarForcado() {
    this.desconectar()
    if (!this.encerrou) {
      this.processo.kill()
      await esperar(500)
    }
  }
}

let proximaPorta = 9400

/** Abre o app. `exe` é o executável; `argumentos` vão antes dos parâmetros de depuração. */
export async function abrirApp({ exe, argumentos = [], dados, conectar = true, ambiente = {} }) {
  const depuracao = proximaPorta++
  const inspetor = proximaPorta++
  const saida = []
  // ELECTRON_RUN_AS_NODE, mesmo vazio, faz o Electron rodar como Node puro: precisa ser removida.
  const env = { ...process.env, ...(dados ? { ALINHAVO_DADOS: dados } : {}), ...ambiente }
  delete env.ELECTRON_RUN_AS_NODE
  const processo = spawn(exe, [...argumentos, `--remote-debugging-port=${depuracao}`, `--inspect=${inspetor}`], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  processo.stdout.on('data', (b) => saida.push(String(b)))
  processo.stderr.on('data', (b) => saida.push(String(b)))
  const app = new App(processo, saida, { depuracao, inspetor })
  if (conectar) await app.conectar()
  return app
}

// ---------- Ações na interface ----------

/** Ajudantes que rodam dentro da página. Todos usam apenas o DOM, como uma pessoa usaria. */
export const pagina = {
  /** Texto visível de toda a tela. */
  texto: (app) => app.pagina.avaliar('document.getElementById("tela").innerText'),

  /** Clica no primeiro botão ou link cujo texto contém `texto` (dentro de `raiz`, por padrão a página toda). */
  async clicarTexto(app, texto, raiz = 'document') {
    const achou = await app.pagina.avaliar(`(() => {
      const r = ${raiz};
      const el = [...r.querySelectorAll('button, a')].find((b) => b.textContent.replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(texto)}) && !b.closest('[hidden]'));
      if (!el) return false;
      el.click();
      return true;
    })()`)
    if (!achou) throw new Error(`Botão "${texto}" não encontrado`)
    await esperar(80)
  },

  /** Clica em um elemento por seletor CSS. */
  async clicar(app, seletor) {
    const achou = await app.pagina.avaliar(`(() => { const el = document.querySelector(${JSON.stringify(seletor)}); if (!el) return false; el.click(); return true })()`)
    if (!achou) throw new Error(`Elemento ${seletor} não encontrado`)
    await esperar(80)
  },

  /** Preenche campos da folha aberta, pelo rótulo (texto do <label>) e valor. */
  async preencher(app, valores) {
    for (const [rotulo, valor] of Object.entries(valores)) {
      const r = await app.pagina.avaliar(`(() => {
        const label = [...document.querySelectorAll('.folha label')].find((l) => l.textContent.trim() === ${JSON.stringify(rotulo)});
        if (!label) return 'rótulo não encontrado';
        const campo = document.getElementById(label.htmlFor);
        if (campo.tagName === 'SELECT') {
          const opcao = [...campo.options].find((o) => o.text === ${JSON.stringify(valor)} || o.value === ${JSON.stringify(valor)});
          if (!opcao) return 'opção não encontrada';
          campo.value = opcao.value;
        } else campo.value = ${JSON.stringify(valor)};
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        campo.dispatchEvent(new Event('change', { bubbles: true }));
        return campo.value !== '' || ${JSON.stringify(valor)} === '' ? 'ok' : 'valor não aceito';
      })()`)
      if (r !== 'ok') throw new Error(`Campo "${rotulo}": ${r}`)
    }
  },

  /** Envia o formulário aberto, como um clique em "Salvar". */
  salvarFolha: (app) => pagina.clicarTexto(app, 'Salvar', "document.querySelector('.folha')"),

  /** Vai para uma tela pela barra de navegação. */
  irPara: (app, nome) => pagina.clicarTexto(app, nome, "document.getElementById('barra')"),

  folhaAberta: (app) => app.pagina.avaliar("!!document.querySelector('.folha')"),
  avisoVisivel: (app) => app.pagina.avaliar("(() => { const a = document.getElementById('aviso'); return a.hidden ? '' : a.textContent })()"),

  /** Captura a página inteira como PNG (Buffer). */
  async capturar(app) {
    const r = await app.pagina.enviar('Page.captureScreenshot', { format: 'png' })
    return Buffer.from(r.data, 'base64')
  }
}
