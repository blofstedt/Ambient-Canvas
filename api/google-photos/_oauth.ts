import { google } from "googleapis";

export const getOAuthClient = (redirectUri: string) => {
  if (!process.env.GOOGLE_PHOTOS_CLIENT_ID || !process.env.GOOGLE_PHOTOS_CLIENT_SECRET) {
    throw new Error("Missing GOOGLE_PHOTOS_CLIENT_ID/GOOGLE_PHOTOS_CLIENT_SECRET environment variables");
  }

  return new google.auth.OAuth2(
    process.env.GOOGLE_PHOTOS_CLIENT_ID,
    process.env.GOOGLE_PHOTOS_CLIENT_SECRET,
    redirectUri
  );
};

export const resolveRedirectUri = (origin?: string) => {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  if (!origin) throw new Error("Missing origin parameter and GOOGLE_REDIRECT_URI is not set");
  return `${origin}/api/google-photos/callback`;
};

export const getAppOriginFromRedirectUri = (redirectUri: string) => {
  const parsed = new URL(redirectUri);
  return `${parsed.protocol}//${parsed.host}`;
};
