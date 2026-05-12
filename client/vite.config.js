import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const allowedDeploymentHosts = [
  'ec2-13-55-160-232.ap-southeast-2.compute.amazonaws.com',
  'd2prxcc5cbjmj6.cloudfront.net',
]

export default defineConfig(({ mode }) => {
  // Vite normally reads env files from the current project root (client/).
  // This project keeps env configuration at repository root instead.
  const fileEnv = loadEnv(mode, rootDir, '')

  // In Docker/EC2 deployment, the real root .env file is intentionally excluded
  // from the image and values are injected at container runtime via --env-file.
  // Therefore Vite server config must also fall back to process.env.
  const env = {
    ...fileEnv,
    ...process.env,
  }

  const disableHmr = env.VITE_DISABLE_HMR === 'true'

  return {
    plugins: [react(), tailwindcss()],
    envDir: rootDir,
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
      'import.meta.env.VITE_SOCKET_URL': JSON.stringify(env.VITE_SOCKET_URL),
      'import.meta.env.VITE_APP_NAME': JSON.stringify(env.VITE_APP_NAME),
      'import.meta.env.VITE_APP_ENV': JSON.stringify(env.VITE_APP_ENV),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      allowedHosts: allowedDeploymentHosts,
      port: Number(env.FRONTEND_PORT) || 5173,
      // The shared remote demo currently runs the Vite dev server behind
      // CloudFront/Nginx. Vite HMR uses its own websocket, which is not required
      // for the deployed demo and can fail noisily behind the proxy. Keep HMR on
      // by default for local development, but allow the remote env to disable it.
      hmr: disableHmr ? false : undefined,
    },
  }
})
