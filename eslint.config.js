import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '.claude/**'] },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    files: ['apps/client/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['scripts/**/*.mjs'],
    // Node scripts; e2e callbacks passed to page.evaluate() also run in the browser.
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', URL: 'readonly', window: 'readonly' },
    },
  },
);
