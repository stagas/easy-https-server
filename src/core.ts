import { exists } from 'everyday-node'
import { KeyedCache } from 'everyday-utils'
import * as fs from 'fs'
import { CreateReadStreamOptions } from 'fs/promises'
import type { OutgoingHttpHeaders } from 'http'
import mime from 'mime-types'
import * as path from 'path'
import { HttpContext } from './easy-https-server'

export type { OutgoingHttpHeaders }

export function contentType(filename: string) {
  return {
    'content-type': mime.contentType(path.basename(filename)) || 'application/octet-stream',
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
  readStreamOptions?: CreateReadStreamOptions
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

  const fd = await fs.promises.open(pathname, 'r')
  const fileStream = fd.createReadStream(readStreamOptions)

  fileStream.pipe(res)
}
