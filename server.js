/**
 * Resale Scanner Pro — Static File Server
 * Vergara Inc · Loft OS v1.0
 *
 * Serves the Vite build output from dist/.
 * Same pattern as Sous Chef — proven on Railway.
 *
 * Railway injects PORT automatically. Do not hardcode it.
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const port    = Number(process.env.PORT || 3000)
const distDir = path.join(__dirname, 'dist')

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
}

const server = http.createServer((req, res) => {
  // Health check for Railway
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('ok')
    return
  }

  // Debug endpoint — diagnose dist/ availability at runtime
  if (req.url === '/debug') {
    const distExists = fs.existsSync(distDir)
    let distFiles = null
    if (distExists) {
      try {
        distFiles = fs.readdirSync(distDir)
      } catch (e) {
        distFiles = `error reading dir: ${e.message}`
      }
    }
    const payload = {
      cwd: process.cwd(),
      __dirname,
      distDir,
      distExists,
      distFiles,
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(payload, null, 2))
    return
  }

  // Serve static file or fall back to index.html (SPA routing)
  const safePath = req.url === '/' ? '/index.html' : req.url
  const filePath = path.join(distDir, safePath.replace(/^\/+/, '').split('?')[0])

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath)
    return
  }

  // SPA fallback — all routes serve index.html
  const indexPath = path.join(distDir, 'index.html')
  if (fs.existsSync(indexPath)) {
    sendFile(res, indexPath)
    return
  }

  // dist/ not found — log for diagnosis
  if (!fs.existsSync(distDir)) {
    console.error(`[ERROR] dist/ directory not found at ${distDir}. Build output may not have been preserved in the runtime image.`)
  } else {
    console.error(`[ERROR] index.html not found inside ${distDir}. dist/ exists but may be empty or malformed.`)
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('not found')
})

server.listen(port, '0.0.0.0', () => {
  // Startup check — confirm dist/ is present before accepting traffic
  const distExists = fs.existsSync(distDir)
  if (distExists) {
    let fileCount = 0
    try { fileCount = fs.readdirSync(distDir).length } catch (_) {}
    console.log(`🔍 Resale Scanner Pro · http://localhost:${port}`)
    console.log(`✅ dist/ found at ${distDir} (${fileCount} entries)`)
  } else {
    console.error(`🔍 Resale Scanner Pro · http://localhost:${port}`)
    console.error(`❌ dist/ NOT found at ${distDir} — app will serve 404. Check that the build step ran and the output was preserved in the runtime image.`)
  }
})
