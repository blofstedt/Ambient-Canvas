import { getAppOriginFromRedirectUri, getOAuthClient, resolveRedirectUri } from "./_oauth";

export default async function handler(req: any, res: any) {
  const code = req.query?.code;
  if (!code) return res.status(400).send("Missing authorization code");

  try {
    const origin = typeof req.query?.state === "string" && req.query.state.length > 0 ? req.query.state : undefined;
    const redirectUri = resolveRedirectUri(origin);
    const oauth2Client = getOAuthClient(redirectUri);
    const { tokens } = await oauth2Client.getToken(String(code));
    const appOrigin = getAppOriginFromRedirectUri(redirectUri);
    const token = tokens.access_token || "";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GPHOTOS_AUTH_SUCCESS', token: '${token}' }, '${appOrigin}');
              window.close();
            } else {
              window.location.href = '${appOrigin}/?gphotos_connected=true&token=${token}';
            }
          </script>
          <p>Authentication successful. You can close this window now.</p>
        </body>
      </html>
    `);
  } catch (e) {
    console.error(e);
    res.status(500).send("Authentication failed: " + (e as Error).message);
  }
}
