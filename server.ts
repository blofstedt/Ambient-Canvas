import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const getOAuthClient = (redirectUri: string) => {
    return new google.auth.OAuth2(
      process.env.GOOGLE_PHOTOS_CLIENT_ID,
      process.env.GOOGLE_PHOTOS_CLIENT_SECRET,
      redirectUri
    );
  };

  app.get("/api/google-photos/auth-url", (req, res) => {
    const origin = req.query.origin as string;
    if (!origin) {
      return res.status(400).json({ error: "Missing origin parameter" });
    }
    const redirectUri = `${origin}/api/google-photos/callback`;
    const oauth2Client = getOAuthClient(redirectUri);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/photoslibrary.readonly'],
      state: origin // Pass origin in state to use during callback
    });
    res.json({ url: authUrl });
  });

  app.get("/api/google-photos/callback", async (req, res) => {
    const { code, state } = req.query;
    const origin = state as string;

    if (!origin || !code) {
       return res.status(400).send("Missing code or state");
    }

    try {
      const redirectUri = `${origin}/api/google-photos/callback`;
      const oauth2Client = getOAuthClient(redirectUri);
      
      const { tokens } = await oauth2Client.getToken(code as string);
      // Here you would normally store the tokens safely (e.g., in a session/db)!
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GPHOTOS_AUTH_SUCCESS', token: '${tokens.access_token}' }, '*');
                window.close();
              } else {
                window.location.href = '/?gphotos_connected=true&token=${tokens.access_token}';
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
  });

  app.get("/api/google-photos/albums", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });

    try {
      const response = await fetch("https://photoslibrary.googleapis.com/v1/albums", {
        headers: { Authorization: authHeader }
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google API error: ${response.statusText} - ${errText}\nPlease ensure the "Google Photos Library API" is enabled in your Google Cloud Console for the project associated with your OAuth credentials.`);
      }
      const data = await response.json();
      res.json(data);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/api/google-photos/photos", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });
    
    const albumId = req.query.albumId as string;

    try {
      let body: any = { pageSize: 50 };
      if (albumId) {
        body.albumId = albumId;
      }

      const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
        method: "POST",
        headers: { 
          Authorization: authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google API error: ${response.statusText} - ${errText}\nPlease ensure the "Google Photos Library API" is enabled in your Google Cloud Console for the project associated with your OAuth credentials.`);
      }
      const data = await response.json();
      res.json(data);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
