import baseConfig from '../../eslint.config.mjs';
import angular from '@angular-eslint/eslint-plugin';
import angularTemplateParser from '@angular-eslint/template-parser';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...baseConfig,
  {
    files: ['**/*.ts'],
    plugins: {
      '@angular-eslint': angular,
    },
    rules: {
      ...(angular?.configs?.base?.rules || {}),
      ...(angular?.configs?.recommended?.rules || {}),
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    plugins: {
      '@angular-eslint': angular,
    },
    languageOptions: {
      parser: angularTemplateParser,
    },
    processor: angular?.configs?.templateProcessor,
    rules: {
      ...(angular?.configs?.templateRecommended?.rules || {}),
      // Add or override Angular template rules here
    },
  }
); 