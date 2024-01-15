export enum LinkedinMediaTypes {
  IMAGE = 'image',
  DOCUMENT = 'document',
  ARTICLE = 'article',
  VIDEO = 'video'
}

/**
 * @enum LinkedinOauthScopes
 * @description List of allowed scopes for Linkedin OAuth2
 * @see https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication#member-authorization-3-legged-oauth-flow
 *
 * @property {string} OPENID - Use your name and photo
 * @property {string} PROFILE - Use your name and photo
 * @property {string} LITE_PROFILE - Use your name and photo
 * @property {string} BASIC_PROFILE - Use your basic profile including your name, photo, headline, and public profile URL
 * @property {string} ADS_RW - Manage your advertising accounts
 * @property {string} ADS_REPORTING_READ - Retrieve reporting for your advertising accounts
 * @property {string} ADS_READ - Retrieve your advertising accounts
 * @property {string} EMAIL_ADDRESS - Use the primary email address associated with your LinkedIn account
 * @property {string} EMAIL - Use the primary email address associated with your LinkedIn account
 * @property {string} SHARING - Create, modify, and delete posts, comments, and reactions on your behalf
 * @property {string} FIRST_DEGREE_CONNECTIONS - Retrieve the number of 1st-degree connections within your network
 * @property {string} ORGANIZATION_SHARE_READ - Retrieve your organization's posts, comments, reactions, and other engagement data
 * @property {string} ORGANIZATION_SHARE_WRITE - Create, modify, and delete posts, comments, and reactions on your organization's behalf
 * @property {string} ORGANIZATION_ADMIN - Manage your organization's pages and retrieve reporting data
 * @property {string} ORGANIZATION_ADMIN_READ - Retrieve your organization's pages and their reporting data (including follower, visitor and content analytics)
 */
export const enum LinkedinOauthScopes {
  OPENID = 'openid',
  PROFILE = 'profile',
  LITE_PROFILE = 'r_liteprofile',
  BASIC_PROFILE = 'r_basicprofile',
  ADS_RW = 'rw_ads',
  ADS_REPORTING_READ = 'r_ads_reporting',
  ADS_READ = 'r_ads',
  EMAIL_ADDRESS = 'r_emailaddress',
  EMAIL = 'email',
  SHARING = 'w_member_social',
  FIRST_DEGREE_CONNECTIONS = 'r_1st_connections_size',
  ORGANIZATION_SHARE_READ = 'r_organization_social',
  ORGANIZATION_SHARE_WRITE = 'w_organization_social',
  ORGANIZATION_ADMIN = 'rw_organization_admin',
  ORGANIZATION_ADMIN_READ = 'r_organization_admin'
}

export type InitializeUploadOptions<T extends LinkedinMediaTypes> = T extends
  | LinkedinMediaTypes.IMAGE
  | LinkedinMediaTypes.DOCUMENT
  ? {
      owner: string
    }
  : T extends LinkedinMediaTypes.VIDEO
  ? {
      owner: string
      fileSizeBytes: number
      uploadCaptions?: boolean
      uploadThumbnail?: boolean
    }
  : never

export type VideoUploadInstructions = {
  uploadUrl: string
  lastByte: number
  firstByte: number
}[]

interface PreferredLocale {
  country: string
  language: string
}

interface LocalizedProperty {
  localized: {
    [countryCode: string]: string
  }
  preferredLocale: PreferredLocale
}

export interface GetSelfProfileResponse {
  localizedLastName: string
  profilePicture: {
    displayImage: string
  }
  firstName: LocalizedProperty
  vanityName: string
  lastName: LocalizedProperty
  localizedHeadline: string
  id: string
  headline: LocalizedProperty
  localizedFirstName: string
}

type LinkedinAdContextType =
  | {
      dscAdAccount?: string
      dscAdType?: 'VIDEO' | 'STANDARD' | 'CAROUSEL' | 'JOB_POSTING' | 'NATIVE_DOCUMENT' | 'EVENT'
      dscName?: string
      dscStatus?: 'ACTIVE' | 'ARCHIVED'
      isDsc: false
    }
  | {
      dscAdAccount: string
      dscAdType: 'VIDEO' | 'STANDARD' | 'CAROUSEL' | 'JOB_POSTING' | 'NATIVE_DOCUMENT' | 'EVENT'
      dscName?: string
      dscStatus: 'ACTIVE' | 'ARCHIVED'
      isDsc: true
    }

