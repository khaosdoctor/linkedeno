import { z } from './deps.ts'

export const accessTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().transform((n) => n * 1000),
  refresh_token: z.string().optional(),
  refresh_token_expires_in: z
    .number()
    .optional()
    .transform((n) => (n ? n * 1000 : n)),
})
export type AccessTokenResponse = z.infer<typeof accessTokenResponseSchema>

export const makeAccessToken = (token: string) => z.string().brand('ACCESS_TOKEN').parse(token)
export const makeRefreshToken = (token: string | undefined) => z.string().optional().brand('REFRESH_TOKEN').parse(token)
export type AccessToken = ReturnType<typeof makeAccessToken>
export type RefreshToken = ReturnType<typeof makeRefreshToken>
