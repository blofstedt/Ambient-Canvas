export default async function handler(req: any, res: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });

  const albumId = typeof req.query?.albumId === "string" ? req.query.albumId : undefined;

  try {
    const body: Record<string, unknown> = { pageSize: 50 };
    if (albumId) body.albumId = albumId;

    const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google API error: ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: (e as Error).message });
  }
}
