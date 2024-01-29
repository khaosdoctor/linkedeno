import { BaseError } from './BaseError.ts'

/**
 * Error thrown when the saved access or refresh token is expired.
 * @param type - The type of token that is expired.
 */
export class ExpiredTokenError extends BaseError {
  constructor(type: 'access' | 'refresh' = 'access') {
    super(`Saved ${type} token is expired, please perform the log in process`, {
      name: ExpiredTokenError.name,
      code: `EXPIRED_${type.toUpperCase()}_TOKEN`,
    })
  }
}
