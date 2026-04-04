/**
 * Resale Scanner Pro — Static File Server
 * Vergara Inc · Loft OS v1.0
 *
 * Serves the Vite build output from dist/.
 * Same pattern as Sous Chef — proven on Railway.
 *
 * Railway injects PORT automatically. Do not hardcode it.
 */

const http = require('node:http')
const fs   = require('node:fs')
const path = require('node:path')

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

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('not found')
})

server.listen(port, '0.0.0.0', () => {
  console.log(`🔍 Resale Scanner Pro · http://localhost:${port}`)
})
