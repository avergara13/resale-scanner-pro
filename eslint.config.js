import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'scripts', '.claude'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Classic react-hooks rules — keep as error (catch real bugs)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Compiler rules (new in react-hooks v7).
      //
      // Disabled because they OOM the GitHub-hosted CI runner. Each rule
      // walks a Babel-derived flow graph of the component tree, and on
      // large files (notably AIScreen.tsx at 2k+ lines) the cumulative
      // memory pressure exceeds 10GB heap (verified on PR #201 — even
      // --max-old-space-size=10240 OOMed mid mark-compact at ~10090 MB).
      //
      // These rules were already at 'warn' with the comment "many
      // pre-existing violations" — they were flagging legacy patterns,
      // not gating new code. Setting them to 'off' loses informational
      // signal but doesn't loosen any blocking gate. Local IDE integrations
      // can still surface them ad-hoc; revisit if the upstream rule
      // implementation gets more memory-efficient.
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/component-hook-factories': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/config': 'off',
      'react-hooks/gating': 'off',

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // Pre-existing standard JS violations — warn only
      'no-case-declarations': 'warn',
      'no-empty': 'warn',
      'prefer-const': 'warn',

      // New ESLint/typescript-eslint rules with pre-existing violations — warn only
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'warn',
    },
  },
)
