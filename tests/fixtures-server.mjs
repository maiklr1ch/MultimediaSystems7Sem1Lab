// Мінімальний HTTP-сервер з підтримкою Range для tests/fixtures.
// Використовується e2e-тестом, а також для демонстрації відтворення за URL без інтернету:
//   npm run serve:fixtures   → http://127.0.0.1:8080/sample.mp4, …/hls/index.m3u8

import { createReadStream, statSync } from 'node:fs'
import http from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRange } from '../src/main/range.ts'

export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

const MIME = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t'
}

/** @returns {Promise<{ server: http.Server, baseUrl: string, rangeRequests: string[] }>} */
export async function startFixturesServer(port = 0) {
  const rangeRequests = []

  const server = http.createServer((req, res) => {
    const filePath = normalize(join(FIXTURES, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
    let size
    try {
      if (!filePath.startsWith(FIXTURES)) throw new Error('outside fixtures')
      size = statSync(filePath).size
    } catch {
      res.writeHead(404).end('not found')
      return
    }

    const headers = {
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*'
    }
    const range = parseRange(req.headers.range, size)

    if (range === 'unsatisfiable') {
      res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }).end()
    } else if (range) {
      rangeRequests.push(req.url)
      res.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
        'Content-Length': range.end - range.start + 1
      })
      createReadStream(filePath, range).pipe(res)
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': size })
      createReadStream(filePath).pipe(res)
    }
  })

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}`, rangeRequests }
}

// Запуск напряму: node tests/fixtures-server.mjs [port]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { baseUrl } = await startFixturesServer(Number(process.argv[2] ?? 8080))
  console.log(`Тестові файли доступні за адресою ${baseUrl}\n`)
  for (const name of ['sample.mp4', 'sample.webm', 'sample.mp3', 'sample.wav', 'hls/index.m3u8']) {
    console.log(`  ${baseUrl}/${name}`)
  }
  console.log('\nВставте посилання в рядок угорі програвача. Ctrl+C — зупинити сервер.')
}
