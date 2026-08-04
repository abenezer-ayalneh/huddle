## Runbook: Restore Google Drive OAuth access blocked by Google app verification

**Owner:** Huddle operator / Google Cloud project owner | **Frequency:** As needed  
**Last Updated:** 2026-08-04 | **Last Run:** Not yet recorded

### Purpose

Resolve Google’s error that the Huddle OAuth app is still being tested and the
Google account is not a developer-approved tester. This runbook covers the
immediate, controlled-testing fix and the separate public-production path for
Huddle’s optional Google Drive recording delivery.

The error is a Google Cloud OAuth consent-screen audience problem. It is not a
Huddle, Docker, LiveKit, MinIO, or Google Drive API outage.

### Choose the correct path

| Need                                                                  | Use                     | Result                                                                             |
| --------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| Connect only the operator’s or a small test group’s Drive account now | **Path A — Testing**    | Add the exact Google accounts to the consent screen’s test-user list.              |
| Let any intended Google account connect Drive                         | **Path B — Production** | Publish the OAuth app and complete brand/scope verification if Google requires it. |

Do not move to Production just to test one account. Test-mode grants expire after
seven days, so do not treat Path A as a durable customer-facing launch.

### Prerequisites

- [ ] Google Cloud project Owner or Editor access to the project that owns the
      OAuth client named by Huddle’s `GOOGLE_CLIENT_ID`.
- [ ] The Huddle production API and `/recordings` page are reachable over HTTPS.
- [ ] The OAuth client has this exact authorized redirect URI:

  ```text
  https://huddle-api.abenezer-ayalneh.dev/storage-connections/google-drive/callback
  ```

- [ ] The Google Drive API is enabled in that same project.
- [ ] For Path B, public HTTPS homepage, privacy-policy, and terms-of-service
      URLs; the `abenezer-ayalneh.dev` domain is verified in Google Search Console
      by a Google Cloud project Owner or Editor.
- [ ] For verification, access to a non-production Huddle test account that a
      Google reviewer can use, plus a short English demo video of the complete Drive
      authorization flow.

### Resolve the homepage ownership finding before resubmitting

Google has found the public Huddle homepage, but it will not treat page text,
HTTPS, or a DNS record for email delivery as proof that the Google Cloud project
operator owns the domain. The durable fix is a Google Search Console **Domain
property** for the root domain. It covers Huddle and every other subdomain, and
does not require rebuilding the application.

