import neostandard from 'neostandard'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import chaiFriendly from 'eslint-plugin-chai-friendly'

export default [
  {
    ignores: [
      'artifacts/**',
      'cache/**',
      'coverage/**',
      'node_modules/**',
      'typechain-types/**',
      'docs/**',
      '.worktrees/**',
      'eslint.config.mjs',
    ],
  },
  ...neostandard({
    ts: true,
    noStyle: true,
  }),
  prettierRecommended,
  // chai-friendly: replace no-unused-expressions with a chai-aware version so
  // assertion-style `expect(x).to.equal(y)` is not flagged. Apply only in test/.
  {
    files: ['test/**/*.ts'],
    plugins: { 'chai-friendly': chaiFriendly },
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-unused-expressions': 'off',
      'chai-friendly/no-unused-expressions': 'error',
    },
  },
]
