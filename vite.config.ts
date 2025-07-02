import mdx from '@mdx-js/rollup'
import {defineConfig} from 'vite'

const viteConfig = defineConfig({
  plugins: [
    mdx(/* jsxImportSource: …, otherOptions… */)
  ]
})

export default viteConfig