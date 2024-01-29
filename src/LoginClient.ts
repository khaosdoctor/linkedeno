import { AuthenticatedLinkedinClient } from './AuthenticatedClient.ts'
import { MissingParameterError } from './errors/MissingParameter.ts'
import { API_VERSION, LinkedinURLs, RESTLI_VERSION } from './lib/shared.ts'
import { encodeBase64, logger } from './lib/deps.ts'
import { accessTokenResponseSchema } from './lib/validations.ts'
import { InvalidStateError } from './errors/InvalidState.ts'

export interface LinkedinClientOptions {
  clientId: string
  clientSecret: string
  oauthCallbackUrl: string
  oauthScopes?: string[]
  customLogger?: typeof logger
  retryAttempts?: number
  defaultDelayBetweenRequestsMs?: number
  noRetries?: boolean
  noValidateCSRF?: boolean
  nonceExpirationMs?: number
}

export class LinkedinClient {
  protected readonly logger = logger
  protected readonly retries: number
  protected readonly defaultDelayBetweenRequestsMs: number
  static sessionMap = new Set<string>()

  apiVersion = API_VERSION
  restliProtocolVersion = RESTLI_VERSION

  constructor(protected readonly clientOptions: LinkedinClientOptions) {
    if (clientOptions.customLogger) {
      this.logger = clientOptions.customLogger
    }

    this.retries = clientOptions.retryAttempts ?? 3
    this.defaultDelayBetweenRequestsMs = clientOptions.defaultDelayBetweenRequestsMs ?? 500

    if (!clientOptions.clientId || !clientOptions.clientSecret || !clientOptions.oauthCallbackUrl) {
      const missing = Object.entries(clientOptions)
        .filter(([, value]) => !value)
        .map(([key]) => key)
      this.logger.critical(`Missing required options: ${missing.join(', ')}`)
      throw new MissingParameterError(missing)
    }
  }
  static get validSessions() {
    return LinkedinClient.sessionMap.values()
  }

  get loginUrl() {
    const url = new URL(LinkedinURLs.loginUrl)
    const nonce = encodeBase64(crypto.getRandomValues(new Uint8Array(32)))
    url.searchParams.append('response_type', 'code')
    url.searchParams.append('client_id', this.clientOptions.clientId)
    url.searchParams.append('redirect_uri', this.clientOptions.oauthCallbackUrl)
    url.searchParams.append('state', nonce)
    url.searchParams.append('scope', this.clientOptions.oauthScopes?.join(' ') ?? 'r_emailaddress r_basicprofile')

    this.logger.debug(`LinkedinClient.loginUrl :: URL ${url.toString()}`)
    this.logger.debug(`LinkedinClient.loginUrl :: nonce ${nonce}`)

    if (!this.clientOptions.noValidateCSRF) {
      LinkedinClient.sessionMap.add(nonce)
      this.logger.debug(`LinkedinClient.loginUrl :: adding nonce ${nonce}`)
      this.logger.debug(`LinkedinClient.loginUrl :: nonceMap ${Deno.inspect(LinkedinClient.sessionMap)}`)

      setTimeout(() => {
        this.logger.debug(`LinkedinClient.loginUrl :: removing nonce ${nonce}`)
        this.logger.debug(`LinkedinClient.loginUrl :: nonceMap ${Deno.inspect(LinkedinClient.sessionMap)}`)
        LinkedinClient.sessionMap.delete(nonce)
      }, this.clientOptions.nonceExpirationMs ?? 60000)
    }

    return { url: url.toString().replaceAll('+', '%20'), nonce }
  }

  async exchangeLoginToken(loginToken: string, receivedNonce: string) {
    if (!this.clientOptions.noValidateCSRF && !LinkedinClient.sessionMap.has(receivedNonce)) {
      this.logger.critical(`LinkedinClient.exchangeLoginToken :: receivedNonce ${receivedNonce} not found in nonceMap`)
      throw new InvalidStateError(receivedNonce)
    }

    const response = await fetch(LinkedinURLs.getOrRefreshAccessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: loginToken,
        redirect_uri: this.clientOptions.oauthCallbackUrl,
        client_id: this.clientOptions.clientId,
        client_secret: this.clientOptions.clientSecret,
      }),
    })

    const data = accessTokenResponseSchema.parse(await response.json())
    this.logger.debug(`LinkedinClient.exchangeAccessToken :: data ${Deno.inspect(data)}`)

    return new AuthenticatedLinkedinClient(this.clientOptions, data)
  }
}
