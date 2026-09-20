// scripts/ngrok-tunnel.mjs
//
// Exposes the local pharmacy server to the internet via an ngrok tunnel.
// Run this in a SEPARATE terminal while the server is already running
// (npm run dev / npm start / scripts/run-server.bat), or let the 24/7
// supervisor (scripts/run-tunnel.bat) keep it alive unattended.
//
// Usage:
//   npm run tunnel              (one-off, in its own window)
//   scripts\run-tunnel.bat      (supervised: auto-restarts if the tunnel dies)
//
// Environment (read from .env):
//   NGROK_AUTHTOKEN  required. Get a free token from:
//                    https://dashboard.ngrok.com/get-started/your-authtoken
//   NGROK_DOMAIN     optional. Pin a reserved/custom domain (e.g. my-pharmacy.ngrok.app).
//                    Leave blank to use the account's automatic static domain.
//   PORT             local port to forward to. Defaults to 3000.
//
// Exit codes (the supervisor uses these):
//   0  tunnel closed cleanly (Ctrl+C)
//   1  transient failure (no internet / ngrok unreachable) -> retry
//   2  configuration error (missing NGROK_AUTHTOKEN)        -> do NOT retry

import fs from 'node:fs'
import path from 'node:path'
import ngrok from '@ngrok/ngrok'

const rootDir = process.cwd()
const envPath = path.join(rootDir, '.env')

// Minimal .env loader (the project has no dependency on the `dotenv` package,
// and this script runs standalone outside of the Next.js process).
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIndex = line.indexOf('=')
    if (eqIndex === -1) continue
    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadEnvFile(envPath)

const port = parseInt(process.env.PORT || '3000', 10)
const authtoken = process.env.NGROK_AUTHTOKEN?.trim()
const domain = process.env.NGROK_DOMAIN?.trim()
// listenAndForward() requires a full URL (with scheme). The IPv4 loopback is
// used explicitly because the app binds 0.0.0.0 (IPv4 only), while "localhost"
// can resolve to IPv6 ::1 first and make ngrok answer 502.
const forwardTo = `http://127.0.0.1:${port}`

const stamp = () => new Date().toISOString()

console.log('\n=============================================================')
console.log('🌐 BMH Pharmacy System - ngrok Internet Tunnel')
console.log('=============================================================')

if (!authtoken) {
  console.error(`[ngrok] ${stamp()} ❌ NGROK_AUTHTOKEN is not set in .env`)
  console.error('[ngrok]    1. Sign up for a free account: https://dashboard.ngrok.com/signup')
  console.error('[ngrok]    2. Copy your authtoken:        https://dashboard.ngrok.com/get-started/your-authtoken')
  console.error('[ngrok]    3. Add it to .env as:           NGROK_AUTHTOKEN=your_token_here')
  // Exit code 2 tells the supervisor this is a configuration problem, not a
  // network blip, so it must not spin in a retry loop.
  process.exit(2)
}

// Surface ngrok's own warnings/errors in our log so problems are diagnosable
// in logs\tunnel.log without an interactive terminal.
try {
  ngrok.loggingCallback((level, target, message) => {
    if (level === 'ERROR' || level === 'WARN') {
      console.log(`[ngrok:${level}] ${stamp()} ${target} ${message}`)
    }
  }, 'warn')
} catch {
  // logging callback is best-effort only
}

console.log(`[ngrok] ${stamp()} Connecting to ngrok and forwarding ${forwardTo} ...`)
if (domain) {
  console.log(`[ngrok] Pinned domain requested: ${domain}`)
} else {
  console.log('[ngrok] No NGROK_DOMAIN set - using your account\'s default static domain.')
}
console.log('[ngrok] Make sure the pharmacy server (npm run dev / npm start) is already running.')

let session
let listener
try {
  session = await new ngrok.SessionBuilder()
    .authtoken(authtoken)
    // ngrok handles reconnection internally (with backoff) whenever the
    // network drops or the edge closes the session. Returning true means
    // "keep retrying forever" - this is what makes the tunnel survive
    // reboots of the router, ISP blips and sleep/resume cycles.
    .handleDisconnection((addr, err) => {
      console.log(`[ngrok] ${stamp()} ⚠️  Session disconnected (${addr || 'agent'}): ${err}`)
      console.log(`[ngrok] ${stamp()} 🔄 ngrok will retry automatically...`)
      return true
    })
    .handleStopCommand(() => {
      console.log(`[ngrok] ${stamp()} 🛑 Stop command received from the ngrok dashboard.`)
    })
    .connect()

  const endpoint = session.httpEndpoint()
  if (domain) {
    endpoint.domain(domain)
  }
  listener = await endpoint.listenAndForward(forwardTo)
} catch (err) {
  console.error(`[ngrok] ${stamp()} ❌ Failed to start tunnel: ${err.message}`)
  console.error('[ngrok]    Common causes: no internet connection, invalid/expired auth token,')
  console.error('[ngrok]    or an NGROK_DOMAIN that is not reserved on your ngrok account.')
  if (session) {
    try {
      await session.close()
    } catch {
      // ignore
    }
  }
  // Exit code 1 = transient/fixable -> the supervisor retries in 30 seconds.
  process.exit(1)
}

const url = listener.url()
console.log('\n-------------------------------------------------------------')
console.log(`✅ Public URL: ${url}`)
console.log('-------------------------------------------------------------')
console.log('Share this URL to access the pharmacy system over the internet.')
console.log('Press Ctrl+C to stop the tunnel. Leave this running for 24/7 access.\n')

// Keep the Node.js process alive while the tunnel is open. The ngrok SDK does
// not hold the event loop open on its own, so without this the script would
// exit immediately after the listener is created.
try {
  process.stdin.resume()
} catch {
  // stdin is unavailable when launched headless by Task Scheduler
}

// Long, self-rescheduling timer: guarantees the event loop never drains even
// if stdin is not available (Task Scheduler / SYSTEM account).
const keepAlive = setInterval(() => {}, 6 * 60 * 60 * 1000)

let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`\n[ngrok] ${stamp()} Closing tunnel...`)
  clearInterval(keepAlive)
  try {
    if (listener) await listener.close()
  } catch {
    // ignore errors on shutdown
  }
  try {
    if (session) await session.close()
  } catch {
    // ignore errors on shutdown
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
