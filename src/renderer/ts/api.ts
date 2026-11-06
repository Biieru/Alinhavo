import type { ApiAlinhavo } from '@shared/ipc'

/**
 * Acesso à API do preload (window.alinhavo). É a única forma de a interface falar com o
 * processo principal. Ela não tem acesso a arquivos, banco ou Node.
 */
export const api: ApiAlinhavo = window.alinhavo
