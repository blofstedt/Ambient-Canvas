<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c03f1ec2-14f6-4556-bacc-cf9d873f0339

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. (Optional, for Google Photos) configure OAuth env vars in `.env.local`:
   - `GOOGLE_PHOTOS_CLIENT_ID`
   - `GOOGLE_PHOTOS_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` (example: `http://localhost:3000/api/google-photos/callback`)
4. In Google Cloud Console, make sure:
   - OAuth consent screen is in **Testing** and your Google account is listed as a **Test user**
   - **Google Photos Library API** is enabled
   - The OAuth client includes the exact same redirect URI as `GOOGLE_REDIRECT_URI`
   - For Vercel, this is usually `https://<your-project>.vercel.app/api/google-photos/callback`
5. Run the app:
   `npm run dev`
