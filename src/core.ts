import * as fs from 'fs'
import type { OutgoingHttpHeaders } from 'http'
import mime from 'mime-types'
import { exists } from 'node-utils'
import * as path from 'path'
import { KeyedCache } from 'utils'
import { HttpContext } from './easy-https-server.ts'

export type { OutgoingHttpHeaders }

export function contentType(filename: string) {
  const name = path.basename(filename)
  return {
    'content-type': name.endsWith('.map')
      ? 'application/json'
      : (mime.contentType(name) || 'application/octet-stream'),
  }
}

export function link(earlyHints: string[] | Set<string>) {
  return (earlyHints as Set<string>).size ?? (earlyHints as string[]).length
    ? {
      link: [...earlyHints].join(', '),
    }
    : {}
}

export function lastModified(x: Date | number) {
  return {
    'last-modified': new Date(x).toUTCString(),
  }
}

export function etag(stat: { mtime: Date; size: number }) {
  const mtime = stat.mtime.getTime().toString(16)
  const size = stat.size.toString(16)
  return '"' + size + '-' + mtime + '"'
}

export function expires(x: Date | number) {
  return {
    expires: new Date(x).toUTCString(),
  }
}

export const fsStats = KeyedCache((pathname: string) => fs.promises.stat(pathname))

export const serveStatic = async (req: HttpContext['req'], res: HttpContext['res'], pathname: string, {
  cache = 'public, max-age=720',
  ifNoneMatch = req.headers['if-none-match'] ?? '',
  outgoingHeaders = {},
  readStreamOptions = {},
}: {
  cache?: string
  ifNoneMatch?: string
  outgoingHeaders?: OutgoingHttpHeaders
  readStreamOptions?: fs.ReadStreamOptions
} = {}) => {
  const isFound = await exists(pathname)
  if (!isFound) {
    res.writeHead(404)
    res.end()
    return
  }

  const stat = await fsStats(pathname)
  if (!stat.isFile()) {
    res.writeHead(404)
    res.end()
    return
  }

  const cacheControl = {
    'cache-control': cache,
    etag: etag(stat),
  }

  const headers = {
    ...outgoingHeaders,
    ...cacheControl,
    ...contentType(pathname),
  }

  if (ifNoneMatch && ifNoneMatch === cacheControl.etag) {
    res.writeHead(304, headers)
    res.end()
    return
  }

  let size = stat.size
  if (readStreamOptions.start) {
    size -= readStreamOptions.start
  }
  if (readStreamOptions.end) {
    size -= stat.size - readStreamOptions.end
  }

  res.writeHead(200, {
    ...headers,
    'content-size': size,
  })

  const fileStream = fs.createReadStream(pathname, readStreamOptions)

  fileStream.pipe(res)
}
