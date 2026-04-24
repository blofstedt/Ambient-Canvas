export default async function handler(req: any, res: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });

  try {
    const response = await fetch("https://photoslibrary.googleapis.com/v1/albums", {
      headers: { Authorization: authHeader },
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
