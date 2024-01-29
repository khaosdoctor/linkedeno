import { z } from './deps.ts'

/**
 * Validator for the response of the access token request.
 */
export const accessTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().transform((n) => n * 1000),
  refresh_token: z.string().optional(),
  refresh_token_expires_in: z
    .number()
    .optional()
    .transform((n) => (n ? n * 1000 : n)),
})
/**
 * Type of the response of the access token request.
 */
export type AccessTokenResponse = z.infer<typeof accessTokenResponseSchema>

/**
 * Helper function to generate the AccessToken type
 */
export const makeAccessToken = (token: string) => z.string().brand('ACCESS_TOKEN').parse(token)

/**
 * Helper function to generate the RefreshToken type
 */
export const makeRefreshToken = (token: string | undefined) => z.string().optional().brand('REFRESH_TOKEN').parse(token)

/**
 * Branded type for the access token
 */
export type AccessToken = ReturnType<typeof makeAccessToken>

/**
 * Branded type for the refresh token
 */
export type RefreshToken = ReturnType<typeof makeRefreshToken>
