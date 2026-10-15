const names = 'chrome document window navigator location getComputedStyle innerWidth innerHeight addEventListener confirm requestAnimationFrame cancelAnimationFrame AudioContext AudioWorkletNode AudioWorkletProcessor registerProcessor MutationObserver IntersectionObserver InputEvent HTMLTextAreaElement Option crypto fetch URL Blob FormData Response AbortController DOMException TextEncoder TextDecoder setTimeout clearTimeout console process Buffer performance structuredClone queueMicrotask'.split(' ');
export default [{
  files: ['extension/**/*.js', 'tests/**/*.js', 'tests/**/*.mjs', 'scripts/**/*.mjs', 'eslint.config.js'],
  languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals: Object.fromEntries(names.map(name => [name, 'readonly']))},
  rules: {'no-undef': 'error', 'no-unused-vars': ['error', {argsIgnorePattern: '^_', caughtErrors: 'none'}], 'no-dupe-keys': 'error', 'no-unreachable': 'error', 'no-constant-condition': ['error', {checkLoops: false}], 'constructor-super': 'error', 'no-unsafe-finally': 'error', 'valid-typeof': 'error', 'eqeqeq': ['error', 'always']}
}];
