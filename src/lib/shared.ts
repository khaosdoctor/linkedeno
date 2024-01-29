import { LinkedinMediaTypes } from './types.ts'

export const API_VERSION = '202311'
export const RESTLI_VERSION = '2.0.0'
const baseAPIUrl = 'https://api.linkedin.com/v2'
const baseAuthUrl = 'https://www.linkedin.com/oauth/v2'
const assetBaseUrl = 'https://api.linkedin.com/rest'

export const LinkedinURLs = {
  loginUrl: baseAuthUrl + '/authorization',
  getUserProfile: baseAPIUrl + '/me',
  getOrRefreshAccessToken: baseAuthUrl + '/accessToken',
  sharePost: assetBaseUrl + '/posts',
  postComment: (postUrn: string) => baseAPIUrl + `/socialActions/${postUrn}/comments`,
  assetUrl: (assetType: LinkedinMediaTypes) => assetBaseUrl + `/${assetType}s`,
} as const
