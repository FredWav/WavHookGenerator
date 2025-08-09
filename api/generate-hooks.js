export const config = { runtime: "edge" };

function json(res, status = 200) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  return new Response(JSON.stringify(res), { status, headers });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const body = await req.json().catch(()=> ({}));
  const {
    niche = "", audience = "créateurs",
    benefit = "doper l’engagement", tone = "intrigant",
    count = 10
  } = body;
  const safeCount = Math.min(Math.max(parseInt(count || 10, 10), 1), 20);

  const system = "Tu es expert des hooks short-form. Retourne UNIQUEMENT un JSON {\"hooks\": string[]} : hooks ultra brefs (<= 12 mots), FR, variés, percutants, adaptés à la niche et au ton. Pas d’intros, pas de commentaires.";
  const user = `Niche: ${niche}
Audience: ${audience}
Bénéfice: ${benefit}
Ton: ${tone}
Nombre: ${safeCount}
Contraintes: style natif TikTok/Instagram, éviter répétitions, éviter jargon, pas de hashtags.`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      return json({ error: "OpenAI error", details: text }, 500);
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = { hooks: [] }; }
    const hooks = Array.isArray(parsed.hooks) ? parsed.hooks.filter(x => typeof x === "string").slice(0, safeCount) : [];
    return json({ hooks });
  } catch (err) {
    return json({ error: "Server error", details: String(err) }, 500);
  }
}
