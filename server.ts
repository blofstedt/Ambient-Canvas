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
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // -------------------- Google OAuth2 setup --------------------
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`
  );

  // -------------------- API routes (before Vite) --------------------

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Start OAuth flow
  app.get("/auth", (_req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/photoslibrary.readonly']
    });
    res.redirect(url);
  });

  // OAuth callback
  app.get("/auth/callback", async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) throw new Error('Missing authorization code');
      const { tokens } = await oauth2Client.getToken(code as string);
      // In a real app you'd store these tokens safely (database, session, etc.).
      // For now we just set them on the client and move on.
      oauth2Client.setCredentials(tokens);
      // Redirect back to main app – the app will then check auth
      res.redirect('/?auth=success');
    } catch (err) {
      console.error('[OAuth] error:', err);
      res.status(500).send('Authentication failed. Please try again.');
    }
  });

  // Check if user is authenticated (app calls this on load)
  app.get("/api/check-auth", (_req, res) => {
    const hasCredentials = oauth2Client.credentials?.access_token != null;
    if (hasCredentials) {
      res.json({ authenticated: true });
    } else {
      // Send auth URL so the app can redirect the user
      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/photoslibrary.readonly']
      });
      res.status(401).json({ authUrl: url });
    }
  });

  // Fetch photos (placeholder – you need to implement the actual Google Photos API call)
  app.get("/api/photos", async (req, res) => {
    try {
      // Check auth
      if (!oauth2Client.credentials?.access_token) {
        const url = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: ['https://www.googleapis.com/auth/photoslibrary.readonly']
        });
        res.status(401).json({ authUrl: url });
        return;
      }

      // TODO: Replace this with a real call to the Google Photos Library API
      // Example: const photos = await fetchPhotosFromGoogle(oauth2Client);
      const photos: string[] = []; // Placeholder

      res.json({ photos });
    } catch (err) {
      console.error('[Photos] error:', err);
      res.status(500).json({ error: 'Failed to load photos' });
    }
  });

  // -------------------- Vite / static serving --------------------

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
