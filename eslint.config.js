//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

/** Zasady kodu (src i testy): nazwane typy parametrów, bez IIFE. */
const codeRules = [
  {
    selector:
      ':function > :matches(Identifier, ObjectPattern, ArrayPattern).params > TSTypeAnnotation > TSTypeLiteral',
    message:
      'Define an interface (e.g. `interface FooProps`) for the parameter and destructure it, instead of an inline object type.',
  },
  {
    selector:
      ':function > AssignmentPattern.params > .left > TSTypeAnnotation > TSTypeLiteral',
    message:
      'Define an interface for the parameter and destructure it, instead of an inline object type.',
  },
  {
    selector:
      'CallExpression > :matches(ArrowFunctionExpression, FunctionExpression).callee',
    message:
      'Do not use IIFEs: extract a named function (or a component) and call it.',
  },
]

const testCall = 'CallExpression[callee.name=/^(it|test)$/]'
const testModifierCall =
  'CallExpression[callee.object.name=/^(it|test)$/][callee.property.name=/^(skip|only|fixme|fail)$/]'
const eachCall =
  ':matches(CallExpression[callee.callee.property.name="each"], CallExpression[callee.callee.name="testEach"])'
const notShould = '[value=/^(?!Should )/]'
const titleMessage = 'Test titles start with "Should …".'
const loops =
  ':matches(ForStatement, ForOfStatement, ForInStatement, WhileStatement, DoWhileStatement, CallExpression[callee.property.name="forEach"])'

/** Zasady testów: tytuły od „Should”, przypadki przez it.each / testEach, bez pętli z asercjami. */
const testRules = [
  ...codeRules,
  ...[testCall, testModifierCall, eachCall].flatMap((call) => [
    {
      selector: `${call} > Literal.arguments:first-child${notShould}`,
      message: titleMessage,
    },
    {
      selector: `${call} > TemplateLiteral.arguments:first-child > TemplateElement.quasis:first-child[value.raw=/^(?!Should )/]`,
      message: titleMessage,
    },
  ]),
  {
    selector: `${loops} :matches(${testCall}, ${testModifierCall})`,
    message:
      'Do not generate tests in a loop: use it.each (Vitest) or testEach (Playwright).',
  },
  {
    selector: `${loops} CallExpression[callee.name="expect"]`,
    message:
      'Do not assert in a loop: use it.each, or collect results and assert once.',
  },
]

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      'no-restricted-syntax': ['error', ...codeRules],
    },
  },
  {
    files: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...testRules],
    },
  },
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      '.output/**',
      'drizzle/**',
      'test-results/**',
      'tests/e2e/reset-db.mjs',
    ],
  },
]
