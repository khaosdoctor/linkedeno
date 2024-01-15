import { BaseError } from './BaseError.ts'

export class LinkedinAPIError extends BaseError {
  constructor(message: string, data: unknown, apiStatusCode = 'unknown', code?: string) {
    super(`Error when calling LinkedIn API (status: ${apiStatusCode}) :: "${message}"`, {
      name: LinkedinAPIError.name,
      data,
      code: `LINKEDIN_API_ERROR${code ? `_${code}` : ''}`,
    })
  }
}
