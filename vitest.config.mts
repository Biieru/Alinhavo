import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Os testes rodam em Node puro (sem Electron). O better-sqlite3 usa N-API,
// então o mesmo binário serve para os testes e para o app.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  },
  resolve: { alias: { '@shared': resolve('src/shared') } }
})
