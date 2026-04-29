import { useState, useRef, useEffect } from "react";

// ── CONFIGURATION ─────────────────────────────────────────────────────────
// After deploying your backend to Vercel, paste your URL here:
// Example: "https://lexisdr-backend.vercel.app"
const BACKEND_URL = "https://YOUR-VERCEL-URL.vercel.app";

const C = {
  bg: "#0d1117", surface: "#161b22", surfaceHover: "#1c2330", border: "#21262d",
  cyan: "#00d9f5", cyanDim: "#00aec4", green: "#39d353", orange: "#f0883e",
  yellow: "#e3b341", red: "#f85149", purple: "#bc8cff",
  textPrimary: "#e6edf3", textSecondary: "#8b949e", textMuted: "#484f58",
};

const FIRM_SIZES = [
  { label: "1–3 Attorneys", value: "1-3", tag: "Solo & Micro" },
  { label: "4–10 Attorneys", value: "4-10", tag: "Small Firm" },
  { label: "11–50 Attorneys", value: "11-50", tag: "Mid-Size" },
];

const PRACTICE_AREAS = [
  "All Practice Areas","Personal Injury","Family Law","Criminal Defense",
  "Estate Planning","Real Estate","Employment Law","Business / Corporate",
  "Immigration","Bankruptcy","IP / Patent","Healthcare Law",
];

const STATES = [
  "Select State...","Alabama","Alaska","Arizona","Arkansas","California","Colorado",
  "Connecticut","Florida","Georgia","Illinois","Indiana","Iowa","Kansas","Kentucky",
  "Louisiana","Maryland","Massachusetts","Michigan","Minnesota","Missouri","Nevada",
  "New Jersey","New York","North Carolina","Ohio","Oklahoma","Oregon","Pennsylvania",
  "Tennessee","Texas","Virginia","Washington","Wisconsin"
];

// ── Shared Components ──────────────────────────────────────────────────────
function Badge({ children, color, bg }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "2px 7px", borderRadius: 4,
      border: `1px solid ${color || C.cyan}`, color: color || C.cyan, background: bg || "transparent",
      textTransform: "uppercase", whiteSpace: "nowrap", display: "inline-block" }}>
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, subColor }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 100 }}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, color: C.textSecondary, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: subColor || C.cyan, marginTop: 5 }}>{sub}</div>
    </div>
  );
}

function NavItem({ icon, label, active, badge, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 7, cursor: "pointer",
        background: active ? "#1a2840" : hov ? C.surfaceHover : "transparent",
        color: active ? C.cyan : C.textSecondary, fontSize: 12, fontWeight: active ? 600 : 400,
        transition: "all .15s", userSelect: "none", marginBottom: 2 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge ? <span style={{ background: C.cyan, color: "#000", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>{badge}</span> : null}
    </div>
  );
}

function CadenceBar({ stage }) {
  const steps = ["Discovered","Researched","Email Sent","Follow-up #1","Replied","Booked"];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", margin: "10px 0" }}>
      {steps.map((s, i) => (
        <div key={i} style={{ flex: 1, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && <div style={{ flex: 1, height: 2, background: i <= stage ? C.cyan : C.border }} />}
            <div style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
              background: i < stage ? C.cyan : i === stage ? C.yellow : C.border }} />
            {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: i < stage ? C.cyan : C.border }} />}
          </div>
          <div style={{ fontSize: 8, color: i <= stage ? C.textSecondary : C.textMuted, marginTop: 3 }}>{s}</div>
        </div>
      ))}
    </div>
  );
}

