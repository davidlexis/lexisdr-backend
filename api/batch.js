// LexiSDR Batch Prospect API — v3
// Searches Avvo, Justia, and FindLaw directly to extract REAL firm names

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { state, city, practiceArea, firmSize, page = 0, excludeNames = [] } = req.body;
  const SERPER_KEY = process.env.SERPER_API_KEY;
  if (!SERPER_KEY) return res.status(400).json({ error: "SERPER_API_KEY not configured" });

  const STATE_CITIES = {
    "Texas": ["Houston","Dallas","Austin","San Antonio","Fort Worth","El Paso","Plano","Arlington","Lubbock","Corpus Christi","Laredo","Irving","Garland","Frisco","McKinney","Amarillo","Pasadena","Killeen","Mesquite","McAllen","Waco","Carrollton","Midland","Odessa","Beaumont","Round Rock","Richardson","Tyler","Denton","Abilene","Wichita Falls","League City","Pearland","Sugar Land","Edinburg","College Station","Lewisville","Longview","Brownsville"],
    "Florida": ["Miami","Orlando","Tampa","Jacksonville","Fort Lauderdale","St. Petersburg","Tallahassee","Naples","Boca Raton","West Palm Beach","Sarasota","Gainesville","Pensacola","Port St. Lucie","Cape Coral","Clearwater","Pompano Beach","Hollywood","Miramar","Lakeland","Daytona Beach","Ocala","Fort Myers","Palm Bay","Melbourne"],
    "California": ["Los Angeles","San Francisco","San Diego","Sacramento","San Jose","Fresno","Long Beach","Oakland","Bakersfield","Anaheim","Santa Ana","Riverside","Stockton","Irvine","Chula Vista","Fremont","San Bernardino","Modesto","Fontana","Santa Clarita","Garden Grove","Huntington Beach","Glendale","Moreno Valley","Santa Rosa"],
    "New York": ["New York City","Buffalo","Rochester","Yonkers","Syracuse","Albany","White Plains","Utica","Binghamton","Ithaca","Poughkeepsie","Brooklyn","Queens","Bronx","Staten Island","Long Island City","Garden City","Mineola","Hauppauge"],
    "Illinois": ["Chicago","Aurora","Naperville","Joliet","Rockford","Springfield","Elgin","Peoria","Champaign","Waukegan","Bloomington","Decatur","Evanston","Schaumburg","Bolingbrook","Palatine","Skokie","Des Plaines","Orland Park","Tinley Park"],
    "Georgia": ["Atlanta","Augusta","Columbus","Macon","Savannah","Athens","Sandy Springs","Roswell","Albany","Warner Robins","Alpharetta","Marietta","Smyrna","Gainesville","Valdosta","Peachtree City","Brookhaven","Johns Creek"],
    "Ohio": ["Columbus","Cleveland","Cincinnati","Toledo","Akron","Dayton","Parma","Canton","Youngstown","Lorain","Hamilton","Springfield","Kettering","Elyria","Lakewood","Cuyahoga Falls","Middletown","Euclid"],
    "Pennsylvania": ["Philadelphia","Pittsburgh","Allentown","Erie","Reading","Scranton","Bethlehem","Lancaster","Harrisburg","York","Wilkes-Barre","Chester","Norristown","State College"],
    "Virginia": ["Virginia Beach","Norfolk","Chesapeake","Richmond","Newport News","Alexandria","Hampton","Roanoke","Portsmouth","Suffolk","Lynchburg","Harrisonburg"],
    "Washington": ["Seattle","Spokane","Tacoma","Vancouver","Bellevue","Everett","Renton","Kirkland","Redmond","Bellingham","Kennewick","Yakima"],
    "Michigan": ["Detroit","Grand Rapids","Warren","Sterling Heights","Ann Arbor","Lansing","Flint","Dearborn","Livonia","Troy","Westland","Kalamazoo"],
    "North Carolina": ["Charlotte","Raleigh","Greensboro","Durham","Winston-Salem","Fayetteville","Cary","Wilmington","High Point","Concord","Gastonia","Asheville"],
  };

  // Avvo practice area URL slugs
  const AVVO_PRACTICE = {
    "Personal Injury": "personal-injury",
    "Family Law": "family",
    "Criminal Defense": "criminal-defense",
    "Estate Planning": "estate-planning",
    "Real Estate": "real-estate",
    "Employment Law": "employment-labor",
    "Business / Corporate": "business",
    "Immigration": "immigration",
    "Bankruptcy": "bankruptcy",
    "IP / Patent": "intellectual-property",
    "Healthcare Law": "health-care",
    "All Practice Areas": "general-practice",
  };

  try {
    const practice = practiceArea === "All Practice Areas" ? "general practice" : practiceArea;
    const avvoPractice = AVVO_PRACTICE[practiceArea] || "general-practice";
    const stateSlug = state.toLowerCase().replace(/\s+/g, "-");

    // Pick cities for this run — randomize each time
    const cityPool = city
      ? [city]
      : (STATE_CITIES[state] || STATE_CITIES["Texas"])
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);

    // Strategy: search INSIDE legal directories for firm names
    // This gives us real attorney/firm names not generic page titles
    const searches = [];

    for (const c of cityPool) {
      const citySlug = c.toLowerCase().replace(/\s+/g, "-");
      const cityState = `${c}, ${state}`;

      // Avvo directory search — best source for real firm names
      searches.push(`site:avvo.com/attorneys "${cityState}" "${practice}" -"General Practice Attorneys"`);

      // Justia lawyer directory
      searches.push(`site:lawyers.justia.com "${c}" "${state}" "${practice}" law firm`);

      // Direct firm website search — finds actual law firm sites
      searches.push(`"${practice}" "law firm" OR "attorneys at law" OR "LLP" OR "LLC" "${c}, ${state}" -site:avvo.com -site:justia.com -site:findlaw.com -site:yelp.com`);

      // State bar / Martindale
      searches.push(`site:martindale.com "${c}" "${state}" "${practice}"`);
    }

    // Rotate which searches run based on page number to get variety
    const offset = (page * 2) % Math.max(searches.length, 1);
    const selectedSearches = [
      searches[offset % searches.length],
      searches[(offset + 1) % searches.length],
      searches[(offset + 2) % searches.length],
      searches[(offset + 3) % searches.length],
    ].filter(Boolean);

    // Run searches in parallel
    const searchPromises = selectedSearches.map(async (q) => {
      try {
        const r = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": SERPER_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ q, num: 10, gl: "us", hl: "en" })
        });
        const d = await r.json();
        return d.organic || [];
      } catch { return []; }
    });

    const results = await Promise.all(searchPromises);
    let allResults = results.flat().sort(() => Math.random() - 0.5);

    // ── Extract REAL firm names ────────────────────────────────────────────
    // Pattern specifically for law firm names with legal suffixes
    const firmPattern = /([A-Z][a-zA-Z'-]+(?:(?:\s+(?:&|and)\s+|\s+)[A-Z][a-zA-Z'-]+){0,5})\s*(?:,\s*)?(?:LLP|LLC|PA|PC|PLLC|P\.C\.|P\.A\.|Attorneys at Law|Law Offices?|Law Group|Legal Group)/g;

    // Also match "X Law Firm" and "X & Associates" patterns
    const firmPattern2 = /([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){0,4})\s+(?:Law Firm|Law Office|Legal Services|& Associates|and Associates|Attorneys)/g;

    const excludeSet = new Set((excludeNames || []).map(n => n.toLowerCase().trim()));
    const skipWords = new Set(["find","best","top","free","your","the","our","all","any","this","that","get","law","legal","attorney","lawyer","google","yelp","avvo","justia","findlaw","martindale","nolo","lawyers","courts","court","state","county","district","supreme","federal","general","practice","boutique","solo","small","mid","size","browse","search","directory","listing","reviews","rated","profile"]);
    const seenNames = new Set();
    const firms = [];

    for (const result of allResults) {
      // Skip directory listing pages — we want actual firm pages
      const isDirectory = ["avvo.com/attorneys/","lawyers.justia.com","findlaw.com/lawyer/","martindale.com/find-attorneys","superlawyers.com"].some(d => (result.link||"").includes(d) && !(result.title||"").match(/LLP|LLC|PA|PC|Law Offices?|& Associates/));

      const textsToSearch = [result.title || "", result.snippet || ""];
      // For actual firm websites, the title IS the firm name
      if ((result.link||"").includes(".com") && !isDirectory) {
        const domain = result.link.replace(/https?:\/\/(www\.)?/, "").split("/")[0];
        if (!domain.includes("avvo") && !domain.includes("justia") && !domain.includes("findlaw") && !domain.includes("yelp") && !domain.includes("google")) {
          textsToSearch.push(result.title);
        }
      }

      for (const text of textsToSearch) {
        // Try both patterns
        for (const pattern of [firmPattern, firmPattern2]) {
          pattern.lastIndex = 0;
          let match;
          while ((match = pattern.exec(text)) !== null) {
            const clean = match[0].trim().replace(/\s+/g, " ").replace(/,\s*$/, "");
            const lower = clean.toLowerCase();

            if (
              clean.length < 8 || clean.length > 80 ||
              seenNames.has(lower) ||
              excludeSet.has(lower) ||
              skipWords.has(lower.split(" ")[0]) ||
              lower.includes("general practice attorneys") ||
              lower.includes("top boutique") ||
              lower.includes("best lawyers") ||
              lower.includes("find attorneys") ||
              !clean.match(/[A-Z][a-z]/) // must have proper name casing
            ) continue;

            seenNames.add(lower);
            firms.push({
              firm: clean,
              snippet: result.snippet || "",
              link: result.link || "",
              city: cityPool[0],
            });
          }
        }
      }
      if (firms.length >= 25) break;
    }

    // ── Build lead objects ────────────────────────────────────────────────
    const leads = firms.slice(0, 10).map((f, idx) => {
      let domain = null;
      try {
        const url = new URL(f.link);
        const host = url.hostname.replace("www.", "");
        // Only use as domain if it's actually the firm's site, not a directory
        if (!["avvo.com","justia.com","findlaw.com","yelp.com","martindale.com","superlawyers.com","lawyers.com"].includes(host)) {
          domain = host;
        }
      } catch {}

      const signals = [];
      if (f.snippet && f.snippet.length > 20) signals.push(f.snippet.slice(0, 140));

      const growthWords = ["expand","hire","new","award","verdict","settlement","partner","open","grow","million","win","notable","prominent","leading","established","experienced","successful"];
      let score = 55 + Math.floor(Math.random() * 25);
      growthWords.forEach(w => { if ((f.snippet||"").toLowerCase().includes(w)) score += 3; });
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
        hook: buildHook(f.firm, practiceArea, f.snippet || "", location),
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
  if (s.includes("prominent") || s.includes("notable") || s.includes("leading") || s.includes("established")) return `${firmName} is a recognized practice in ${location} — LexisNexis keeps leaders ahead`;
  const hooks = {
    "Personal Injury": `${firmName} is competing in one of the highest-volume PI markets in ${location}`,
    "Immigration": `Immigration filing volume is surging — ${firmName} needs research tools built for this pace`,
    "Estate Planning": `Baby boomer estate demand is peaking in ${location} — ${firmName} is well-positioned`,
    "Business / Corporate": `Deal flow is up in ${location} — ${firmName} can't afford research bottlenecks`,
    "IP / Patent": `AI patent filings are exploding — ${firmName} needs a platform built for it`,
    "Criminal Defense": `Complex criminal defense requires consistent research depth across every matter`,
    "Family Law": `High-conflict family cases in ${location} demand research precision`,
    "Real Estate": `${location} real estate is booming — ${firmName} needs fast research on title and zoning`,
    "Employment Law": `Employment litigation is surging post-pandemic — ${firmName} needs research at filing speed`,
    "Healthcare Law": `Healthcare regulatory complexity is at an all-time high — ${firmName} can't afford gaps`,
    "Bankruptcy": `Economic pressure is driving bankruptcy filings up in ${location} — ${firmName} needs volume tools`,
  };
  return hooks[practiceArea] || `${firmName} is an active ${practiceArea || "law"} practice in a growing market`;
}
