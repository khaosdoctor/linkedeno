# deno-linkedin

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

You'll need:

- A LinkedIn Developer account (go to https://developer.linkedin.com/)
- Your Client ID and Secret
- A redirect URL
- A list of scopes

Import the library:

```ts
import { LinkedinClient } from "https://deno.land/x/linkedin/mod.ts";
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
}
```

> **About Retries**: The LinkedIn API sometimes take a while to process images, videos or other data. If this is the case, posts cannot be created unless the data is processed. This is a retry mechanism that will retry things like uploading videos, posting comments, etc with an exponential backoff of `delay * retry` milliseconds. This is a best effort approach and it's not guaranteed to work.

## Logging in

This lib only provides the 3-legged OAuth2 flow. You'll need to implement your own server to handle the callback. The callback will receive a `code` query parameter that you'll need to pass to the `exchangeLoginToken` method.

```ts
import { LinkedinClient } from "https://deno.land/x/linkedin/mod.ts";
const ln = new LinkedinClient(options) // fill in the options with the callback url
let authenticatedClient = undefined

// This is your server, let's say it's running oak
const app = new Application();

let nonce = undefined // this nonce will be used to validate the callback
// This is the URL you'll need to redirect the user to
app.get('/oauth/login', (ctx) => {
	const loginObject = ln.loginUrl // this returns an object with a url and a nonce
  nonce = loginObject.nonce

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

	const csrfMatch = state === nonce
	if (!csrfMatch) {
		throw oak.createHttpError(401, 'Invalid state')
	}

	authenticatedClient = await ln.exchangeLoginToken(code) // you can use this to make requests to the API

	ctx.response.status = 200
	ctx.response.body = {
		status: 'ok',
		message: 'Logged in successfully',
	}
})
```

> **About CSRF**: The nonce is used to prevent CSRF attacks. You should generate a random nonce and store it in the session. When the callback is called, you should compare the nonce with the one you stored in the session. If they match, then the request is valid. In this case, I'm not saving anything anywhere, but you should set up a session store and save the nonce there. The lib will take care of generating a random nonce for you at every call to `loginUrl`.

## Making requests

### Token handling

The exchange method will return an authenticated client that you can use to make requests to the API. This client contains all the methods you need to make requests to the API (at least the available ones).

It will store both the access token and the refresh token in memory. You can access them through the `accessToken` and `refreshToken` properties. These accessors will make checks to see if the tokens are expired but won't refresh them automatically. You can use the `refreshAccessToken` method to refresh all the tokens.

In case one of the tokens is expired or not present, the lib will throw an error. You can catch this error and call `refreshAccessToken` to refresh the tokens and retry the request, except if the refresh token itself is expired, in this case you need to log in again since there's no way to refresh the refresh token.
