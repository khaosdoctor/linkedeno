import { BaseError } from './BaseError.ts'

export class NoSavedTokenError extends BaseError {
  constructor(type: 'access' | 'refresh' = 'access') {
    super(`Could not find a saved ${type} token for this account, please perform the log in process`, {
      name: NoSavedTokenError.name,
      code: `NO_SAVED_${type.toUpperCase()}_TOKEN`,
    })
  }
}
