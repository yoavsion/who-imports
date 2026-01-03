import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default defineConfig([
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Test fixtures: sample TS files, no project-based linting needed
  {
    files: ['test-fixtures/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'test-fixtures/**'],
  },
]);
