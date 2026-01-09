import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
  preset: 'node-server',
  externals: {
    traceInclude: ['react-dom', 'react-dom/server'],
  },
})
