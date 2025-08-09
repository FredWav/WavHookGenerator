export const config = { runtime: "edge" };

function json(res, status = 200) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  return new Response(JSON.stringify(res), { status, headers });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const body = await req.json().catch(() => ({}));
  const {
    platform = "tiktok", niche = "", theme = "", tone = "intrigant", audience = "",
    brief = "", intensity = "normal", priorityCategories = [], count = 10
  } = body;

  const safeCount = Math.min(Math.max(parseInt(count || 10, 10), 1), 25);
  const catsAll = ["question","negatif","controverse","promesse","chiffres","experience","surprenant","suspense","fomo"];
  const picked = Array.isArray(priorityCategories) ? priorityCategories.filter(c => catsAll.includes(c)) : [];

  const emotionGuide = {
    leger: "Emotion légère, bienveillante. Curiosité douce, humour léger.",
    normal: "Emotion nette, pattern‑interrupt assumé. Curiosité/FOMO/urgence équilibrées.",
    agressif: "Emotion forte: FOMO, urgence, controverse. Formulations tranchées mais non offensantes."
  }[String(intensity).toLowerCase()] || "Emotion nette, pattern‑interrupt assumé.";

  const platformGuide = {
    tiktok: "Style très cut et émotionnel. Accroche immédiate <2s. Phrases courtes (<=10-12 mots). FOMO/contraste assumés. Lexique direct.",
    reels: "Style share/save-friendly. Promesse claire, bénéfice concret, ton plus clean. Toujours court mais moins haché que TikTok.",
    shorts: "Accroche explicite du sujet + curiosité. Bon pour chiffré/how-to/teaser. Clarté early. Hook court requis."
  }[String(platform).toLowerCase()] || "Style court et clair.";

  const mustInclude = picked.length
    ? `Priorise et inclue des hooks appartenant aux catégories: ${picked.join(", ")}.`
    : "Varie librement les catégories en équilibrant l'ensemble.";

  const system = `Tu es expert des hooks short‑form.
Objectif: produire des hooks à FORTE CHARGE EMOTIONNELLE (≤2s d'impact).
Sortie STRICTE: JSON { "hooks": string[] } uniquement.
Langue: français. Longueur: ≤ 12 mots. Interdits: guillemets, hashtags, emojis, point final.
Catégories autorisées: question, negatif, controverse, promesse, chiffres, experience, surprenant, suspense, fomo.
Plateforme ciblée: ${platform} → ${platformGuide}
Consigne émotion: ${emotionGuide}
Rappels: clarté > style, un concept fort par hook, spécifique à la niche et au thème, pattern‑interrupt au début.`;

  const user = `Contexte:
Niche: ${niche}
Thème: ${theme}
Ton: ${tone}
Audience (optionnel): ${audience || "—"}
Brief libre (optionnel): ${brief || "—"}

Catégories prioritaires (optionnel): ${picked.length ? picked.join(", ") : "—"}
${mustInclude}

Contraintes supplémentaires:
- Génère ${safeCount} hooks variés.
- Inclure au moins: 1 hook FOMO, 1 hook contrarien/controversé, 1 hook chiffré.
- Adapte la formulation au ton, à l’intensité et à la plateforme.
`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
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
