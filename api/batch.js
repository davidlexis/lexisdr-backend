// LexiSDR Batch Prospect API — v2
// Rotates search queries, cities, and offsets to return unique firms every run

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { state, city, practiceArea, firmSize, page = 0, excludeNames = [] } = req.body;
  const SERPER_KEY = process.env.SERPER_API_KEY;
  if (!SERPER_KEY) return res.status(400).json({ error: "SERPER_API_KEY not configured" });

  // City pools per state — rotate through these to get unique results every run
  const STATE_CITIES = {
    "Texas": ["Houston","Dallas","Austin","San Antonio","Fort Worth","El Paso","Arlington","Corpus Christi","Plano","Lubbock","Laredo","Irving","Garland","Frisco","McKinney","Amarillo","Pasadena","Killeen","Mesquite","McAllen","Waco","Carrollton","Midland","Odessa","Beaumont","Round Rock","Richardson","Tyler","Denton","Abilene"],
    "Florida": ["Miami","Orlando","Tampa","Jacksonville","Fort Lauderdale","St. Petersburg","Tallahassee","Naples","Boca Raton","West Palm Beach","Sarasota","Gainesville","Pensacola","Port St. Lucie","Cape Coral","Clearwater","Pompano Beach","Hollywood","Miramar","Lakeland"],
    "California": ["Los Angeles","San Francisco","San Diego","Sacramento","San Jose","Fresno","Long Beach","Oakland","Bakersfield","Anaheim","Santa Ana","Riverside","Stockton","Irvine","Chula Vista","Fremont","San Bernardino","Modesto","Fontana","Santa Clarita"],
    "New York": ["New York City","Buffalo","Rochester","Yonkers","Syracuse","Albany","New Rochelle","White Plains","Utica","Binghamton","Ithaca","Poughkeepsie","Brookhaven","Islip","Hempstead","Huntington","Babylon","Oyster Bay","North Hempstead","Ramapo"],
    "Illinois": ["Chicago","Aurora","Naperville","Joliet","Rockford","Springfield","Elgin","Peoria","Champaign","Waukegan","Cicero","Bloomington","Decatur","Evanston","Schaumburg","Bolingbrook","Palatine","Skokie","Des Plaines","Orland Park"],
    "Georgia": ["Atlanta","Augusta","Columbus","Macon","Savannah","Athens","Sandy Springs","Roswell","Albany","Warner Robins","Alpharetta","Marietta","Smyrna","Gainesville","Valdosta","Peachtree City","Mableton","Columbia","South Fulton","Brookhaven"],
    "Ohio": ["Columbus","Cleveland","Cincinnati","Toledo","Akron","Dayton","Parma","Canton","Youngstown","Lorain","Hamilton","Springfield","Kettering","Elyria","Lakewood","Cuyahoga Falls","Middletown","Euclid","Newark","Mansfield"],
    "Pennsylvania": ["Philadelphia","Pittsburgh","Allentown","Erie","Reading","Scranton","Bethlehem","Lancaster","Harrisburg","York","Wilkes-Barre","Chester","Norristown","State College","Easton","Lebanon","Hazleton","New Castle","McKeesport","Johnstown"],
  };

  // 12 different query templates — rotated by page number for fresh results
  const TEMPLATES = [
    (p, loc, sz) => `${sz} ${p} law firm ${loc}`,
    (p, loc, sz) => `${p} attorney ${loc} reviews`,
    (p, loc, sz) => `${p} lawyers ${loc} contact`,
    (p, loc, sz) => `${p} law office ${loc} LLP LLC PA`,
    (p, loc, sz) => `best ${p} attorneys ${loc} 2024`,
    (p, loc, sz) => `${loc} ${p} bar association lawyers`,
    (p, loc, sz) => `${p} legal services ${loc} firm`,
    (p, loc, sz) => `${p} counsel ${loc} partners`,
    (p, loc, sz) => `"law offices" ${p} ${loc}`,
    (p, loc, sz) => `${p} trial attorney ${loc} verdict`,
    (p, loc, sz) => `${loc} ${p} lawyer directory`,
    (p, loc, sz) => `${p} firm ${loc} associate partner hire`,
  ];

  try {
    const practice = practiceArea === "All Practice Areas" ? "general practice" : practiceArea;
    const sizeHint = firmSize === "1-3" ? "solo small" : firmSize === "4-10" ? "boutique small" : "mid-size regional";

    // Pick cities — shuffle differently each run using page as seed
    const cityPool = city
      ? [city, city] // if city specified, search it with 2 different queries
      : (STATE_CITIES[state] || STATE_CITIES["Texas"])
          .sort(() => Math.random() - 0.5) // randomize each run
          .slice(0, 3); // pick 3 different cities

    // Pick 2 query templates offset by page number
    const t1 = TEMPLATES[(page * 2) % TEMPLATES.length];
    const t2 = TEMPLATES[(page * 2 + 1) % TEMPLATES.length];

    // Build search combos: 2 cities × 2 templates = 4 unique searches per run
    const searches = [];
    for (const c of cityPool.slice(0, 2)) {
      const loc = `${c} ${state}`;
      searches.push({ q: t1(practice, loc, sizeHint), city: c });
      searches.push({ q: t2(practice, loc, sizeHint), city: c });
    }

    // Run all searches in parallel
    let allResults = [];
    const searchPromises = searches.map(async (s) => {
      try {
        const r = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": SERPER_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ q: s.q, num: 10, gl: "us", hl: "en" })
        });
        const d = await r.json();
        return (d.organic || []).map(item => ({ ...item, searchCity: s.city }));
      } catch { return []; }
    });
    const results = await Promise.all(searchPromises);
    allResults = results.flat().sort(() => Math.random() - 0.5); // shuffle for variety

    // Parse firm names from results
    const firmPattern = /([A-Z][a-zA-Z'.-]+(?: (?:&|and) [A-Z][a-zA-Z'.-]+| [A-Z][a-zA-Z'.-]+){0,4}(?:,? (?:LLP|LLC|PA|PC|PLLC|P\.C\.|P\.A\.|Attorneys|Associates|Partners|Group|Law|Legal|Counsel))?)/g;
    const skipWords = new Set(["the","this","our","your","their","all","any","law","legal","attorney","lawyer","google","yelp","avvo","justia","findlaw","martindale","nolo","lawyers","courts","court","judge","state","county","district","supreme","federal"]);
    const excludeSet = new Set((excludeNames || []).map(n => n.toLowerCase().trim()));
    const seenNames = new Set();
    const firms = [];

    for (const result of allResults) {
      const text = `${result.title} ${result.snippet || ""}`;
      const matches = text.match(firmPattern) || [];
      for (const match of matches) {
        const clean = match.trim().replace(/\s+/g, " ");
        const lower = clean.toLowerCase();
        if (
          clean.length < 8 || clean.length > 70 ||
          seenNames.has(lower) ||
          excludeSet.has(lower) ||
          skipWords.has(lower) ||
          !(clean.includes("Law") || clean.includes("LLP") || clean.includes("LLC") ||
            clean.includes(" & ") || clean.includes("Associates") || clean.includes("Partners") ||
            clean.includes("Group") || clean.includes("Legal") || clean.includes("Attorneys") ||
            clean.includes("Counsel") || clean.includes("PA") || clean.includes("PC"))
        ) continue;
        seenNames.add(lower);
        firms.push({ firm: clean, snippet: result.snippet || "", link: result.link || "", city: result.searchCity || city || state });
      }
      if (firms.length >= 20) break;
    }

    // Build lead objects
    const leads = firms.slice(0, 10).map((f, idx) => {
      let domain = null;
      try { domain = new URL(f.link).hostname.replace("www.", ""); } catch {}
      const signals = f.snippet ? [f.snippet.slice(0, 130)] : [];
      const growthWords = ["expand","hire","new","award","verdict","settlement","partner","open","grow","million","win","notable","prominent","leading"];
      let score = 55 + Math.floor(Math.random() * 25);
      growthWords.forEach(w => { if (f.snippet.toLowerCase().includes(w)) score += 3; });
      score = Math.min(score, 97);
      const location = f.city ? `${f.city}, ${state}` : state;
      return {
        id: `${Date.now()}-${idx}-${Math.floor(Math.random()*99999)}`,
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
        city: f.city,
        state,
        isLive: true,
      };
    });

    return res.status(200).json({ leads, page, hasMore: true, total: leads.length });

  } catch (err) {
    console.error("Batch error:", err);
    return res.status(500).json({ error: err.message });
  }
}

