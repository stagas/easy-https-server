import chalk from '@stagas/chalk'
import * as fs from 'fs'
import type { ServerOptions } from 'https'
import makeCertFn from 'make-cert'
import * as os from 'os'
import qrcode from 'qrcode-terminal'

export type { ServerOptions }

export const makeCert = (hostname: string): ServerOptions => makeCertFn(hostname)

const thru = (s: any) => s

const colors = {
  GET: chalk.grey,
  POST: chalk.yellow,
  INF: chalk.cyan,
  LSN: chalk.blue,
  OPN: chalk.cyan,
  '200': chalk.blue,
  '304': chalk.yellow,
  '404': chalk.red,
  '500': chalk.red,
} as const

export function getNetworkAddress(options: { port: number }) {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses!) {
      const { address: host, family, internal } = address
      if (!internal && family === 'IPv4') {
        return `https://${host}:${options.port}`
      }
    }
  }
  return '-'
}

export const logOptions = {
  quiet: false,
  localAddress: '',
  extraInfo: '',
}

export function log(...args: any[]) {
  return !logOptions.quiet && console.log(...args)
}

const secs = Intl.NumberFormat(void 0, { maximumFractionDigits: 3 })

let taskStart: Date | void = void 0

export function startTask(force = false) {
  taskStart = ((force || !taskStart) && new Date()) || taskStart
}

function printIdle() {
  hr(chalk.black, '-')
  if (taskStart) {
    const msg = ` ${secs.format((lastPrintTime.getTime() - taskStart.getTime()) / 1000)}s `
    const col = process.stdout.columns - msg.length
    log(`\x1B[1A\x1B[${col}C${chalk.black(msg)}`)
    taskStart = void 0
  }
}

const dateFmt = Intl.DateTimeFormat(void 0, {
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hour12: false,
  fractionalSecondDigits: 3,
})

let idleTimeout: any

let lastPrintTime: Date

export function readCert(name: string) {
  return {
    cert: fs.readFileSync(`${name}.pem`),
    key: fs.readFileSync(`${name}-key.pem`),
  } as ServerOptions
}

export function getAddress(options: {
  hostname: string
  port: number
}) {
  const localAddress = `https://${options.hostname}:${options.port}`
  const networkAddress = getNetworkAddress(options)
  return { localAddress, networkAddress }
}

export function printAddress({ localAddress, networkAddress, color, qrcode: enableQrcode }: {
  localAddress: string
  networkAddress: string
  color?: string
  qrcode?: boolean
}) {
  hr((chalk as any)[color ?? 'blue'])
  if (enableQrcode) {
    qrcode.generate(networkAddress, { small: true })
  }
  print('LSN', chalk.yellow.underline(localAddress))
  print('LSN', chalk.yellow.underline(networkAddress))
}

export function print(s: any, ...rest: any[]) {
  clearTimeout(idleTimeout)
  idleTimeout = setTimeout(printIdle, 4000)
  const date = new Date()
  lastPrintTime = date
  return log(`${chalk.grey(dateFmt.format(date))} ${(colors[s as keyof typeof colors] ?? thru)(s)}`, ...rest)
}

export function hr(chalk: (s: string) => string, dash = '─') {
  log(chalk(dash.repeat(process.stdout.columns ?? 0)))
  if (logOptions.localAddress) {
    log(`\x1B[1A${chalk('> ' + logOptions.localAddress
      + (logOptions.extraInfo ? ' ' + logOptions.extraInfo : ''))} `)
  }
}