export type LinkedinContentType =
  | {
      article: {
        source: string
        title: string
        description?: string
        thumbnail?: string
      }
      media?: never
    }
  | {
      media: {
        id: string
        title: string
      }
      article?: never
    }

interface LinkedinDistributionType {
  feedDistribution: 'NONE' | 'MAIN_FEED'
  targetEntities?: {
    degrees: string[]
    industries: string[]
    locations: string[]
    seniorities: string[]
    jobFunctions: string[]
    fieldsOfStudy: string[]
    interfaceLocales: { country?: string; language: string }[]
    geoLocations: string[]
    schools: string[]
    organizations: string[]
    staffCountRanges:
      | 'SIZE_1'
      | 'SIZE_2_TO_10'
      | 'SIZE_11_TO_50'
      | 'SIZE_51_TO_200'
      | 'SIZE_201_TO_500'
      | 'SIZE_501_TO_1000'
      | 'SIZE_1001_TO_5000'
      | 'SIZE_5001_TO_10000'
      | 'SIZE_10001_OR_MORE'
  }
  thirdPartyDistributionChannels?: string[]
}
/**
 * The payload for the linkedin post
 * @see https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2023-11&tabs=http#post-schema
 */
export interface LinkedinPostPayload {
  author: string
  visibility: 'CONNECTIONS' | 'PUBLIC' | 'LOGGED_IN' | 'CONTAINER'
  adContext?: LinkedinAdContextType
  commentary: string
  container?: string
  content?: LinkedinContentType
  contentLandingPage?: string
  contentCallToActionLabel?:
    | 'APPLY'
    | 'DOWNLOAD'
    | 'VIEW_QUOTE'
    | 'LEARN_MORE'
    | 'SIGN_UP'
    | 'SUBSCRIBE'
    | 'REGISTER'
    | 'JOIN'
    | 'ATTEND'
    | 'REQUEST_DEMO'
    | 'SEE_MORE'
  distribution: LinkedinDistributionType
  isReshareDisabledByAuthor?: boolean
  lifecycleState?: 'PUBLISHED' | 'DRAFT'
}

interface AssetStatusResponseBase {
  owner: string
  id: string
  status: string
}

const enum AssetStatusSuccessCodes {
  SUCCESS = 'SUCCESS',
  WAITING_UPLOAD = 'WAITING_UPLOAD',
  AVAILABLE = 'AVAILABLE',
  PROCESSING = 'PROCESSING'
}

interface AssetStatusResponseError extends AssetStatusResponseBase {
  processingFailureReason?: string
  thumbnail?: string
  status: 'PROCESSING_FAILED'
}

interface AssetStatusSuccess extends AssetStatusResponseBase {
  downloadUrlExpiresAt: number
  downloadUrl: string
  status: keyof typeof AssetStatusSuccessCodes
}

type AssetVideoStatusSuccess =
  | (AssetStatusSuccess & {
      duration: number
      aspectRationWidth: number
      thumbnail?: string
      aspectRationHeight: number
      captions?: string
      status: AssetStatusSuccessCodes.AVAILABLE
    })
  | {
      status: AssetStatusSuccessCodes.PROCESSING | AssetStatusSuccessCodes.WAITING_UPLOAD
    }
export type GetAssetStatusResponse<MediaType extends LinkedinMediaTypes> = MediaType extends
  | LinkedinMediaTypes.IMAGE
  | LinkedinMediaTypes.DOCUMENT
  ? AssetStatusSuccess | AssetStatusResponseError
  : AssetVideoStatusSuccess | AssetStatusResponseError

export interface PostCommentResponse {
  actor: string
  object: string
  agent?: string
  commentUrn?: string
  content?: {
    type: Uppercase<keyof typeof LinkedinMediaTypes>
    entity: {
      [composite: string]: unknown
    }
    url: string
  }
  created?: {
    actor: string
    impersonator: string
    time: number
  }
  id?: string
  lastModified?: {
    actor: string
    impersonator: string
    time: number
  }
  message: {
    attributes?: string[]
    text: string
  }
  likesSummary?: {
    selectedLikes: string[]
    likedByCurrentUser: boolean
    totalLikes: number
  }
  parentComment?: string
}