function buildHook(firmName, practiceArea, snippet, location) {
  const s = (snippet || "").toLowerCase();
  if (s.includes("verdict") || s.includes("settlement") || s.includes("award")) return `${firmName} has recent courtroom momentum — the right time to amplify their research edge`;
  if (s.includes("expand") || s.includes("grow") || s.includes("new office")) return `${firmName} is in growth mode — scaling research capacity is the hidden bottleneck`;
  if (s.includes("hire") || s.includes("associate") || s.includes("partner")) return `New hires at ${firmName} mean inconsistent research quality — time to standardize`;
  if (s.includes("prominent") || s.includes("notable") || s.includes("leading")) return `${firmName} is a market leader in ${location} — LexisNexis keeps leaders ahead`;
  const hooks = {
    "Personal Injury": `${firmName} is competing in one of the highest-volume PI markets in ${location}`,
    "Immigration": `Immigration filing volume is surging — ${firmName} needs research tools built for this pace`,
    "Estate Planning": `Baby boomer estate demand is peaking in ${location} — ${firmName} is well-positioned`,
    "Business / Corporate": `Deal flow is up in ${location} — ${firmName} can't afford research bottlenecks`,
    "IP / Patent": `AI patent filings are exploding — ${firmName} needs a platform built for it`,
    "Criminal Defense": `Complex criminal defense requires consistent research depth across every matter`,
    "Family Law": `High-conflict family cases in ${location} demand research precision — ${firmName} knows this`,
    "Real Estate": `${location} real estate is booming — ${firmName} needs to move fast on research`,
    "Employment Law": `Employment litigation is surging post-pandemic — ${firmName} needs research at filing speed`,
    "Healthcare Law": `Healthcare regulatory complexity is at an all-time high — ${firmName} can't afford research gaps`,
    "Bankruptcy": `Economic pressure is driving bankruptcy filings up in ${location} — ${firmName} needs volume tools`,
  };
  return hooks[practiceArea] || `${firmName} is an active ${practiceArea || "law"} practice in a growing market`;
}
