import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
  preset: 'bun',
  externals: {
    traceInclude: ['react-dom', 'react-dom/server'],
  },
})
