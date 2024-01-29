import { LinkedinClient, LinkedinClientOptions } from './LoginClient.ts'
import { BaseError } from './errors/BaseError.ts'
import { ExpiredTokenError } from './errors/ExpiredToken.ts'
import { LinkedinAPIError } from './errors/LinkedinAPIError.ts'
import { NoSavedTokenError } from './errors/NoSavedToken.ts'
import { LinkedinURLs } from './lib/shared.ts'
import { delay } from './lib/deps.ts'
import {
  GetAssetStatusResponse,
  GetSelfProfileResponse,
  InitializeUploadOptions,
  LinkedinMediaTypes,
  LinkedinPostPayload,
  PostCommentResponse,
  VideoUploadInstructions,
} from './lib/types.ts'
import {
  AccessToken,
  AccessTokenResponse,
  accessTokenResponseSchema,
  makeAccessToken,
  makeRefreshToken,
  RefreshToken,
} from './lib/validations.ts'

interface ImageOrDocumentUploadResponse {
  urn: string
  uploadUrl: string
}

interface VideoUploadResponse {
  urn: string
  uploadUrl: VideoUploadInstructions
  uploadToken: string
}

interface ImageOrDocumentUploadOptions {
  uploadUrl: string
  source: string | Blob | Uint8Array | ArrayBuffer
}

interface UploadVideoOptions {
  videoBlob: Blob
  videoUrn: string
  urlArray: VideoUploadInstructions
  uploadToken: string
}

type BaseInitializeUploadResponse<T extends Exclude<LinkedinMediaTypes, LinkedinMediaTypes.ARTICLE>> = T extends
  LinkedinMediaTypes.IMAGE ? {
    value: {
      uploadUrl: string
      image: string
    }
  }
  : T extends LinkedinMediaTypes.DOCUMENT ? {
      value: {
        uploadUrl: string
        document: string
      }
    }
  : T extends LinkedinMediaTypes.VIDEO ? {
      value: {
        uploadToken: string
        uploadInstructions: VideoUploadInstructions
        video: string
      }
    }
  : never

export class AuthenticatedLinkedinClient extends LinkedinClient {
  #accessToken?: AccessToken
  accessTokenExpiresIn?: number
  accessTokenExpirationDate?: Date
  #refreshToken?: RefreshToken
  refreshTokenExpiresIn?: number
  refreshTokenExpirationDate?: Date

  constructor(clientOptions: LinkedinClientOptions, tokenResponse: AccessTokenResponse) {
    super(clientOptions)
    this.setTokens(tokenResponse)
  }

  //#region Utils
  setTokens(tokenObject: AccessTokenResponse) {
    this.clearTokens()
    this.#accessToken = makeAccessToken(tokenObject.access_token)
    this.accessTokenExpiresIn = tokenObject.expires_in
    this.accessTokenExpirationDate = new Date(Date.now() + this.accessTokenExpiresIn)
    if (tokenObject.refresh_token && tokenObject.refresh_token_expires_in) {
      this.#refreshToken = makeRefreshToken(tokenObject.refresh_token)
      this.refreshTokenExpiresIn = tokenObject.refresh_token_expires_in
      this.refreshTokenExpirationDate = new Date(Date.now() + this.accessTokenExpiresIn)
    }
  }

  clearTokens() {
    this.#accessToken = undefined
    this.accessTokenExpiresIn = undefined
    this.accessTokenExpirationDate = undefined
    this.#refreshToken = undefined
    this.refreshTokenExpiresIn = undefined
    this.refreshTokenExpirationDate = undefined
  }

