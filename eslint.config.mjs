import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Pastas geradas ou de terceiros não entram na checagem.
  { ignores: ['out/**', 'release/**', 'node_modules/**', 'scripts/**', 'build/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Variáveis começadas com "_" são intencionalmente ignoradas.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  }
)
