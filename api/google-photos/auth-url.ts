import { getOAuthClient, resolveRedirectUri } from "./_oauth";

export default function handler(req: any, res: any) {
  try {
    const origin = typeof req.query.origin === "string" ? req.query.origin : undefined;
    const redirectUri = resolveRedirectUri(origin);
    const oauth2Client = getOAuthClient(redirectUri);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/photoslibrary.readonly"],
      state: origin || "",
    });

    res.status(200).json({ url: authUrl });
  } catch (e) {
    const message = (e as Error).message;
    res.status(500).json({ error: message });
  }
}