1. In [Google Search Console](https://search.google.com/search-console), use
   the Google account that owns the Huddle Cloud project, or one that can add
   that account as an Owner. Select **Add property** → **Domain**, then enter
   exactly:

   ```text
   abenezer-ayalneh.dev
   ```

   Do not enter `https://` or `huddle.` for this preferred method.

2. Copy the `google-site-verification=...` TXT value shown by Search Console.
   In the authoritative DNS provider, add it without replacing the existing
   Brevo/SPF TXT records:

   | Field   | Value                                                              |
   | ------- | ------------------------------------------------------------------ |
   | Type    | `TXT`                                                              |
   | Name    | `@` (the zone root)                                                |
   | Content | The exact `google-site-verification=...` value from Search Console |
   | TTL     | Auto/default                                                       |

   A TXT record is never proxied. Keep the record after Search Console accepts
   it; removing it revokes the ownership proof.

3. Return to Search Console and select **Verify**. If a different Google
   account performed this step, add the Cloud project account as a **verified
   Owner** in Search Console before continuing.
4. In **Google Auth Platform → Branding**, ensure the authorized domain is
   `abenezer-ayalneh.dev`, then use these exact public URLs:

   ```text
   Homepage: https://huddle.abenezer-ayalneh.dev
   Privacy policy: https://huddle.abenezer-ayalneh.dev/privacy
   Terms of service: https://huddle.abenezer-ayalneh.dev/terms
   ```

   The homepage already identifies Huddle and its operator, describes the
   product, and links to the same public privacy policy and terms pages. The
   Search Console ownership proof is the missing requirement.

5. Respond to the Google verification email to confirm the ownership fix, then
   submit the verification request once. Do not change the homepage domain to a
   different site merely to bypass this finding.

#### Fallback: Search Console URL-prefix meta tag

Use this only when DNS access is temporarily unavailable. In Search Console add
the exact URL-prefix property `https://huddle.abenezer-ayalneh.dev/`, choose the
HTML tag method, and set the issued token in the production `.env.prod`:

```dotenv
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=the-token-value-only
```

The Docker build forwards this public token into Huddle's root metadata as
`<meta name="google-site-verification" ...>`. Rebuild the web image, then verify
that the tag is visible before clicking Search Console's Verify button:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --build --no-deps web
curl -fsSL https://huddle.abenezer-ayalneh.dev | rg 'google-site-verification'
```

This fallback verifies only the submitted Huddle URL prefix. Replace it with
the root-domain DNS method when DNS access is available.

### Procedure

#### Step 1: Confirm the active Google project and client

On the production VPS, verify the configured values without displaying the
secret:

```bash
rg -n '^(GOOGLE_CLIENT_ID|GOOGLE_DRIVE_REDIRECT_URI)=' .env.prod
```

In [Google Cloud Console](https://console.cloud.google.com/), select the project
that owns this `GOOGLE_CLIENT_ID`. Go to **Google Auth Platform → Clients**, open
the Web application client, and confirm the Drive redirect URI exactly matches
the value above. Also go to **APIs & Services → Enabled APIs & services** and
confirm **Google Drive API** is enabled.

**Expected result:** The client ID, project, API, and exact redirect URI all
belong together.

**If it fails:** Correct the OAuth client or `.env.prod` first. If the redirect
URI changes, recreate `api` and `recording-worker` after the change using the
command in Step 5; an allowlist or consent-screen-only change does not require a
Huddle restart.

#### Step 2: Use Path A — add approved test users

In Google Cloud Console, open **Google Auth Platform → Audience**. Confirm the
app’s publishing status is **Testing**, then add the full Google email address
of every person who must test Drive delivery under **Test users**. Save the
change.

For the current error, add the Google account that you selected on the blocked
Google page. A Workspace alias can differ from the underlying Google account, so
add the exact account shown by Google.

**Expected result:** The account appears in the Test users list. Google may show
an unverified-app warning to that approved tester, but it must allow the consent
flow to continue.

**If it fails:** Ensure the OAuth client is in the same project as the Audience
configuration and that the account is not restricted by a Workspace administrator.
Testing is limited to 100 listed users; remove only obsolete testers if that cap
is reached.

#### Step 3: Complete the controlled test

1. In Huddle, sign in as the intended Host and open `/recordings`.
2. Select **Connect Drive** and choose the allowlisted account.
3. Accept the `drive.file` request. Do not request, add, or approve a broader
   Drive scope as a workaround.
4. Confirm the browser returns to `/recordings` and shows the connected Drive
   account.
5. Complete one real Egress recording and confirm the worker delivers it to the
   private `Huddle Recordings` folder.

**Expected result:** Huddle stores an encrypted offline refresh token and a
future completed recording becomes `queued`, then `uploading`, then `delivered`.

**If it fails:** Start a new Connect Drive attempt—Huddle’s OAuth state is
single-use and expires after 10 minutes. Use the troubleshooting table for a
redirect mismatch, expired grant, or delivery failure.

#### Step 4: Use Path B — prepare public production access

Use this path only when non-test users should be able to connect Drive.

1. In **Google Auth Platform → Branding**, complete the app name, user-support
   email, developer-contact email, public homepage, privacy-policy URL, and
   terms-of-service URL. Ensure the privacy policy explains that Huddle requests
   `drive.file` solely to create, upload, verify, and share the recordings it
   manages.
2. In **Google Auth Platform → Data Access**, retain only the scope Huddle
   actually requests:

   ```text
   https://www.googleapis.com/auth/drive.file
   ```

   Record the scope classification the Console displays. Do not add
   `drive`, `drive.readonly`, or metadata scopes to bypass review.

3. In **Google Auth Platform → Audience**, set the intended user type and change
   publishing status from **Testing** to **In production** when the branding and
   data-access configuration is ready.
4. If the Console says verification is required, submit the request from the
   consent-screen configuration. Provide the exact scope justification, the
   public policy links, proof of domain ownership, and the English demo video.
   Give Google a test Huddle account and step-by-step instructions to sign in,
   open `/recordings`, press Connect Drive, approve consent, and observe the
   private delivery flow.
5. Respond to Google’s verification email promptly. Keep the project in the
   requested configuration while review is in progress; changing branding,
   redirect URLs, or sensitive/restricted scopes can require re-verification.

**Expected result:** Google Auth Platform reports **In production**. If the
configured scope requires review, its verification request is submitted or
approved; do not claim public Drive availability until Google completes the
required review.

**If it fails:** Keep the app in Testing and use Path A for permitted testers.
Fix the exact finding from Google rather than changing scopes or publishing a
different unreviewed client in production.

#### Step 5: Reload Huddle only when its OAuth environment changes

No Huddle restart is needed after adding test users, changing publishing status,
or submitting verification—those are Google-side changes. Restart only after
changing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or
`GOOGLE_DRIVE_REDIRECT_URI` in `.env.prod`:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --no-deps --force-recreate api recording-worker
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod logs --tail=100 api recording-worker
```

**Expected result:** Both services restart cleanly with the new environment.

**If it fails:** Keep `recording-worker` stopped if it crash-loops; do not rotate
`CLOUD_CREDENTIALS_ENCRYPTION_KEY` after any Drive connection exists because
stored refresh tokens would no longer decrypt.

### Verification

- [ ] The blocked Google account is in the Testing app’s Test users list, or the
      app is published to Production for its intended audience.
- [ ] The Drive redirect URI exactly matches the OAuth client and `.env.prod`.
- [ ] The consent screen shows only the intended `drive.file` access.
- [ ] Huddle returns to `/recordings` with the right connected account.
- [ ] A real completed recording reaches the private `Huddle Recordings` folder
      and Huddle shows `delivered`.
- [ ] If still Testing, the owner records the reauthorization date before the
      seven-day test grant expires.

### Troubleshooting

| Symptom                                                           | Likely cause                                                                      | Fix                                                                                                                                                             |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Access blocked… app is currently being tested”                   | Account is not a listed test user                                                 | Add that exact Google account under Google Auth Platform → Audience → Test users, then start a fresh Connect Drive attempt.                                     |
| `redirect_uri_mismatch`                                           | OAuth client URI and `GOOGLE_DRIVE_REDIRECT_URI` differ                           | Copy the production callback URI exactly into both places; recreate API and worker only after changing `.env.prod`.                                             |
| Consent works, but reauthorization is required about a week later | Testing-mode grants expire after seven days                                       | Expected in Path A. Move through Path B before relying on Drive delivery for durable production use.                                                            |
| “This app isn’t verified” warning for an approved tester          | App remains in Testing                                                            | Expected for a test user. Do not tell non-test users to bypass the warning; complete Path B for public access.                                                  |
| Google rejects the verification request                           | Missing policy/terms, domain ownership, scope justification, or test instructions | Respond to Google’s stated finding with the requested public URLs, Search Console verification, minimal-scope explanation, demo video, and usable test account. |
| `Google Drive authorization failed` after consent                 | Bad client secret, redirect URI, or callback state expired                        | Verify the secret/URI in the same project; begin Connect Drive again because Huddle’s state expires after 10 minutes.                                           |
| Delivery becomes `action_required` later                          | Token revoked, quota exceeded, or Workspace policy blocks Drive                   | Have the Host reconnect Drive; resolve quota or policy with the Workspace administrator. Local retention still runs.                                            |

### Rollback

- To stop accepting new Drive connections, keep the OAuth app in Testing and
  remove the affected test user, or disable the OAuth client in Google Cloud.
  This does not revoke Huddle’s already stored refresh token or delete Drive
  files.
- To stop Huddle’s future Drive delivery immediately, stop the worker:

  ```bash
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
    --env-file .env.prod stop recording-worker
  ```

  This also pauses local-retention cleanup; it does not delete metadata or Drive
  files.

- Do not rotate `CLOUD_CREDENTIALS_ENCRYPTION_KEY` as a rollback action. To
  disconnect a Host safely, use the Disconnect Drive control on `/recordings`.

### Escalation

| Situation                                                           | Contact                                          | Method                                                                                                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cannot edit Audience, Branding, Data Access, or Clients             | Google Cloud project Owner                       | Grant the least Google Cloud role needed or perform the configuration together.                                                                                 |
| Workspace user cannot authorize despite being a test user           | Workspace administrator                          | Review third-party app access controls for the client ID and requested `drive.file` scope.                                                                      |
| Google requests more verification evidence                          | Huddle operator / Google OAuth Verification team | Reply to Google’s verification email with the requested evidence; never include production passwords, refresh tokens, client secrets, or resumable-upload URLs. |
| Recording delivery must be paused to prevent retention side effects | Huddle infrastructure owner                      | Stop `recording-worker`, preserve logs, and follow the recording-retention runbook.                                                                             |

### References

- [Google: Manage app audience](https://support.google.com/cloud/answer/15549945)
- [Google: Submit an OAuth app for verification](https://support.google.com/cloud/answer/13461325)
- [Google: OAuth verification requirements](https://support.google.com/cloud/answer/13464321)
- [Google: OAuth scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes)

### History

| Date       | Run By | Notes                                                                |
| ---------- | ------ | -------------------------------------------------------------------- |
| 2026-08-04 | —      | Initial runbook created after a Testing-mode test-user access block. |
