/* ambient types like: */

declare module 'qrcode-terminal'

declare module 'make-cert' {
  declare export default (_hostname: string) => import('https').ServerOptions
}
