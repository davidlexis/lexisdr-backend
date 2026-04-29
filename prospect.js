// LexiSDR Prospect API
// Deploys to Vercel — no coding needed, just follow SETUP.md
// Pulls: Google firm signals via Serper, email via Hunter
// NOTE: AI email writing happens in the frontend via Claude Pro — no Anthropic key needed here

export default async function handler(req, res) {
  // Allow your LexiSDR frontend to call this
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { firmName, contactName, contactTitle, practiceArea, state, city, firmSize } = req.body;

  if (!firmName) return res.status(400).json({ error: "firmName is required" });

  const SERPER_KEY = process.env.SERPER_API_KEY;
  const HUNTER_KEY = process.env.HUNTER_API_KEY;
  // No Anthropic key needed — email generation runs in the frontend via Claude Pro

  try {
    // ── Step 1: Pull firm signals from Google via Serper ──────────────────
    let signals = [];
    let firmDomain = null;

    if (SERPER_KEY) {
      const serperRes = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": SERPER_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          q: `"${firmName}" ${state} law firm recent news verdict hire 2024 2025`,
          num: 8,
          gl: "us",
          hl: "en"
        })
      });
      const serperData = await serperRes.json();

      // Extract signals from organic results
      const organic = serperData.organic || [];
      signals = organic.slice(0, 5).map(r => {
        const snippet = r.snippet || r.title || "";
        return snippet.length > 120 ? snippet.slice(0, 117) + "…" : snippet;
      }).filter(Boolean);

      // Try to extract firm domain from results
      const domainMatch = organic.find(r => r.link && (
        r.link.toLowerCase().includes(firmName.toLowerCase().split(" ")[0]) ||
        r.link.includes("law") || r.link.includes("legal")
      ));
      if (domainMatch?.link) {
        try { firmDomain = new URL(domainMatch.link).hostname.replace("www.", ""); } catch {}
      }
    } else {
      signals = [`${firmName} — ${practiceArea} practice in ${city || state}`, "Signal data unavailable (add SERPER_API_KEY)"];
    }

    // ── Step 2: Find attorney email via Hunter ────────────────────────────
    let email = null;
    if (HUNTER_KEY && firmDomain && contactName) {
      const nameParts = contactName.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      const hunterUrl = `https://api.hunter.io/v2/email-finder?domain=${firmDomain}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${HUNTER_KEY}`;
      const hunterRes = await fetch(hunterUrl);
      const hunterData = await hunterRes.json();
      email = hunterData?.data?.email || null;
    }

    // ── Return everything — email generation happens in the frontend ─────
    return res.status(200).json({
      firm: firmName,
      contact: contactName,
      email: email,
      domain: firmDomain,
      signals,
      score: computeScore(signals, practiceArea, firmSize),
    });

  } catch (err) {
    console.error("LexiSDR API error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// Simple scoring based on signals and firm profile
function computeScore(signals, practiceArea, firmSize) {
  let score = 60;
  const highValuePractices = ["IP / Patent", "Business / Corporate", "Personal Injury", "Healthcare Law"];
  if (highValuePractices.includes(practiceArea)) score += 10;
  if (firmSize === "4-10") score += 8;
  if (firmSize === "11-50") score += 12;
  // Boost for growth signals
  const growthKeywords = ["hire", "expand", "open", "grow", "new", "verdict", "settle", "award", "partner", "million"];
  signals.forEach(s => {
    if (growthKeywords.some(k => s.toLowerCase().includes(k))) score += 3;
  });
  return Math.min(score, 99);
}
