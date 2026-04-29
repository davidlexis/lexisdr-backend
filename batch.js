// LexiSDR Batch Prospect API
// POST /api/batch — discover multiple firms from a state/practice area search
// Uses Serper to find actual law firms, then enriches each one

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { state, city, practiceArea, firmSize } = req.body;
  const SERPER_KEY = process.env.SERPER_API_KEY;

  if (!SERPER_KEY) {
    return res.status(400).json({ error: "SERPER_API_KEY not configured" });
  }

  try {
    // ── Build search query to find real firms ─────────────────────────────
    const sizeHint = firmSize === "1-3" ? "solo small" : firmSize === "4-10" ? "boutique" : "mid-size";
    const location = city ? `${city} ${state}` : state;
    const practice = practiceArea === "All Practice Areas" ? "law firm" : `${practiceArea} attorney`;

    const queries = [
      `${sizeHint} ${practice} ${location}`,
      `top ${practice} firms ${location} 2024 2025`,
    ];

    let allResults = [];

    for (const q of queries) {
      const serperRes = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": SERPER_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ q, num: 10, gl: "us" })
      });
      const data = await serperRes.json();
      allResults = allResults.concat(data.organic || []);
    }

    // ── Parse firm names from results ─────────────────────────────────────
    const firmPatterns = [
      /([A-Z][a-z]+(?: & [A-Z][a-z]+| [A-Z][a-z]+)*(?:,? (?:LLP|LLC|PA|PC|PLLC|P\.C\.|P\.A\.))?)/g
    ];

    const seenFirms = new Set();
    const firms = [];

    for (const result of allResults) {
      const text = `${result.title} ${result.snippet || ""}`;
      for (const pattern of firmPatterns) {
        const matches = text.match(pattern) || [];
        for (const match of matches) {
          const clean = match.trim();
          if (
            clean.length > 8 &&
            clean.length < 60 &&
            !seenFirms.has(clean.toLowerCase()) &&
            (clean.includes("Law") || clean.includes("LLP") || clean.includes("LLC") ||
             clean.includes("PA") || clean.includes("PC") || clean.includes(" & ") ||
             clean.includes("Associates") || clean.includes("Partners") || clean.includes("Group"))
          ) {
            seenFirms.add(clean.toLowerCase());
            firms.push({
              firm: clean,
              snippet: result.snippet || "",
              link: result.link || "",
              source: result.title || "",
            });
          }
        }
      }
      if (firms.length >= 12) break;
    }

    // ── Build structured lead objects ─────────────────────────────────────
    const leads = firms.slice(0, 8).map((f, idx) => {
      let domain = null;
      try { domain = new URL(f.link).hostname.replace("www.", ""); } catch {}

      // Extract signals from snippet
      const signals = [];
      if (f.snippet) signals.push(f.snippet.slice(0, 120));

      // Score based on snippet keywords
      const growthWords = ["expand", "hire", "new", "award", "verdict", "settlement", "partner", "open", "grow", "million"];
      let score = 62 + Math.floor(Math.random() * 18);
      growthWords.forEach(w => { if (f.snippet.toLowerCase().includes(w)) score += 4; });
      score = Math.min(score, 97);

      return {
        id: Date.now() + idx,
        firm: f.firm,
        contact: "Managing Partner",
        title: "Managing Partner",
        email: domain ? `info@${domain}` : null,
        practice: practiceArea === "All Practice Areas" ? "General Practice" : practiceArea,
        size: firmSize === "1-3" ? "2–3 attorneys" : firmSize === "4-10" ? "5–8 attorneys" : "15–35 attorneys",
        score,
        status: score >= 80 ? "READY" : "RESEARCHING",
        stage: score >= 85 ? 2 : 1,
        signals,
        hook: buildHook(f.firm, practiceArea, f.snippet, location),
        domain,
        sourceUrl: f.link,
        isLive: true,
      };
    });

    return res.status(200).json({ leads, query: { state, city, practiceArea, firmSize }, total: leads.length });

  } catch (err) {
    console.error("Batch error:", err);
    return res.status(500).json({ error: err.message });
  }
}

function buildHook(firmName, practiceArea, snippet, location) {
  const snippetLower = (snippet || "").toLowerCase();
  if (snippetLower.includes("verdict") || snippetLower.includes("settlement") || snippetLower.includes("award")) {
    return `${firmName} has recent courtroom momentum — the right time to amplify their research edge`;
  }
  if (snippetLower.includes("expand") || snippetLower.includes("grow") || snippetLower.includes("new office")) {
    return `${firmName} is in growth mode — scaling research capacity is the hidden bottleneck`;
  }
  if (snippetLower.includes("hire") || snippetLower.includes("partner") || snippetLower.includes("associate")) {
    return `New hires at ${firmName} mean inconsistent research quality — now is the time to standardize`;
  }
  const areaHooks = {
    "Personal Injury": `${firmName} is competing in one of the highest-volume PI markets in ${location}`,
    "Immigration": `Immigration volume is surging — ${firmName} needs research tools built for this pace`,
    "Estate Planning": `Baby boomer estate demand is peaking in ${location} — ${firmName} is well-positioned`,
    "Business / Corporate": `Deal flow is up in ${location} — ${firmName} can't afford research bottlenecks`,
    "IP / Patent": `AI patent filings are exploding — ${firmName} needs a research platform built for it`,
    "Criminal Defense": `Complex criminal defense requires consistent research depth across every matter`,
  };
  return areaHooks[practiceArea] || `${firmName} is an active ${practiceArea} practice in a growing market`;
}
