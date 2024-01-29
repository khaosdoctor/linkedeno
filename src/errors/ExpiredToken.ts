import { BaseError } from './BaseError.ts'

export class ExpiredTokenError extends BaseError {
  constructor(type: 'access' | 'refresh' = 'access') {
    super(`Saved ${type} token is expired, please perform the log in process`, {
      name: ExpiredTokenError.name,
      code: `EXPIRED_${type.toUpperCase()}_TOKEN`,
    })
  }
}