  #isExpired(expirationTimestamp: Date) {
    return expirationTimestamp.getTime() < Date.now()
  }
  //#endregion

  //#region Accessors
  set accessToken(token: AccessToken | string) {
    const branded = makeAccessToken(token)
    this.#accessToken = branded
  }
  get accessToken(): AccessToken {
    if (!this.#accessToken || !this.accessTokenExpirationDate) {
      throw new NoSavedTokenError('access')
    }

    if (this.#isExpired(this.accessTokenExpirationDate)) {
      throw new ExpiredTokenError('access')
    }
    return this.#accessToken
  }

  get accessTokenExpiration() {
    if (!this.accessTokenExpirationDate) {
      throw new NoSavedTokenError('access')
    }

    return this.accessTokenExpirationDate
  }

  set refreshToken(token: RefreshToken | string) {
    const branded = makeRefreshToken(token)
    this.#refreshToken = branded
  }

  get refreshToken(): RefreshToken {
    if (!this.#refreshToken || !this.refreshTokenExpirationDate) {
      throw new NoSavedTokenError('refresh')
    }

    if (this.#isExpired(this.refreshTokenExpirationDate)) {
      throw new ExpiredTokenError('refresh')
    }

    return this.#refreshToken
  }

  get refreshTokenExpiration() {
    if (!this.refreshTokenExpirationDate) {
      throw new NoSavedTokenError('refresh')
    }

    return this.refreshTokenExpirationDate
  }
  //#endregion

  async refreshAccessToken(refreshToken = this.refreshToken) {
    this.logger.debug(`AuthenticatedClient.refreshAccessToken :: refreshing token`)
    this.logger.debug(`AuthenticatedClient.refreshAccessToken :: refreshToken is present`)
    const URLQueryString = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientOptions.clientId,
      client_secret: this.clientOptions.clientSecret,
    })
    const response = await fetch(`${LinkedinURLs.getOrRefreshAccessToken}?${URLQueryString.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    if (!response.ok) {
      const data = await response.text()
      this.logger.error(`AuthenticatedClient.refreshAccessToken :: failed to refresh token ${data}`)
      return null
    }

    const data = accessTokenResponseSchema.parse(await response.json())
    this.logger.info(`AuthenticatedClient.refreshAccessToken :: refreshed token ${Deno.inspect(data)}`)

    const parsedData = accessTokenResponseSchema.parse(data)
    this.setTokens(parsedData)

    return parsedData
  }

  async #baseInitializeUpload<T extends Exclude<LinkedinMediaTypes, LinkedinMediaTypes.ARTICLE>>(
    mediaType: T,
    payload: InitializeUploadOptions<T>,
    accessToken = this.accessToken,
  ): Promise<BaseInitializeUploadResponse<T>> {
    this.logger.info(
      `AuthenticatedClient.baseInitializeUpload :: initializing upload for ${mediaType}, payload ${
        Deno.inspect(
          payload,
        )
      }`,
    )
    const response = await fetch(`${LinkedinURLs.assetUrl(mediaType)}?action=initializeUpload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': this.restliProtocolVersion,
      },
      body: JSON.stringify({ initializeUploadRequest: payload }),
    })

    const data = await response.json()
    this.logger.debug(`AuthenticatedClient.baseInitializeUpload :: response ${Deno.inspect(data)}`)
    if (!response.ok || !data.value) {
      throw new LinkedinAPIError(
        'Failed to initialize upload',
        data,
        response.status.toString(),
        `FAILED_${mediaType.toUpperCase()}_UPLOAD_INIT`,
      )
    }

    return data
  }

  async #initializeVideoUpload(
    options: InitializeUploadOptions<LinkedinMediaTypes.VIDEO>,
    accessToken = this.accessToken,
  ) {
    const payload = {
      ...options,
      uploadCaptions: options.uploadCaptions ?? false,
      uploadThumbnail: options.uploadThumbnail ?? false,
    }

    const data = await this.#baseInitializeUpload(LinkedinMediaTypes.VIDEO, payload, accessToken)
    return {
      urn: data.value.video,
      uploadUrl: data.value.uploadInstructions,
      uploadToken: data.value.uploadToken,
    }
  }

  // Specific function for image/document uploads
  async #initializeImageUpload(
    options: InitializeUploadOptions<LinkedinMediaTypes.IMAGE>,
    accessToken = this.accessToken,
  ) {
    const payload = {
      owner: options.owner,
    }

    const {
      value: { image: urn, uploadUrl },
    } = await this.#baseInitializeUpload(LinkedinMediaTypes.IMAGE, payload, accessToken)

    return {
      uploadUrl,
      urn,
    }
  }

  async #initializeDocumentUpload(
    options: InitializeUploadOptions<LinkedinMediaTypes.DOCUMENT>,
    accessToken = this.accessToken,
  ) {
    const payload = {
      owner: options.owner,
    }

    const {
      value: { document: urn, uploadUrl },
    } = await this.#baseInitializeUpload(LinkedinMediaTypes.DOCUMENT, payload, accessToken)

    return {
      uploadUrl,
      urn,
    }
  }

  initializeUpload(
    mediaType: LinkedinMediaTypes.VIDEO,
    options: InitializeUploadOptions<LinkedinMediaTypes.VIDEO>,
    accessToken?: AccessToken,
  ): Promise<VideoUploadResponse>
  initializeUpload(
    mediaType: LinkedinMediaTypes.IMAGE | LinkedinMediaTypes.DOCUMENT,
    options: InitializeUploadOptions<typeof mediaType>,
    accessToken?: AccessToken,
  ): Promise<ImageOrDocumentUploadResponse>
  initializeUpload(
    mediaType: Exclude<LinkedinMediaTypes, LinkedinMediaTypes.ARTICLE>,
    options: InitializeUploadOptions<typeof mediaType>,
    accessToken = this.accessToken,
  ) {
    switch (mediaType) {
      case LinkedinMediaTypes.VIDEO:
        return this.#initializeVideoUpload(options as InitializeUploadOptions<LinkedinMediaTypes.VIDEO>, accessToken)
      case LinkedinMediaTypes.IMAGE:
        return this.#initializeImageUpload(options as InitializeUploadOptions<LinkedinMediaTypes.IMAGE>, accessToken)
      case LinkedinMediaTypes.DOCUMENT:
        return this.#initializeDocumentUpload(
          options as InitializeUploadOptions<LinkedinMediaTypes.DOCUMENT>,
          accessToken,
        )
      default:
        throw new BaseError(`Invalid media type ${mediaType}`, {
          code: 'INVALID_MEDIA_TYPE',
          data: { mediaType },
          name: 'InitializeUploadError',
        })
    }
  }

  async #downloadMedia(url: ImageOrDocumentUploadOptions['source']) {
    if (typeof url === 'string') {
      const response = await fetch(url)

      if (!response.ok) {
        const data = await response.text()
        this.logger.error(`AuthenticatedClient.#downloadMedia :: failed to download media ${response.status} ${data}`)
        throw new BaseError(`Failed to download media ${response.status}`, {
          code: 'FAILED_DOWNLOAD_MEDIA',
          data: { url },
          name: 'DownloadMediaError',
        })
      }
      const downloaded = await response.blob()
      return {
        size: downloaded.size,
        blob: downloaded,
        toUint8Array: async () => new Uint8Array(await downloaded.arrayBuffer()),
      }
    }

    if (url instanceof Blob) {
      return {
        size: url.size,
        blob: url,
        toUint8Array: async () => new Uint8Array(await url.arrayBuffer()),
      }
    }

    if (url instanceof Uint8Array) {
      return {
        size: url.byteLength,
        blob: new Blob([url]),
        toUint8Array: () => Promise.resolve(url),
      }
    }

    if (url instanceof ArrayBuffer) {
      return {
        size: url.byteLength,
        blob: new Blob([url]),
        toUint8Array: () => Promise.resolve(new Uint8Array(url)),
      }
    }

    throw new BaseError(`Invalid source type ${typeof url}`, {
      code: 'INVALID_SOURCE_TYPE',
      data: { url },
      name: 'DownloadMediaError',
    })
  }

  async uploadImageOrDocument(options: ImageOrDocumentUploadOptions, accessToken = this.accessToken) {
    this.logger.info(`AuthenticatedClient.uploadImageOrDocument :: uploading to ${options.uploadUrl}`)
    const downloadedMedia = await this.#downloadMedia(options.source)
    this.logger.info(
      `AuthenticatedClient.uploadImageOrDocument :: got blob from source ${downloadedMedia.blob.type} ${downloadedMedia.blob.size}`,
    )

    const uploadOptions = {
      method: 'PUT',
      headers: {
        'Content-type': 'application/octet-stream',
        'Content-Length': downloadedMedia.size.toString(),
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': this.restliProtocolVersion,
      },
      body: await downloadedMedia.toUint8Array(),
    }
    const uploadResponse = await fetch(options.uploadUrl, uploadOptions)

    this.logger.info(
      `AuthenticatedClient.uploadImageOrDocument :: uploaded ${downloadedMedia.size} bytes -> ${uploadResponse.status}`,
    )

    if (!uploadResponse.ok) {
      const data = await uploadResponse.json()
      this.logger.error(
        `AuthenticatedClient.uploadImageOrDocument :: failed to upload asset ${uploadResponse.status} ${
          JSON.stringify(
            data,
            null,
            2,
          )
        })}`,
      )
      throw new LinkedinAPIError(
        'Failed to upload image or document',
        data,
        uploadResponse.status.toString(),
        'FAILED_IMAGE_OR_DOCUMENT_UPLOAD',
      )
    }

    return true
  }

  async uploadVideo(options: UploadVideoOptions, accessToken = this.accessToken) {
    /**
     * Split the video into 4MB chunks and upload them in parallel (split -b 4194303)
     * https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api?view=li-lms-2023-11&tabs=http#upload-the-video
     * Save ETags
     * Finalize the upload
     * https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api?view=li-lms-2023-11&tabs=http#finalize-video-upload
     */
    const promises = []
    this.logger.info(
      `AuthenticatedClient.uploadVideo :: uploading ${options.videoBlob.size} bytes in ${options.urlArray.length} chunks`,
    )
    for (const { uploadUrl, firstByte, lastByte } of options.urlArray) {
      // If there's more than one chunk, slice the blob (slice is exclusive so we need to add 1 to lastByte or this will fail)
      const chunk = options.urlArray.length > 1 ? options.videoBlob.slice(firstByte, lastByte + 1) : options.videoBlob
      const headers = {
        'Content-type': 'application/octet-stream',
        'Content-Length': chunk.size.toString(),
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': this.restliProtocolVersion,
      }

      const requestOptions = {
        method: 'PUT',
        headers,
        body: new Uint8Array(await chunk.arrayBuffer()),
      }

      this.logger.debug(`AuthenticatedClient.uploadVideo :: uploading ${chunk.size} bytes to ${uploadUrl}`)
      promises.push(fetch(uploadUrl, requestOptions))
    }

    const responses = await Promise.all(promises)
    this.logger.debug(`AuthenticatedClient.uploadVideo :: responses ${JSON.stringify(responses, null, 2)}`)

    // Save ETags
    const ETags = responses.map((res) => res.headers.get('etag')) as string[]
    this.logger.debug(`AuthenticatedClient.uploadVideo :: ETags ${JSON.stringify(ETags, null, 2)}`)
    await delay(this.defaultDelayBetweenRequestsMs) // Linkedin needs a bit of time to process the chunks
    return this.finalizeVideoUpload(
      {
        videoUrn: options.videoUrn,
        uploadToken: options.uploadToken,
        ETags,
      },
      accessToken,
    )
  }

  async finalizeVideoUpload(
    { videoUrn, uploadToken, ETags }: Omit<UploadVideoOptions, 'videoBlob' | 'urlArray'> & { ETags: string[] },
    accessToken = this.accessToken,
    retries = this.retries,
  ): Promise<boolean> {
    const body = JSON.stringify({
      finalizeUploadRequest: {
        uploadToken,
        video: videoUrn,
        uploadedPartIds: ETags,
      },
    })

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': this.restliProtocolVersion,
      },
      body,
    }

    this.logger.debug(`AuthenticatedClient.finalizeVideoUpload :: options ${Deno.inspect(options)}`)
    const response = await fetch(`${LinkedinURLs.assetUrl(LinkedinMediaTypes.VIDEO)}?action=finalizeUpload`, options)

    const data = await response.text()
    this.logger.debug(`AuthenticatedClient.finalizeVideoUpload :: response ${Deno.inspect(data)}`)

    /**
     * There's a tricky thing here because if the video is too long
     * Linkedin will return a 202 accepted and we need to retry
     * because it will still be processing and we can't finalize the upload yet
     *
     * Options like noRetries and retries are there to avoid infinite loops
     * if you want to handle this yourself set noRetries to true
     * and disregard the retries parameter
     */
    if (!response.ok) {
      if (retries === 0 || this.clientOptions.noRetries) {
        throw new LinkedinAPIError(
          'Failed to finalize video upload',
          data,
          response.status.toString(),
          'FAILED_VIDEO_UPLOAD_FINALIZE',
        )
      }

      this.logger.warn(
        `LinkedinClient.finalizeVideoUpload :: failed to finalize video upload, trying again (${retries}/3)`,
      )
      await delay(this.defaultDelayBetweenRequestsMs * retries + 1)
      return this.finalizeVideoUpload({ videoUrn, uploadToken, ETags }, accessToken, retries - 1)
    }

    return true
  }

  async getSelfProfile(accessToken = this.accessToken): Promise<GetSelfProfileResponse> {
    const response = await fetch(LinkedinURLs.getUserProfile, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    this.logger.debug(`AuthenticatedClient.getSelfProfile :: response ${response.status}`)

    if (!response.ok) {
      const data = await response.text()
      this.logger.error(`AuthenticatedClient.getSelfProfile :: failed to get user profile ${response.status} - ${data}`)
      throw new LinkedinAPIError('Failed to get user profile', data, response.status.toString(), 'FAILED_GET_PROFILE')
    }

    return response.json()
  }

  async sharePost(postPayload: LinkedinPostPayload, accessToken = this.accessToken) {
    // Actually share the post here with the media uploads
    const response = await fetch(LinkedinURLs.sharePost, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': this.restliProtocolVersion,
      },
      body: JSON.stringify(postPayload),
    })

    this.logger.debug(`AuthenticatedClient.sharePost :: response ${response.status}`)
    if (!response.ok) {
      const data = await response.json()
      throw new LinkedinAPIError('Failed to share post', data, response.status.toString(), 'FAILED_SHARE_POST')
    }

    const postUrn = response.headers.get('x-restli-id')
    // Sanity check, if the response is ok this will always be true
    if (!postUrn) {
      this.logger.error(`AuthenticatedClient.sharePost :: failed to get post id`)
      throw new LinkedinAPIError('Failed to get post id', {}, response.status.toString(), 'FAILED_POST_ID')
    }

    this.logger.info(`AuthenticatedClient.sharePost :: post ${postUrn} shared`)
    return { postUrn, postUrl: `https://www.linkedin.com/feed/update/${postUrn}`, payload: postPayload }
  }

  async postComment(
    { postUrn, comment, authorUrn }: { postUrn: string; comment: string; authorUrn: string },
    accessToken = this.accessToken,
    retries = this.retries,
  ): Promise<PostCommentResponse> {
    this.logger.info(`LinkedinClient.postComment :: posting comment on ${postUrn}`)

    const response = await fetch(LinkedinURLs.postComment(postUrn), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': this.apiVersion,
      },
      body: JSON.stringify({
        actor: authorUrn,
        object: postUrn,
        message: {
          text: comment,
        },
      }),
    })

    if (response.status === 404 && !this.clientOptions.noRetries && retries > 0) {
      this.logger.warn(`AuthenticatedClient.postComment :: post ${postUrn} not found, trying again`)
      await delay(this.defaultDelayBetweenRequestsMs * retries + 1)
      return this.postComment({ postUrn, comment, authorUrn }, accessToken, retries - 1)
    }

    const data = await response.json()

    this.logger.debug(`AuthenticatedClient.postComment :: response ${response.status} => ${Deno.inspect(data)}`)
    if (response.ok) {
      return data
    }

    this.logger.warn(`AuthenticatedClient.postComment :: failed to post comment ${Deno.inspect(data)}`)
    throw new LinkedinAPIError(
      `Failed to post comment to post ${postUrn}`,
      data,
      response.status.toString(),
      'FAILED_POST_COMMENT',
    )
  }

  async getAssetStatus<T extends LinkedinMediaTypes>(
    mediaType: T,
    mediaUrn: string,
  ): Promise<GetAssetStatusResponse<T>> {
    const response = await fetch(LinkedinURLs.assetUrl(mediaType) + `/${mediaUrn}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'LinkedIn-Version': this.apiVersion,
      },
    })

    if (!response.ok) {
      const data = await response.json()
      throw new LinkedinAPIError(
        `Failed to get asset status for ${mediaType} ${mediaUrn}`,
        data,
        response.status.toString(),
        'FAILED_GET_ASSET_STATUS',
      )
    }

    return response.json()
  }
}
