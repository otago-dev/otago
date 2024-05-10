// @ts-check

const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(eslint.configs.recommended, ...tseslint.configs.recommended, {
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
  },
});
