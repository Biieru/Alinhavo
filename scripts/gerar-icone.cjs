/**
 * Gera os ícones do Alinhavo a partir de um SVG com a identidade do app:
 * o envelope de molde (vermelho "sangue"), a moldura creme, a letra A em Old Standard TT
 * e a costura tracejada em mostarda.
 *
 * Roda dentro do Electron (assim a fonte do projeto é usada, sem depender de mais nada):
 *   npm run icone
 *
 * Saídas:
 *   build/icon.svg       desenho original
 *   build/icon.png       512x512 (usado pelo instalador)
 *   build/icon.ico       16 a 256 px (ícone do .exe e do instalador)
 *   resources/icone.png  256x256 (ícone da janela e das notificações)
 *   resources/bandeja.png 32x32 (ícone da bandeja)
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const raiz = path.resolve(__dirname, '..')
const fonte = pathToFileURL(path.join(raiz, 'src/renderer/assets/fonts/old-standard-tt-latin-700-normal.woff2')).href

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <style>@font-face{font-family:'OST';font-weight:700;src:url('${fonte}') format('woff2')}</style>
  <rect x="4" y="4" width="248" height="248" rx="40" fill="#7A2418"/>
  <rect x="16" y="16" width="224" height="224" rx="28" fill="none" stroke="#F0D9A8" stroke-width="3"/>
  <text x="128" y="172" text-anchor="middle" font-family="OST, 'Old Standard TT', Georgia, serif" font-weight="700" font-size="168" fill="#F3E9D2">A</text>
  <line x1="64" y1="208" x2="192" y2="208" stroke="#E3B04B" stroke-width="7" stroke-dasharray="15 11"/>
</svg>`

/** Monta um arquivo .ico com várias imagens PNG. */
function montarIco(imagens) {
  const cab = Buffer.alloc(6)
  cab.writeUInt16LE(0, 0)
  cab.writeUInt16LE(1, 2)
  cab.writeUInt16LE(imagens.length, 4)
  let deslocamento = 6 + 16 * imagens.length
  const entradas = []
  for (const { tamanho, png } of imagens) {
    const e = Buffer.alloc(16)
    e.writeUInt8(tamanho >= 256 ? 0 : tamanho, 0)
    e.writeUInt8(tamanho >= 256 ? 0 : tamanho, 1)
    e.writeUInt8(0, 2)
    e.writeUInt8(0, 3)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(deslocamento, 12)
    deslocamento += png.length
    entradas.push(e)
  }
  return Buffer.concat([cab, ...entradas, ...imagens.map((i) => i.png)])
}

app.whenReady().then(async () => {
  fs.mkdirSync(path.join(raiz, 'build'), { recursive: true })
  fs.mkdirSync(path.join(raiz, 'resources'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'build/icon.svg'), svg)

  const html = path.join(raiz, 'build/.icone-temp.html')
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block;width:1024px;height:1024px}</style>${svg}`)

  const janela = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: false } })
  await janela.loadFile(html)
  await janela.webContents.executeJavaScript('document.fonts.ready.then(() => document.fonts.load("700 100px OST")).then(() => true)')
  await new Promise((r) => setTimeout(r, 400))
  const grande = await janela.webContents.capturePage()
  const redimensionar = (px) => grande.resize({ width: px, height: px, quality: 'best' }).toPNG()

  fs.writeFileSync(path.join(raiz, 'build/icon.png'), redimensionar(512))
  fs.writeFileSync(path.join(raiz, 'resources/icone.png'), redimensionar(256))
  fs.writeFileSync(path.join(raiz, 'resources/bandeja.png'), redimensionar(32))
  fs.writeFileSync(path.join(raiz, 'build/icon.ico'), montarIco([16, 24, 32, 48, 64, 128, 256].map((t) => ({ tamanho: t, png: redimensionar(t) }))))

  fs.rmSync(html, { force: true })
  console.log('Ícones gerados.')
  app.quit()
})
