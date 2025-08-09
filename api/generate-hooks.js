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
    platform = "tiktok", niche = "", theme = "", tone = "intrigant",
    brief = "", priorityCategories = [], count = 10,
    // --- AJOUT: Récupération du mode Putaclic ---
    putaclic = false
  } = body;

  const safeCount = Math.min(Math.max(parseInt(count || 10, 10), 1), 25);
  const catsAll = ["question","negatif","controverse","promesse","chiffres","experience","surprenant","suspense","fomo"];
  const picked = Array.isArray(priorityCategories) ? priorityCategories.filter(c => catsAll.includes(c)) : [];

  const platformGuide = {
    tiktok: "Style très cut et émotionnel. Accroche immédiate <2s. Phrases courtes (<=10-12 mots).",
    reels: "Style partageable (share/save). Promesse claire, bénéfice concret, ton plus clean.",
    shorts: "Accroche explicite du sujet + curiosité. Bon pour chiffré/how-to. Clarté early."
  }[String(platform).toLowerCase()] || "Style court et clair.";

  const mustInclude = picked.length
    ? `Priorise et inclue des hooks appartenant aux catégories: ${picked.join(", ")}.`
    : "Varie librement les catégories en équilibrant l'ensemble.";
    
  // --- AJOUT: Instructions spécifiques pour le mode Putaclic ---
  const putaclicGuide = putaclic
    ? `\nMODE PUTACLIC ACTIVÉ: L'objectif est le clic à tout prix. Sois excessif, provocateur et utilise des superlatifs extrêmes (choquant, incroyable, interdit, jamais vu). Crée un sentiment d'urgence ou de scandale. Les titres doivent être irrésistibles, quitte à être à la limite de l'éthique. Exagération maximale.`
    : "";

  const system = `Tu es expert des hooks short‑form.
Objectif: produire des hooks à FORTE CHARGE ÉMOTIONNELLE (impact en ≤2s).
Sortie STRICTE: JSON { "hooks": string[] } uniquement.
Langue: français. Longueur: ≤ 12 mots. Interdits: guillemets, hashtags, emojis, point final.
Plateforme ciblée: ${platform} → ${platformGuide}
${putaclicGuide}`; // Injection des instructions putaclic ici

  const user = `Contexte:
Niche: ${niche}
Thème: ${theme}
Ton: ${tone}
Brief libre (optionnel): ${brief || "—"}

${mustInclude}

Génère ${safeCount} hooks variés.`;

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
