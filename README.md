# linkedeno

> An attempt to port the LinkedIn API to Deno

## Summary of features

- [x] OAuth2
- [x] Share posts on LinkedIn with images, videos, articles, and documents
- [x] Get user profile information
- [x] Post comments on posts
- [x] Get uploaded media or assets
- [ ] Post comments containing media (images, videos, articles, and documents)
- [ ] Get user's connections
- [ ] Get user's companies
- [ ] Get user's groups
- [ ] Get user's posts
- [ ] Get user's comments
- [ ] Get user's likes
- [ ] Get user's shares

... Some other stuff because this API is super big.

## Usage

> For more usage examples see
> [an example repository](https://github.com/Formacao-Typescript/cloud-socials/blob/main/src/networks/linkedin.ts)

You'll need:

- A LinkedIn Developer account (go to https://developer.linkedin.com/)
- Your Client ID and Secret
- A redirect URL
- A list of scopes

Import the library:

```ts
import { LinkedinClient } from 'https://deno.land/x/linkedin/mod.ts'
```

Create a new client:

```ts
const ln = new LinkedinClient(options)
```

Where `options` is an object with the following interface:

```ts
interface LinkedinClientOptions {
  clientId: string // Your client ID
  clientSecret: string // Your client secret
  oauthCallbackUrl: string // Your redirect URL
  oauthScopes?: string[] // The scopes you want to request if not passed will default to r_emailaddress and r_basicprofile
  customLogger?: typeof logger // A custom logger if you want to, this is an instance of https://deno.land/std@0.212.0/log
  retryAttempts?: number // Number of retry attempts if a request fails (default 3)
  defaultDelayBetweenRequestsMs?: number // Default delay between retry requests in milliseconds (default 500)
  noRetries?: boolean // If true, no retries will be attempted (default false)
  noValidateCSRF?: boolean // If true, no CSRF validation will be performed (default false)
  nonceExpirationMs?: number // The time in milliseconds that a nonce will be valid for (default 60000)
}
```

> **About Retries**: The LinkedIn API sometimes take a while to process images, videos or other data. If this is the
> case, posts cannot be created unless the data is processed. This is a retry mechanism that will retry things like
> uploading videos, posting comments, etc with an exponential backoff of `delay * retry` milliseconds. This is a best
> effort approach and it's not guaranteed to work.

## Logging in

This lib only provides the 3-legged OAuth2 flow. You'll need to implement your own server to handle the callback. The
callback will receive a `code` query parameter that you'll need to pass to the `exchangeLoginToken` method.

```ts
import { InvalidStateError, LinkedinClient } from 'https://deno.land/x/linkedin/mod.ts'
const ln = new LinkedinClient(options) // fill in the options with the callback url
let authenticatedClient = undefined

// This is your server, let's say it's running oak
const app = new Application()

// This is the URL you'll need to redirect the user to
app.get('/oauth/login', (ctx) => {
  const loginObject = ln.loginUrl // this returns an object with a url and a nonce

  ctx.response.headers.set('Location', loginObject.url)
  ctx.response.status = 302
  return
})

// this is the handler for the callback
app.get('/oauth/callback', async (ctx) => {
  const params = ctx.request.url.searchParams

  if (params.has('error')) {
    throw oak.createHttpError(400, 'Error from Linkedin', {
      cause: {
        error: params.get('error'),
        error_description: decodeURIComponent(params.get('error_description')!),
      },
    })
  }

  const code = params.get('code')
  const state = params.get('state')

  if (!code || !state) {
    throw oak.createHttpError(422, 'Missing code or state')
  }

  try {
    authenticatedClient = await ln.exchangeLoginToken(code, state) // you can use this to make requests to the API

    ctx.response.status = 200
    ctx.response.body = {
      status: 'ok',
      message: 'Logged in successfully',
    }
  } catch (err) {
    if (err instanceof InvalidStateError) {
      ctx.response.status = 401
      ctx.response.body = {
        status: 'error',
        message: 'Invalid state',
      }
      return
    }
  }
})
```

### Nonce, state and CSRF

The `loginUrl` method will return an object with a `url` and a `nonce`. The `nonce` is a random string that you'll need
to store in your session. When the user is redirected to the callback URL, you'll need to check that the `state` query
parameter matches the `nonce` you stored in your session. This is to prevent CSRF attacks.

This lib has a built-in simple session manager that will save all generated nonces in memory for a specified amount of
time (defined in the `LinkedinClientOptions` object). The session manager lives in a static property of the
`LinkedinClient` class called `validSessions`, it's a read-only `Set` of strings that contains all the valid nonces that
were generated.

When the `exchangeLoginToken` method is called, it will check that the `state` parameter matches one of the nonces in
the `validSessions` set. If it doesn't, it will throw an `InvalidStateError` error and early return.

You can disable this behavior by setting the `noValidateCSRF` option to `true` in the `LinkedinClientOptions` object. By
doing this, the nonces will no longer be saved, and the `exchangeLoginToken` method will not check the `state` parameter
and will just exchange the code for an access token. **Only do this if you intend to implement your own nonce validation
mechanism.**

## Token handling

The exchange method will return an authenticated client that you can use to make requests to the API. This client
contains all the methods you need to make requests to the API (at least the available ones).

It will store both the access token and the refresh token in memory. You can access them through the `accessToken` and
`refreshToken` properties. These accessors will make checks to see if the tokens are expired but won't refresh them
automatically. You can use the `refreshAccessToken` method to refresh all the tokens.

In case one of the tokens is expired or not present, the lib will throw an error. You can catch this error and call
`refreshAccessToken` to refresh the tokens and retry the request, except if the refresh token itself is expired, in this
case you need to log in again since there's no way to refresh the refresh token.

### Managing tokens yourself

If your application is a server application, you can store the tokens in a database and retrieve them when needed (which
is recommended since tokens can outlive your application and you don't want people to keep relogging). You just need to
pass on the `accessToken` property to any of the methods that make requests to the API, when this is done, the lib will
use the token you passed instead of the one stored in memory.

```ts
const ln = new LinkedinClient(options)
// ... you performed authentication here
const authClient = await ln.exchangeLoginToken(code, state)
authClient.accessToken // this is the access token
authClient.refreshToken // this is the refresh token
authClient.accessTokenExpiresIn // this is the time in seconds until the access token expires
authClient.accessTokenExpirationDate // this is the date when the access token expires
authClient.refreshTokenExpiresIn // this is the time in seconds until the refresh token expires
authClient.refreshTokenExpirationDate // this is the date when the refresh token expires
```

You can also use the setters both for the `accessToken` and `refreshToken` properties to set the tokens manually this
way you don't need to pass on the property all the time.

```ts
authClient.accessToken = 'my access token'
authClient.sharePost(thePost) // this will use the access token you set
authClient.sharePost(thePost, 'my access token') // this will also work
```

## Available APIs

Please look at the documentation [on the Deno website](https://doc.deno.land/https/deno.land/x/linkedin/mod.ts) for
