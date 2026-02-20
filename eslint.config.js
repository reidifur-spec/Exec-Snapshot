import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import hooksPlugin from 'eslint-plugin-react-hooks';
import refreshPlugin from 'eslint-plugin-react-refresh';

export default [
  { languageOptions: { globals: globals.browser } },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      'react': pluginReact,
      'react-hooks': hooksPlugin,
      'react-refresh': refreshPlugin,
    },
    rules: {
        'react-refresh/only-export-components': 'warn',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        '@typescript-eslint/no-explicit-any': 'off',
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  {
    ignores: ["dist", "eslint.config.js"]
  }
];
