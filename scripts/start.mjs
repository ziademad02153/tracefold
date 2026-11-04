import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const backendUrl = 'http://127.0.0.1:8001'
const frontendUrl = 'http://127.0.0.1:5173'
let backend
let frontend
let stopping = false

async function cleanup(code) {
  if (stopping) return
  stopping = true
  try {
    await frontend?.close()
  } finally {
    if (backend && backend.exitCode === null) {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(backend.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
      } else {
        backend.kill('SIGTERM')
      }
    }
    process.exit(code)
  }
}

process.on('SIGINT', () => void cleanup(0))
process.on('SIGTERM', () => void cleanup(0))

function occupied(port) {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port })
    socket.setTimeout(1000)
    socket.on('connect', () => { socket.destroy(); resolve(true) })
    socket.on('error', () => { socket.destroy(); resolve(false) })
    socket.on('timeout', () => { socket.destroy(); resolve(false) })
  })
}

async function isBackendReady() {
  try {
    const response = await fetch(backendUrl + '/openapi.json', { signal: AbortSignal.timeout(1500) })
    if (!response.ok) return false
    const schema = await response.json()
    return schema.info?.title === 'Tracefold' && Boolean(schema.paths?.['/api/projects'])
  } catch {
    return false
  }
}

try {
  if (await occupied(8001)) {
    if (!await isBackendReady()) throw new Error('Port 8001 is used by another service. Stop it and run npm start again.')
    console.log('Using the existing Tracefold backend on port 8001.')
  } else {
    const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
    if (!existsSync(python)) throw new Error('Missing .venv. Follow the Python setup in README.md first.')
    backend = spawn(python, ['-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', '8001'], {
      cwd: root, stdio: 'inherit', windowsHide: true,
    })
    backend.on('error', error => { console.error(error.message); void cleanup(1) })
    backend.on('exit', code => {
      if (!stopping) {
        console.error('Backend stopped.')
        void cleanup(code || 1)
      }
    })
    let ready = false
    for (let attempt = 0; attempt < 40 && !ready; attempt++) {
      ready = await isBackendReady()
      if (!ready) await delay(250)
    }
    if (!ready) throw new Error('Backend did not become ready. Check the Python output above.')
  }

  if (await occupied(5173)) {
    const response = await fetch(frontendUrl + '/@vite/client', { signal: AbortSignal.timeout(2000) })
    const html = await (await fetch(frontendUrl, { signal: AbortSignal.timeout(2000) })).text()
    if (!response.ok || !html.includes('<title>Tracefold</title>')) {
      throw new Error('Port 5173 is used by another service. Stop it and run npm start again.')
    }
    console.log('Using the existing Tracefold frontend on port 5173.')
  } else {
    const { createServer } = await import('vite')
    frontend = await createServer({ root, configFile: path.join(root, 'vite.config.ts') })
    await frontend.listen()
  }

  console.log('\nTracefold is ready: ' + frontendUrl + '/#projects')
  console.log('Press Ctrl+C to stop services started by this command.')
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const browser = spawn(command, [frontendUrl + '/#projects'], { stdio: 'ignore', windowsHide: true })
  browser.on('error', () => console.log('Open the URL above in your browser.'))
  // Keep the command alive even when both services were already running.
  setInterval(() => {}, 60_000)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  await cleanup(1)
}