// ── Email Panel with Live AI Generation ───────────────────────────────────
function EmailPanel({ lead }) {
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enriched, setEnriched] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { setEmail(null); setEnriched(null); setCopied(false); setError(null); }, [lead?.id]);

  if (!lead) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100%", color: C.textMuted, gap: 10, padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 30 }}>←</div>
        <div style={{ fontSize: 12 }}>Select a lead to view dossier, enrich contact data, and generate a live AI email</div>
      </div>
    );
  }

  async function handleEnrich() {
    setEnriching(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/prospect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firmName: lead.firm,
          contactName: lead.contact,
          contactTitle: lead.title,
          practiceArea: lead.practice,
          state: lead.state || "",
          firmSize: lead.size,
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEnriched(data);
      if (data.aiEmail) setEmail(data.aiEmail);
    } catch (e) {
      setError("Enrichment failed: " + e.message);
    }
    setEnriching(false);
  }

  async function handleGenerateEmail() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/prospect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firmName: lead.firm,
          contactName: lead.contact,
          contactTitle: lead.title,
          practiceArea: lead.practice,
          state: lead.state || "",
          firmSize: lead.size,
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.aiEmail) setEmail(data.aiEmail);
      else throw new Error("No email returned");
    } catch (e) {
      setError("Email generation failed: " + e.message);
    }
    setLoading(false);
  }

  function openGmail() {
    if (!email) return;
    const to = enriched?.email || lead.email || "";
    const url = "https://mail.google.com/mail/?view=cm&fs=1"
      + "&to=" + encodeURIComponent(to)
      + "&su=" + encodeURIComponent(email.subject)
      + "&body=" + encodeURIComponent(email.body);
    window.open(url, "_blank");
  }

  function copyEmail() {
    if (!email) return;
    navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const signals = enriched?.signals || lead.signals || [];
  const displayEmail = enriched?.email || lead.email;

  return (
    <div style={{ padding: 16, overflowY: "auto", height: "100%" }}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{lead.firm}</div>
          {lead.isLive && <Badge color={C.green}>Live Lead</Badge>}
        </div>
        <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>{lead.contact} · {lead.title}</div>
        <div style={{ fontSize: 11, color: C.cyan, marginTop: 2 }}>
          {displayEmail || <span style={{ color: C.textMuted, fontStyle: "italic" }}>Email not found yet</span>}
        </div>
        {enriched?.domain && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>🌐 {enriched.domain}</div>}
        {enriched?.score && <div style={{ fontSize: 11, color: C.orange, marginTop: 4 }}>⚡ Live Score: {enriched.score}</div>}
      </div>

      {/* Firm Intel */}
      <div style={{ background: "#0d1117", border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 9, letterSpacing: 1, color: C.textMuted, textTransform: "uppercase", marginBottom: 8 }}>Firm Intelligence</div>
        {[["Practice", lead.practice], ["Size", lead.size], ["Status", lead.status]].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase" }}>{k}</span>
            <span style={{ fontSize: 11, color: C.textPrimary, fontWeight: 500 }}>{v}</span>
          </div>
        ))}
        <div style={{ fontSize: 9, letterSpacing: 1, color: C.textMuted, textTransform: "uppercase", margin: "10px 0 6px" }}>
          Intent Signals {enriched && <span style={{ color: C.green }}>· LIVE</span>}
        </div>
        {signals.length > 0 ? signals.map((s, i) => (
          <div key={i} style={{ fontSize: 11, color: C.textSecondary, marginBottom: 4, display: "flex", gap: 5, lineHeight: 1.5 }}>
            <span style={{ color: C.cyan, flexShrink: 0 }}>·</span> {s}
          </div>
        )) : (
          <div style={{ fontSize: 11, color: C.textMuted, fontStyle: "italic" }}>Click "Enrich" to pull live signals from Google</div>
        )}
        {lead.hook && (
          <>
            <div style={{ fontSize: 9, letterSpacing: 1, color: C.textMuted, textTransform: "uppercase", margin: "10px 0 5px" }}>LexiSDR Hook</div>
            <div style={{ fontSize: 11, color: C.textPrimary, fontStyle: "italic", lineHeight: 1.5 }}>"{lead.hook}"</div>
          </>
        )}
      </div>

      {/* Enrich button */}
      {!enriched && (
        <button onClick={handleEnrich} disabled={enriching}
          style={{ width: "100%", padding: "9px 0", background: enriching ? C.border : "#1a2840",
            color: enriching ? C.textMuted : C.cyan, border: `1px solid ${C.cyan}`,
            borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: enriching ? "not-allowed" : "pointer", marginBottom: 8 }}>
          {enriching ? "🔍 Pulling live data from Google…" : "🔍 Enrich with Live Data + Generate Email"}
        </button>
      )}

      {error && <div style={{ fontSize: 11, color: C.red, marginBottom: 8, padding: 8, background: "#1a0d0d", borderRadius: 6 }}>{error}</div>}

      {/* Email section */}
      <div>
        <div style={{ fontSize: 9, letterSpacing: 1, color: C.textMuted, textTransform: "uppercase", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>AI Email Draft</span>
          <Badge color={C.purple}>Live AI</Badge>
        </div>

        {!email && !loading && enriched && (
          <button onClick={handleGenerateEmail}
            style={{ width: "100%", padding: "10px 0", background: `linear-gradient(135deg, ${C.cyan}, #0060a0)`,
              color: "#000", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: 8 }}>
            ✨ Generate New Email
          </button>
        )}

        {loading && (
          <div style={{ background: "#0d1117", border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.cyan, marginBottom: 6 }}>🤖 Writing personalized email…</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>Using live signals from {lead.firm}</div>
          </div>
        )}

        {email && (
          <>
            <div style={{ background: "#0d1117", border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>SUBJECT</div>
              <div style={{ fontSize: 12, color: C.yellow, fontWeight: 600, marginBottom: 12 }}>{email.subject}</div>
              <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{email.body}</div>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <button onClick={openGmail}
                style={{ flex: 1, background: C.cyan, color: "#000", border: "none", borderRadius: 6, padding: "8px 0", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                📧 Open in Gmail
              </button>
              <button onClick={copyEmail}
                style={{ flex: 1, background: C.surface, color: copied ? C.green : C.textPrimary, border: `1px solid ${copied ? C.green : C.border}`, borderRadius: 6, padding: "8px 0", fontSize: 11, cursor: "pointer" }}>
                {copied ? "✓ Copied!" : "📋 Copy"}
              </button>
            </div>
            <button onClick={handleGenerateEmail}
              style={{ width: "100%", background: "transparent", color: C.cyan, border: `1px solid ${C.cyan}`, borderRadius: 6, padding: "8px 0", fontWeight: 700, fontSize: 11, cursor: "pointer", marginBottom: 8 }}>
              ↺ Regenerate
            </button>
          </>
        )}

        <button style={{ width: "100%", background: "#0d2535", color: C.cyan, border: `1px solid ${C.cyan}`, borderRadius: 6, padding: "8px 0", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
          📅 Schedule Meeting
        </button>
        <div style={{ fontSize: 9, letterSpacing: 1, color: C.textMuted, textTransform: "uppercase", margin: "12px 0 5px" }}>Rep Notes</div>
        <textarea placeholder="Add notes…" style={{ width: "100%", background: "#0d1117", border: `1px solid ${C.border}`, borderRadius: 6, padding: 8, color: C.textSecondary, fontSize: 11, resize: "vertical", minHeight: 60, outline: "none" }} />
      </div>
    </div>
  );
}

function LeadCard({ lead, selected, onClick }) {
  return (
    <div onClick={onClick} style={{ background: selected ? "#1a2840" : C.surface, border: `1px solid ${selected ? C.cyan : C.border}`,
      borderRadius: 10, padding: "14px 16px", marginBottom: 10, cursor: "pointer", transition: "all .15s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{lead.firm}</div>
            {lead.isLive && <Badge color={C.green}>Live</Badge>}
          </div>
          <div style={{ fontSize: 11, color: C.textSecondary }}>{lead.contact} · {lead.title}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: lead.score >= 85 ? C.green : lead.score >= 70 ? C.yellow : C.textSecondary }}>{lead.score}</div>
          <Badge color={lead.status === "READY" ? C.green : lead.status === "SENT" ? C.yellow : C.cyan}>{lead.status}</Badge>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <Badge color={C.purple}>{lead.practice}</Badge>
        <Badge color={C.textMuted}>{lead.size}</Badge>
      </div>
      <CadenceBar stage={lead.stage} />
      {lead.hook && <div style={{ fontSize: 10, color: C.textSecondary, marginTop: 4, fontStyle: "italic" }}>{lead.hook}</div>}
    </div>
  );
}

// ── Dashboard Page ─────────────────────────────────────────────────────────
function DashboardPage({ selectedLead, setSelectedLead, allLeads, setAllLeads }) {
  const [st, setSt] = useState("Select State...");
  const [city, setCity] = useState("");
  const [practice, setPractice] = useState("All Practice Areas");
  const [firmSize, setFirmSize] = useState("");
  const [mode, setMode] = useState("draft");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activityLines, setActivityLines] = useState([]);
  const [stats, setStats] = useState({ firms: 0, emails: 0, replies: 0, meetings: 0, hot: 0 });
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState(null);
  const feedRef = useRef(null);

  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, [activityLines]);

  function addLine(text, color) {
    const now = new Date();
    const t = String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0");
    setActivityLines(prev => [...prev, { t, text, color: color || C.textSecondary }]);
  }

  async function runLexi() {
    if (!firmSize) { alert("Please select a firm size segment."); return; }
    if (st === "Select State...") { alert("Please select a state."); return; }

    setRunning(true); setProgress(0); setActivityLines([]); setLeads([]);
    setStats({ firms: 0, emails: 0, replies: 0, meetings: 0, hot: 0 });
    setError(null);

    addLine(`Mission start — ${city ? city + ", " : ""}${st}`, C.cyan);
    addLine(`Target: ${firmSize} attorney firms · ${practice}`, C.textSecondary);
    setProgress(10);

    addLine("Scanning Google for active law firms…", C.textSecondary);
    setProgress(25);

    try {
      addLine("Calling LexiSDR prospecting engine…", C.textSecondary);
      setProgress(40);

      const res = await fetch(`${BACKEND_URL}/api/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: st, city, practiceArea: practice, firmSize })
      });

      setProgress(65);

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const liveLeads = (data.leads || []).map(l => ({ ...l, state: st }));

      setProgress(85);
      addLine(`Found ${liveLeads.length} firms in ${st}`, C.green);

      liveLeads.forEach(l => {
        addLine(`[${l.firm}] ✓ Lead scored ${l.score} — ${l.status}`, l.score >= 85 ? C.orange : C.green);
      });

      setLeads(liveLeads);
      setAllLeads(prev => {
        const existingIds = new Set(prev.map(l => l.id));
        const newLeads = liveLeads.filter(l => !existingIds.has(l.id));
        return [...prev, ...newLeads];
      });
      setStats({
        firms: liveLeads.length,
        emails: 0,
        replies: 0,
        meetings: 0,
        hot: liveLeads.filter(l => l.score >= 85).length
      });
      addLine("Mission complete — click any lead to enrich & generate email", C.cyan);
      setProgress(100);

    } catch (e) {
      setError(e.message);
      addLine("Error: " + e.message, C.red);
      addLine("Check that your BACKEND_URL is set correctly in the code", C.yellow);
    }

    setRunning(false);
  }

  return (
    <div style={{ display: "flex", gap: 16, height: "100%", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
        {/* Stats */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <StatCard label="Firms Discovered" value={stats.firms} sub={stats.firms > 0 ? "Live from Google" : "Run LexiSDR"} subColor={stats.firms > 0 ? C.green : C.textMuted} />
          <StatCard label="Emails Sent" value={stats.emails} sub="Via Gmail" />
          <StatCard label="Replies" value={stats.replies} sub="Tracking active" />
          <StatCard label="Meetings" value={stats.meetings} sub="Booked" />
          <StatCard label="Hot Leads" value={stats.hot} sub="Score ≥ 85" subColor={C.orange} />
        </div>

        {/* Mission Control */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>Mission Control</span>
              <Badge color={C.green}>Live Mode</Badge>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["draft","auto"].map(m => (
                <button key={m} onClick={() => setMode(m)}
                  style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${mode===m ? (m==="draft"?C.orange:C.cyan) : C.border}`,
                    background: mode===m ? (m==="draft"?"#2a1f0d":"#0d2530") : "transparent",
                    color: mode===m ? (m==="draft"?C.orange:C.cyan) : C.textSecondary, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {m==="draft" ? "🔥 Draft & Review" : "⚡ Auto-Send"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <select value={st} onChange={e => setSt(e.target.value)}
              style={{ background: "#0d1117", border: `1px solid ${C.border}`, color: C.textPrimary, borderRadius: 6, padding: "7px 10px", fontSize: 12, outline: "none" }}>
              {STATES.map(s => <option key={s}>{s}</option>)}
            </select>
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="City (optional)"
              style={{ background: "#0d1117", border: `1px solid ${C.border}`, color: C.textPrimary, borderRadius: 6, padding: "7px 10px", fontSize: 12, outline: "none", width: 140 }} />
            <select value={practice} onChange={e => setPractice(e.target.value)}
              style={{ background: "#0d1117", border: `1px solid ${C.border}`, color: C.textPrimary, borderRadius: 6, padding: "7px 10px", fontSize: 12, outline: "none" }}>
              {PRACTICE_AREAS.map(p => <option key={p}>{p}</option>)}
            </select>
            <div style={{ display: "flex", gap: 6 }}>
              {FIRM_SIZES.map(s => (
                <button key={s.value} onClick={() => setFirmSize(s.value)}
                  style={{ padding: "7px 12px", borderRadius: 6, border: `1px solid ${firmSize===s.value ? C.cyan : C.border}`,
                    background: firmSize===s.value ? "#0d2530" : "transparent",
                    color: firmSize===s.value ? C.cyan : C.textSecondary, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                  {s.label}
                </button>
              ))}
            </div>
            <button onClick={runLexi} disabled={running}
              style={{ padding: "8px 20px", background: running ? C.border : C.cyan, color: "#000", border: "none",
                borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: running ? "not-allowed" : "pointer" }}>
              {running ? "Running…" : "▶ Run LexiSDR"}
            </button>
          </div>

          {(running || progress > 0) && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: progress === 100 ? C.green : C.cyan, transition: "width .4s", borderRadius: 2 }} />
              </div>
            </div>
          )}

          {activityLines.length > 0 && (
            <div ref={feedRef} style={{ background: "#0d1117", borderRadius: 8, padding: 12, maxHeight: 160, overflowY: "auto", fontFamily: "monospace" }}>
              {activityLines.map((l, i) => (
                <div key={i} style={{ fontSize: 11, color: l.color, marginBottom: 2 }}>
                  <span style={{ color: C.textMuted, marginRight: 8 }}>{l.t}</span>{l.text}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, padding: 12, background: "#1a0d0d", border: `1px solid ${C.red}`, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: C.red, fontWeight: 700, marginBottom: 4 }}>⚠ Backend not connected</div>
              <div style={{ fontSize: 11, color: C.textSecondary }}>Open the SETUP.md file and follow the 3-step instructions to deploy your backend.</div>
            </div>
          )}
        </div>

        {/* Live Leads */}
        {leads.length > 0 && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 1.5, color: C.textMuted, textTransform: "uppercase", marginBottom: 12 }}>
              {leads.length} Live Leads Found — Click to Enrich & Generate Email
            </div>
            {leads.map(lead => (
              <LeadCard key={lead.id} lead={lead} selected={selectedLead?.id === lead.id} onClick={() => setSelectedLead(lead)} />
            ))}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div style={{ width: 320, flexShrink: 0, overflowY: "auto", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
        <EmailPanel lead={selectedLead} />
      </div>
    </div>
  );
}

function AllLeadsPage({ selectedLead, setSelectedLead, allLeads }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? allLeads : allLeads.filter(l => l.status === filter.toUpperCase());

  return (
    <div style={{ display: "flex", gap: 16, height: "100%", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {allLeads.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
            <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 6 }}>No leads yet</div>
            <div style={{ fontSize: 12 }}>Run LexiSDR from the Dashboard to discover live prospects</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["all","ready","sent"].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${filter===f ? C.cyan : C.border}`,
                    background: filter===f ? "#0d2530" : "transparent", color: filter===f ? C.cyan : C.textSecondary,
                    fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
                  {f === "all" ? `All (${allLeads.length})` : f === "ready" ? `Ready (${allLeads.filter(l=>l.status==="READY").length})` : `Sent (${allLeads.filter(l=>l.status==="SENT").length})`}
                </button>
              ))}
            </div>
            {filtered.map(lead => (
              <LeadCard key={lead.id} lead={lead} selected={selectedLead?.id === lead.id} onClick={() => setSelectedLead(lead)} />
            ))}
          </>
        )}
      </div>
      <div style={{ width: 320, flexShrink: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
        <EmailPanel lead={selectedLead} />
      </div>
    </div>
  );
}

function LeadReportPage({ allLeads }) {
  const byPractice = PRACTICE_AREAS.slice(1).map(p => ({ practice: p, count: allLeads.filter(l => l.practice === p).length })).filter(x => x.count > 0);
  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <StatCard label="Total Leads" value={allLeads.length} sub="Across all sessions" />
        <StatCard label="Avg Score" value={allLeads.length ? Math.round(allLeads.reduce((s,l)=>s+l.score,0)/allLeads.length) : 0} sub="Lead quality index" />
        <StatCard label="Hot Leads" value={allLeads.filter(l=>l.score>=85).length} sub="Score ≥ 85" subColor={C.orange} />
        <StatCard label="Live Leads" value={allLeads.filter(l=>l.isLive).length} sub="From real Google search" subColor={C.green} />
      </div>
      {byPractice.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textPrimary, marginBottom: 16 }}>Leads by Practice Area</div>
          {byPractice.map(({ practice, count }) => (
            <div key={practice} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 140, fontSize: 12, color: C.textSecondary }}>{practice}</div>
              <div style={{ flex: 1, background: "#0d1117", borderRadius: 4, height: 16, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(count/allLeads.length)*100}%`, background: C.cyan, borderRadius: 4 }} />
              </div>
              <div style={{ width: 20, fontSize: 12, color: C.textPrimary, fontWeight: 700 }}>{count}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SetupPage() {
  const steps = [
    {
      num: "1",
      title: "Get your free API keys",
      color: C.cyan,
      items: [
        { name: "Serper.dev", url: "https://serper.dev", desc: "Sign up free → copy your API key. Gives 2,500 free Google searches/mo." },
        { name: "Hunter.io", url: "https://hunter.io", desc: "Sign up free → go to API → copy your key. 25 free email finds/mo." },
        { name: "Anthropic", url: "https://console.anthropic.com", desc: "Sign up → Billing → add $5 credit → API Keys → create key." },
      ]
    },
    {
      num: "2",
      title: "Deploy the backend to Vercel (free)",
      color: C.green,
      items: [
        { name: "Step A", desc: "Go to github.com → create a free account → click New Repository → name it 'lexisdr-backend' → Create" },
        { name: "Step B", desc: "Upload all 3 files from the lexisdr-backend folder (prospect.js, batch.js inside /api folder, vercel.json, package.json)" },
        { name: "Step C", desc: "Go to vercel.com → sign up with GitHub → click 'Add New Project' → import lexisdr-backend" },
        { name: "Step D", desc: "In Vercel project Settings → Environment Variables, add: SERPER_API_KEY, HUNTER_API_KEY, ANTHROPIC_API_KEY with your keys" },
        { name: "Step E", desc: "Click Deploy. Copy your Vercel URL (e.g. lexisdr-backend.vercel.app)" },
      ]
    },
    {
      num: "3",
      title: "Connect LexiSDR frontend",
      color: C.purple,
      items: [
        { name: "Final step", desc: "In LexiSDR_v3.jsx, find line: const BACKEND_URL = \"https://YOUR-VERCEL-URL.vercel.app\" and replace with your actual Vercel URL. That's it — LexiSDR is live!" },
      ]
    }
  ];

  return (
    <div style={{ overflowY: "auto", height: "100%", maxWidth: 700 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>Setup Guide — Go Live in ~20 Minutes</div>
        <div style={{ fontSize: 12, color: C.textSecondary }}>No coding required. Just create 3 free accounts and upload files.</div>
      </div>
      {steps.map(step => (
        <div key={step.num} style={{ background: C.surface, border: `1px solid ${step.color}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, background: step.color, color: "#000", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{step.num}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{step.title}</div>
          </div>
          {step.items.map(item => (
            <div key={item.name} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: step.color, fontWeight: 700, fontSize: 11, minWidth: 80 }}>{item.name}</span>
                <span style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.5 }}>{item.desc}</span>
              </div>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer"
                  style={{ fontSize: 10, color: step.color, display: "block", marginTop: 4, marginLeft: 88 }}>
                  → Open {item.url}
                </a>
              )}
            </div>
          ))}
        </div>
      ))}
      <div style={{ background: "#0d2535", border: `1px solid ${C.cyan}`, borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.cyan, marginBottom: 6 }}>💡 Monthly cost estimate for a team of 2-10</div>
        <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.8 }}>
          Serper.dev: Free (2,500 searches) or $50/mo for 50,000<br/>
          Hunter.io: Free (25 finds) or $49/mo for 500<br/>
          Anthropic API: ~$5–20/mo depending on email volume<br/>
          Vercel: Free forever for this use case<br/>
          <span style={{ color: C.green, fontWeight: 700 }}>Total: $0–$120/mo depending on scale</span>
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [selectedLead, setSelectedLead] = useState(null);
  const [allLeads, setAllLeads] = useState([]);

  const navItems = [
    { icon: "⚡", label: "Dashboard" },
    { icon: "👥", label: "All Leads", badge: allLeads.length || null },
    { icon: "📈", label: "Lead Report" },
    { icon: "🔧", label: "Setup Guide" },
  ];

  const pageMap = {
    "Dashboard": <DashboardPage selectedLead={selectedLead} setSelectedLead={setSelectedLead} allLeads={allLeads} setAllLeads={setAllLeads} />,
    "All Leads": <AllLeadsPage selectedLead={selectedLead} setSelectedLead={setSelectedLead} allLeads={allLeads} />,
    "Lead Report": <LeadReportPage allLeads={allLeads} />,
    "Setup Guide": <SetupPage />,
  };

  const backendConfigured = !BACKEND_URL.includes("YOUR-VERCEL-URL");

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textPrimary, overflow: "hidden", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 195, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", padding: "18px 10px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 24, paddingLeft: 4 }}>
          <div style={{ width: 32, height: 32, background: `linear-gradient(135deg, ${C.cyan}, #0060a0)`, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#000", flexShrink: 0 }}>L</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary }}>LexiSDR</div>
            <div style={{ fontSize: 8, letterSpacing: 1.5, color: C.cyan, textTransform: "uppercase" }}>Autonomous Legal SDR</div>
          </div>
        </div>
        <div style={{ fontSize: 8, letterSpacing: 1.5, color: C.textMuted, textTransform: "uppercase", marginBottom: 7, paddingLeft: 4 }}>Workspace</div>
        {navItems.map(item => (
          <NavItem key={item.label} icon={item.icon} label={item.label} active={page === item.label} badge={item.badge}
            onClick={() => { setPage(item.label); setSelectedLead(null); }} />
        ))}
        <div style={{ flex: 1 }} />
        {!backendConfigured && (
          <div onClick={() => { setPage("Setup Guide"); setSelectedLead(null); }}
            style={{ padding: "8px 12px", background: "#1a1200", border: `1px solid ${C.yellow}`, borderRadius: 7, cursor: "pointer", marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: C.yellow, fontWeight: 700 }}>⚠ Setup Required</div>
            <div style={{ fontSize: 9, color: C.textMuted }}>Click to configure backend</div>
          </div>
        )}
        <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: backendConfigured ? C.green : C.yellow, boxShadow: `0 0 5px ${backendConfigured ? C.green : C.yellow}` }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textPrimary }}>LexiSDR</div>
              <div style={{ fontSize: 9, color: C.textMuted }}>{backendConfigured ? "Live mode ready" : "Setup needed"}</div>
            </div>
          </div>
        </div>
      </div>
      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", borderBottom: `1px solid ${C.border}`, background: C.bg, flexShrink: 0 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: C.textPrimary }}>{page}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge color={backendConfigured ? C.green : C.yellow}>{backendConfigured ? "🟢 Backend Live" : "⚠ Backend Not Configured"}</Badge>
          </div>
        </div>
        <div style={{ flex: 1, padding: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {pageMap[page]}
        </div>
      </div>
    </div>
  );
}
