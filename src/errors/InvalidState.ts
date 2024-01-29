import { BaseError } from './BaseError.ts'

/**
 * Error thrown when the nonce could not be found in the state.
 */
export class InvalidStateError extends BaseError {
  constructor(nonce: string) {
    super(`Nonce ${nonce} could not be found in the state`, {
      name: InvalidStateError.name,
      data: { nonce },
      code: 'INVALID_STATE',
    })
  }
}
