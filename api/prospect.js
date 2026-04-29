// LexiSDR Prospect API
// Deploys to Vercel — no coding needed, just follow SETUP.md
// Pulls: Google firm signals via Serper, email via Hunter, AI email via Claude

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
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

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

    // ── Step 3: Generate AI outreach email via Claude ─────────────────────
    let aiEmail = null;
    if (ANTHROPIC_KEY) {
      const signalText = signals.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join("\n");
      const prompt = `You are LexiSDR, an AI SDR for LexisNexis selling legal research and AI tools to law firms.

Write a highly personalized cold outreach email to:
- Name: ${contactName || "Managing Partner"}
- Title: ${contactTitle || "Partner"}
- Firm: ${firmName}
- Practice Area: ${practiceArea || "General Practice"}
- Firm Size: ${firmSize || "Small firm"}
- Location: ${city ? city + ", " + state : state}

Recent signals found about this firm:
${signalText || "Growing practice in " + state}

Rules:
- Subject line referencing something specific and recent
- 3 short paragraphs max — punchy and human, not salesy
- Reference 1-2 signals naturally without sounding like you Googled them
- Value prop: LexisNexis helps them handle growing caseload with AI research tools, saving 8-12 hrs/week
- Soft CTA: 15-minute call, 2 time options
- Sign off as: David Daoud, LexisNexis Strategic Accounts
- Do NOT use buzzwords like "synergy", "leverage", "game-changer"

Return ONLY valid JSON, no markdown, no explanation:
{"subject": "...", "body": "..."}`;

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 900,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const claudeData = await claudeRes.json();
      const rawText = claudeData.content?.find(b => b.type === "text")?.text || "";
      try {
        aiEmail = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      } catch {
        aiEmail = { subject: `Introduction – ${firmName}`, body: rawText };
      }
    }

    // ── Return everything ─────────────────────────────────────────────────
    return res.status(200).json({
      firm: firmName,
      contact: contactName,
      email: email,
      domain: firmDomain,
      signals,
      aiEmail,
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
