/**
 * Base error class for all errors thrown by the LinkedInClient.
 */
export class BaseError<TData = unknown> extends Error {
  readonly data?: TData
  readonly code?: string
  readonly status?: number

  constructor(message: string, options?: { name?: string; data?: TData; code?: string; cause?: Error }) {
    super(message)
    this.name = `LinkedInClient${name}` || 'LinkedInClientError'
    this.cause = options?.cause
    this.data = options?.data
    this.code = options?.code
  }
}
