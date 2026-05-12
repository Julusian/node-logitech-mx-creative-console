import { generateEslintConfig } from '@sofie-automation/code-standard-preset/eslint/main.mjs'

const baseConfig = await generateEslintConfig({
	enableTypescript: true,
	tsconfigName: [
		'./tsconfig.json',
		'./tsconfig.test.json',
		'./packages/core/tsconfig.json',
		'./packages/node/tsconfig.json',
		'./packages/webhid/tsconfig.json',
		'./packages/webhid-demo/tsconfig.json',
	],
	testRunner: 'vitest',
})

const customConfig = [
	...baseConfig,

	{ files: ['**/*.ts', '**/*.tsx'], rules: { '@typescript-eslint/consistent-type-imports': 'error' } },

	{
		files: ['**/examples/*.js', '**/*.cjs'],
		rules: { '@typescript-eslint/no-require-imports': 'off', 'n/no-missing-import': 'off' },
	},
	{
		files: ['**/__tests__/**/*', '**/__mocks__/**/*', '**/examples/**/*'],
		rules: { 'n/no-extraneous-require': 'off', 'n/no-extraneous-import': 'off' },
	},
	{
		files: ['packages/webhid-demo/src/**/*'],
		rules: { '@typescript-eslint/no-require-imports': 'off', 'n/no-missing-import': 'off' },
	},
]

export default customConfig
