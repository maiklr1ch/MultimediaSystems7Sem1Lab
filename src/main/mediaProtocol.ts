import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { protocol } from 'electron'
import { getFormat } from '../shared/formats'
import { parseRange } from './range'

export const MEDIA_SCHEME = 'media'

const exposedFiles = new Map<string, string>()

/** Викликати до app.whenReady(). */
export function registerMediaSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        // stream: true обов'язковий для відтворення <video>/<audio> з власної схеми.
        stream: true
      }
    }
  ])
}

/** Дозволяє віддавати файл через media:// та повертає його URL. */
export function exposeFile(filePath: string): string {
  const id = randomUUID()
  exposedFiles.set(id, filePath)
  return `${MEDIA_SCHEME}://file/${id}`
}

/** Викликати після app.whenReady(). */
export function handleMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const { host, pathname } = new URL(request.url)
    const filePath = host === 'file' ? exposedFiles.get(pathname.slice(1)) : undefined
    if (!filePath) return new Response('Not found', { status: 404 })

    let size: number
    try {
      size = (await stat(filePath)).size
    } catch {
      return new Response('Not found', { status: 404 })
    }

    const headers = new Headers({
      'Content-Type': getFormat(filePath)?.mime ?? 'application/octet-stream',
      'Accept-Ranges': 'bytes'
    })

    const range = parseRange(request.headers.get('range'), size)

    if (range === 'unsatisfiable') {
      headers.set('Content-Range', `bytes */${size}`)
      return new Response(null, { status: 416, headers })
    }

    if (range === null) {
      headers.set('Content-Length', String(size))
      const body = size > 0 ? fileStream(filePath, 0, size - 1) : null
      return new Response(body, { status: 200, headers })
    }

    headers.set('Content-Length', String(range.end - range.start + 1))
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
    return new Response(fileStream(filePath, range.start, range.end), { status: 206, headers })
  })
}

function fileStream(filePath: string, start: number, end: number): ReadableStream {
  return Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream
}
