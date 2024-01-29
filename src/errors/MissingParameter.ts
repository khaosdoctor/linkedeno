import { BaseError } from './BaseError.ts'

/**
 * Error thrown when a required parameter is missing.
 */
export class MissingParameterError extends BaseError {
  constructor(parameterList: string[]) {
    super(`Missing parameter(s): ${parameterList.join(', ')}`, {
      name: MissingParameterError.name,
      data: { parameterList },
      code: 'MISSING_PARAMETER',
    })
  }
}
