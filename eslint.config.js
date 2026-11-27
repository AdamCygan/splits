//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import security from 'eslint-plugin-security'

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
  {
    selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
    message:
      'Avoid dangerouslySetInnerHTML (XSS). If the HTML is fully ours, disable this line with a comment saying why it is safe.',
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

/**
 * Wzorce niebezpieczne niezależnie od kontekstu (eslint-plugin-security). Bez reguł opartych
 * na heurystyce (detect-object-injection, detect-unsafe-regex, detect-non-literal-regexp,
 * detect-non-literal-fs-filename): przy TypeScripcie dają głównie fałszywe alarmy, a te
 * przypadki dokładniej sprawdza CodeQL w CI (js/redos, js/polynomial-redos, js/regex-injection).
 */
const securityRules = {
  'security/detect-bidi-characters': 'error',
  'security/detect-buffer-noassert': 'error',
  'security/detect-child-process': 'error',
  'security/detect-disable-mustache-escape': 'error',
  'security/detect-eval-with-expression': 'error',
  'security/detect-new-buffer': 'error',
  'security/detect-no-csrf-before-method-override': 'error',
  'security/detect-non-literal-require': 'error',
  'security/detect-pseudoRandomBytes': 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-script-url': 'error',
}

/**
 * Warstwy funkcji (src/features/<nazwa>): views → controllers → data / domain.
 * Widok tylko wyświetla; wywołania API i mutacje są w kontrolerach (use-*.ts),
 * a reguły biznesowe w domain/ (czyste funkcje, bez Reacta i sieci).
 */
const serverOnly = {
  regex: String.raw`(^#/server/|\.server$)`,
  message:
    'Server-only code (Drizzle, Hono, secrets) must not reach the browser bundle.',
}
const viewImports = [
  serverOnly,
  {
    regex: String.raw`/data/api$`,
    message:
      'Views do not call the API: use a controller (controllers/use-*.ts).',
  },
  {
    regex: String.raw`^#/shared/data/mutations$`,
    importNames: ['useDataMutation'],
    message:
      'Views do not run mutations: use a controller (controllers/use-*.ts).',
  },
]
const domainImports = [
  serverOnly,
  {
    regex: String.raw`^(react|react-dom|sonner|@tanstack/.*|#/lib/api-client|#/components/.*)$|/(controllers|views)/|/data/(?!dto$)`,
    message: 'Domain code is pure: no React, no network, no views.',
  },
]

export default [
  ...tanstackConfig,
  {
    plugins: { security },
    rules: securityRules,
  },
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
    files: ['src/features/*/views/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: viewImports }],
      'no-restricted-syntax': [
        'error',
        ...codeRules,
        {
          selector: 'ImportSpecifier[imported.name="useMutation"]',
          message:
            'Views do not run mutations: use a controller (controllers/use-*.ts).',
        },
      ],
    },
  },
  {
    files: ['src/features/*/domain/**', 'src/shared/domain/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: domainImports }] },
  },
  {
    files: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...testRules],
      // Testy celowo wysyłają adresy javascript:, żeby sprawdzić, że aplikacja je odrzuca.
      'no-script-url': 'off',
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
