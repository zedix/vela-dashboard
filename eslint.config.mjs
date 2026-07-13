// @ts-check
// ─────────────────────────────────────────────────────────────────────────────
// ESLint flat config — recommended presets only, no bespoke rule soup.
//
// Division of labour: Prettier owns formatting, `tsc --strict` owns type
// correctness, and ESLint owns what the compiler cannot see — template
// accessibility (we invested in keyboard-accessible rows; guard it) and
// Angular structure. The two selector rules encode AGENTS.md's naming doctrine
// (components kebab-case `vela-*`, directives camelCase `vela*`) so the
// convention is enforced, not just written down.
// ─────────────────────────────────────────────────────────────────────────────
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', '.angular/', 'coverage/', 'node_modules/'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        // Type-aware linting via the project service — powers the one
        // type-checked rule we opt into below (`no-floating-promises`), the
        // leak class this real-time app cares about most.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'vela', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'vela', style: 'kebab-case' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
);
