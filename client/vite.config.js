import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const allowedDeploymentHosts = [
  'ec2-13-55-160-232.ap-southeast-2.compute.amazonaws.com',
  'd2prxcc5cbjmj6.cloudfront.net',
]

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: allowedDeploymentHosts,
  },
})