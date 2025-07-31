import mdx from '@mdx-js/rollup'
import {defineConfig} from 'vite'
import { resolve } from 'path'

// Generate entry points for all sections
const jsSections = [
  'html-basics', 'css-fundamentals', 'introduction', 'variables-and-types',
  'functions', 'control-flow', 'objects-and-arrays', 'dom-manipulation',
  'async-javascript', 'error-handling', 'advanced-functions', 'prototypes',
  'modules', 'modern-features', 'common-pitfalls', 'best-practices'
];

const tsSections = [
  'introduction', 'type-problems', 'type-basics', 'interfaces-and-types', 'unions-and-literals',
  'generics', 'type-guards', 'utility-types', 'classes-and-oop',
  'modules-and-namespaces', 'async-types', 'common-patterns',
  'react-typescript', 'testing-typescript', 'migration-strategies',
  'ecosystem-and-tools'
];

// Create entry points object
const input = {
  main: resolve(__dirname, 'index.html')
};

const viteConfig = defineConfig({
  base: './', // Use relative paths for GitHub Pages
  plugins: [
    mdx(/* jsxImportSource: …, otherOptions… */)
  ],
  build: {
    rollupOptions: {
      input
    },
  },
  optimizeDeps: {
    exclude: ['monaco-themes']
  }
})

export default viteConfig