// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['.wrangler/**', 'dist/**'],
}, {
  rules: {
    // Layout of attributes is left to the author; the long lines are deliberate.
    'vue/first-attribute-linebreak': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/html-self-closing': 'off',
    // The hand-drawn components carried over from the old app are plain JavaScript.
    'vue/require-default-prop': 'off',
  },
})
