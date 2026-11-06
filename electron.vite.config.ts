import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'

/**
 * Política de segurança de conteúdo (CSP) da interface.
 * - Só carrega scripts do próprio app (nada de internet: o app funciona offline).
 * - 'unsafe-inline' em estilos é necessário porque a interface original usa atributos
 *   style="..." (por exemplo, a largura da costura da régua de progresso).
 * - As fotos vêm do protocolo interno alinhavo-foto:, e as miniaturas redimensionadas
 *   passam por blob:.
 * Só é injetada no build de produção; no modo de desenvolvimento o Vite precisa de websocket.
 */
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; " +
  "img-src 'self' alinhavo-foto: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"

function injetarCsp(): Plugin {
  return {
    name: 'alinhavo-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
    }
  }
}

export default defineConfig({
  // Processo principal: só o better-sqlite3 (módulo nativo) fica de fora do pacote gerado;
  // todo o resto é embutido pelo Vite.
  main: {
    build: {
      externalizeDeps: true,
      rollupOptions: { input: { index: resolve('src/main/index.ts') } }
    },
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  // Preload: com sandbox ativo o Electron exige um script CommonJS e sem imports externos.
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].js' }
      }
    },
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    root: resolve('src/renderer'),
    build: { rollupOptions: { input: { index: resolve('src/renderer/index.html') } } },
    resolve: { alias: { '@shared': resolve('src/shared') } },
    plugins: [injetarCsp()]
  }
})
