// File: .eslintrc.js
export const plugins = ['@typescript-eslint', 'prettier'];
export const rules = {
  // Optional: You can turn off conflicting ESLint rules if necessary
  'prettier/prettier': 'error',
  // Remove or adjust object-curly-spacing if Prettier handles it
  '@typescript-eslint/object-curly-spacing': 'off',
};