// File: eslint.config.js

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				project: true,
				tsconfigRootDir: __dirname,
			},
		},
		plugins: {
			import: importPlugin,
		},
		rules: {
			// Custom rules from old config
			'new-cap': 'off',
			'@typescript-eslint/prefer-readonly-parameter-types': 'off',
			'import/extensions': ['error', 'ignorePackages'],
			// Modern unused vars rule (replaces no-unused-vars-experimental)
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
				},
			],
		},
	},
	{
		ignores: [
			'dist/**',
			'node_modules/**',
			'web',
			'web/**',
			'data/**',
			'logs/**',
			'migrations/**',
			'*.config.js',
			'*.config.cjs',
			'*.config.mjs',
		],
	},
);
