import { BaseError } from './BaseError.ts'

export class InvalidStateError extends BaseError {
  constructor(nonce: string) {
    super(`Nonce ${nonce} could not be found in the state`, {
      name: InvalidStateError.name,
      data: { nonce },
      code: 'INVALID_STATE',
    })
  }
}
