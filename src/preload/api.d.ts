import type { ApiAlinhavo } from '../shared/ipc'

// Declara para o TypeScript da interface o objeto que o preload publica em `window`.
declare global {
  interface Window {
    alinhavo: ApiAlinhavo
  }
}

export {}
