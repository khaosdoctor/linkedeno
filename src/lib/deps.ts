import { ConsoleHandler, getLogger, setup } from 'https://deno.land/std@0.212.0/log/mod.ts'
setup({
  handlers: {
    console: new ConsoleHandler('DEBUG', {
      formatter: ({ datetime, levelName, loggerName, msg }) => {
        if (levelName === 'DEBUG' && (!Deno.env.get('DENO_ENV') || Deno.env.get('DENO_ENV') === 'production')) {
          return ''
        }
        return `${loggerName !== 'default' ? loggerName : ''}(${levelName})[${datetime.toISOString()}] ::\t${
          typeof msg === 'string' ? msg : Deno.inspect(msg)
        }`
      },
    }),
  },
})
export const logger = getLogger('linkedin-client')
export * from 'https://deno.land/x/zod@v3.21.4/mod.ts'
export { decodeBase64, encodeBase64 } from 'https://deno.land/std@0.212.0/encoding/base64.ts'
export { encodeHex } from 'https://deno.land/std@0.212.0/encoding/hex.ts'
export { delay } from 'https://deno.land/std@0.212.0/async/delay.ts'
