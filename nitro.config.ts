import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
  preset: 'node-server',
  exportConditions: ['bun', 'node', 'import', 'default'],
  externals: {
    traceInclude: ['react-dom', 'react-dom/server'],
  },
})
