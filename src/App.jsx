import { useState, useRef, useEffect } from "react";

// ── CLAUDE API ─────────────────────────────────────────────────────────────────
async function callClaude(system, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:8000,
      system,
      messages,
    }),
  });
  return (await res.json()).content?.[0]?.text || "";
}

// ── GITHUB API ─────────────────────────────────────────────────────────────────
const GH_OWNER = "Stephone5";
const GH_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const ghHdr = () => ({
  "Authorization": `token ${GH_TOKEN}`,
  "Accept": "application/vnd.github.v3+json",
  "Content-Type": "application/json",
});

async function ghRead(repo, path) {
  const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${repo}/contents/${path}`, { headers: ghHdr() });
  if (!res.ok) throw new Error(`GitHub read ${repo}/${path} → ${res.status}`);
  const d = await res.json();
  return decodeURIComponent(escape(atob(d.content.replace(/\n/g,""))));
}

async function ghWrite(repo, path, content, commitMsg) {
  const getRes = await fetch(`https://api.github.com/repos/${GH_OWNER}/${repo}/contents/${path}`, { headers: ghHdr() });
  if (!getRes.ok) throw new Error(`GitHub get SHA → ${getRes.status}`);
  const { sha } = await getRes.json();
  const putRes = await fetch(`https://api.github.com/repos/${GH_OWNER}/${repo}/contents/${path}`, {
    method:"PUT",
    headers: ghHdr(),
    body: JSON.stringify({ message:commitMsg, content:btoa(unescape(encodeURIComponent(content))), sha }),
  });
  if (!putRes.ok) {
    const err = await putRes.json();
    throw new Error(err.message || `GitHub write → ${putRes.status}`);
  }
  return true;
}

// ── EDIT BLOCK HELPERS ────────────────────────────────────────────────────────
function parseEdits(text) {
  const edits = [];
  const re = /<EDIT\s+repo="([^"]+)"\s+path="([^"]+)"\s+commit="([^"]+)">([\s\S]*?)<\/EDIT>/g;
  let m;
  while ((m = re.exec(text)) !== null)
    edits.push({ repo:m[1], path:m[2], commit:m[3], content:m[4].trim() });
  return edits;
}

function stripEdits(text) {
  return text.replace(/<EDIT[\s\S]*?<\/EDIT>/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function parseFileRequests(text) {
  return [...text.matchAll(/^FILE_REQUEST:\s*(\S+?)\/(.+)$/gm)]
    .map(m => ({ repo: m[1].trim(), path: m[2].trim() }));
}

// ── AI SYSTEM PROMPT ──────────────────────────────────────────────────────────
const AI_SYS = `You are a senior full-stack developer for TradeStack — a B2B SaaS platform for small business financial management. You have read/write access to two GitHub repos owned by Stephone5:

1. tradestack-admin — this React + Vite admin dashboard (src/App.jsx is the whole app)
2. Tradestack — the main user-facing React + Vite web app (src/App.jsx is the whole app)

READING FILES:
To read a file before making changes, output this on a line by itself:
FILE_REQUEST: reponame/src/App.jsx

The system will fetch it and give it back to you. Always request the file before editing it unless the user already provided the content.

MAKING CHANGES — use this exact format:
<EDIT repo="tradestack-admin" path="src/App.jsx" commit="fix: brief description">
[COMPLETE NEW FILE CONTENT — always the full file, never partial snippets or diffs]
</EDIT>

You can include multiple EDIT blocks in one reply if changing both repos.

RULES:
- Always output COMPLETE file content inside EDIT blocks — never partial code
- Be concise in prose: 2-3 sentences before your code
- If you need to see a file first, request it, wait, then provide the EDIT
- Vercel auto-deploys ~10 seconds after a GitHub push
- Both repos are single-file React apps (all code in src/App.jsx)

KNOWN ISSUES TO FIX (when asked):
- Emoji encoding corruption — shows as "A??" or hieroglyphics in UI
- Low contrast — dark gray text on dark gray backgrounds
- Desktop layout too small/zoomed out — fonts and spacing need to scale up
- Main site has confusing labels ("cogs" vs "operating expenses" etc.)`;

// ── DATA ──────────────────────────────────────────────────────────────────────
const SPRINT = { num:1, start:"Mar 16", end:"Mar 30", dayElapsed:6, dayTotal:14 };

const BACKLOG = [
  {id:"PB-01",title:"Referral network tab",priority:"P0",pts:8,type:"Feature",source:"Product Agent",sprint:null,status:"Backlog"},
  {id:"PB-02",title:"Competitor tab: real web search data",priority:"P0",pts:5,type:"Bug",source:"Support Agent",sprint:1,status:"In Progress"},
  {id:"PB-03",title:"Email alert when financial score drops",priority:"P1",pts:3,type:"Feature",source:"Finance Agent",sprint:1,status:"In Progress"},
  {id:"PB-04",title:"Onboarding checklist for new signups",priority:"P1",pts:3,type:"Feature",source:"Onboarding Agent",sprint:1,status:"Done"},
  {id:"PB-05",title:"Weekly analytics digest to owner",priority:"P1",pts:2,type:"Feature",source:"Analytics Agent",sprint:1,status:"Done"},
  {id:"PB-06",title:"Stripe integration for paid tier",priority:"P1",pts:8,type:"Feature",source:"Owner",sprint:null,status:"Backlog"},
  {id:"PB-07",title:"Mobile-responsive layout",priority:"P1",pts:5,type:"Improvement",source:"Support Agent",sprint:null,status:"Backlog"},
  {id:"PB-08",title:"Outreach tracking dashboard",priority:"P2",pts:5,type:"Feature",source:"Outreach Agent",sprint:null,status:"Backlog"},
  {id:"PB-09",title:"Export lean canvas as PDF",priority:"P2",pts:2,type:"Feature",source:"Product Agent",sprint:null,status:"Backlog"},
  {id:"PB-10",title:"Industries filter for referral network",priority:"P2",pts:3,type:"Feature",source:"Research Agent",sprint:null,status:"Backlog"},
  {id:"PB-11",title:"Per-user engagement score in admin",priority:"P2",pts:3,type:"Feature",source:"Analytics Agent",sprint:null,status:"Backlog"},
  {id:"PB-12",title:"Seasonal revenue forecasting tab",priority:"P3",pts:8,type:"Feature",source:"Finance Agent",sprint:null,status:"Backlog"},
];

const STANDUPS = [
  { date:"Mar 22 · Today", agents:[
    {name:"Research",emoji:"🔍",s:"green",update:"Completed competitor refresh for 3 users. Flagged new competitor: Apex Mechanical (opened Nov 2025).",blocker:null},
    {name:"Analytics",emoji:"📊",s:"green",update:"7 active users this week, 2 new signups. Avg session 8.2min. Competitor tab has 3x more views than Financial tab.",blocker:null},
    {name:"Outreach",emoji:"📣",s:"amber",update:"4 emails drafted and queued for owner approval. 0 sent — awaiting review.",blocker:"Approval queue has 4 items pending 3+ days."},
    {name:"Product",emoji:"🔧",s:"green",update:"Triaged 6 feedback items. 2 escalated to backlog. 4 resolved as FAQ updates.",blocker:null},
    {name:"Finance",emoji:"💰",s:"green",update:"Re-ran analysis for 2 users who updated financials. 1 critical drain flagged (user #4, op-ex 68%).",blocker:null},
    {name:"Support",emoji:"🛟",s:"red",update:"1 frustrated user — said competitor tab 'feels like fake data'. Risk of churn.",blocker:"PB-02 unresolved — causing repeat complaints."},
  ]},
  { date:"Mar 21", agents:[
    {name:"Research",emoji:"🔍",s:"green",update:"Weekly market scan complete. 3 new prospects added to outreach queue.",blocker:null},
    {name:"Analytics",emoji:"📊",s:"green",update:"Signup-to-setup completion: 71%. 2 users dropped at financial data entry.",blocker:null},
    {name:"Outreach",emoji:"📣",s:"green",update:"Drafted 3 cold emails. Delivered to approval queue.",blocker:null},
    {name:"Support",emoji:"🛟",s:"green",update:"2 feedback items: 1 feature request (PDF export), 1 positive. Both routed to Product Agent.",blocker:null},
  ]},
];

const REVIEW_ITEMS = [
  {id:"R-01",agent:"Outreach",emoji:"📣",title:"Cold email — Castle Home Repair LLC",urgency:"Normal",preview:`Subject: Quick question about your schedule\n\nHey — saw Castle Home Repair on Yelp. Honest question: are you spending more time answering calls and chasing invoices than actually doing repairs?\n\nWe built a free tool that shows trades businesses exactly where they're losing money. 10 minutes to set up. Free for 90 days, no card.\n\nWorth a look?`},
  {id:"R-02",agent:"Outreach",emoji:"📣",title:"Cold email — J&T Painting",urgency:"Normal",preview:`Subject: Quick question for J&T\n\nRunning a painting crew means you're the estimator, scheduler, bookkeeper, and HR department all at once. We made something that shows you exactly where that's costing you money.\n\nFree for 90 days, 10 minutes to set up.\n\nInterested?`},
  {id:"R-03",agent:"Product",emoji:"🔧",title:"Feature Spec: Competitor real data (PB-02)",urgency:"High",preview:`P0 — Critical\nProblem: Users recognize competitor data as AI estimates, not real businesses. Causing trust loss.\nSolution: Integrate web search — pull real business names, ratings, review counts from Google/Yelp API.\nSuccess metric: 0 "fake data" complaints within 14 days of ship.\nEffort: 3-5 days dev.`},
  {id:"R-04",agent:"Finance",emoji:"💰",title:"Alert: User #4 critical drain",urgency:"High",preview:`User: Apex Handyman (Mike R.)\nOp-ex ratio: 68% — industry avg is 38-45%.\nLikely cause: Vehicle/fuel costs + tools not tracked per job.\nAction needed: Owner approval to surface this alert to the user's dashboard.`},
  {id:"R-05",agent:"Research",emoji:"🔍",title:"New competitor: Apex Mechanical SC",urgency:"Normal",preview:`New business: Apex Mechanical, State College PA. Opened ~Nov 2025.\nEst. revenue: <$50K. Targeting HVAC + plumbing residential.\nThreat: Low now, Medium within 12 months.\nOpportunity: No online presence yet — your users can capture reviews first.`},
];

const RETRO = [
  {head:"Went Well",cls:"rh-g",items:["Onboarding checklist shipped on time","Analytics digest running clean","Support Agent caught churn risk on user #3 before they left"]},
  {head:"Needs Improvement",cls:"rh-a",items:["Approval queue backlog — 4 emails sat 3+ days","Competitor trust issue recurring — PB-02 should have been P0","No scope limit on Research Agent — over-delivered"]},
  {head:"Sprint 2 Actions",cls:"rh-b",items:["Set 48hr SLA on all review queue items","PB-02 is Sprint 2 first priority","Define word-count limit for Research Agent outputs"]},
];

// ── STYLES ────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=Inconsolata:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-text-size-adjust:100%;}
body{background:#0d0d0d;}
.app{min-height:100vh;background:#0d0d0d;color:#ddd8ce;font-family:'Inconsolata',monospace;font-size:13px;font-weight:300;}

/* TOP BAR */
.bar{height:48px;background:#111;border-bottom:1px solid #1c1c1c;display:flex;align-items:center;padding:0 1rem;gap:.75rem;position:sticky;top:0;z-index:200;}
.logo{font-family:'Archivo',sans-serif;font-weight:900;font-size:.95rem;letter-spacing:-.02em;color:#ddd8ce;white-space:nowrap;}
.logo b{color:#e07b39;}
.sbadge{margin-left:auto;font-size:.58rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;background:#1a1200;color:#e07b39;border:1px solid #3a2800;padding:.2rem .55rem;border-radius:2px;display:flex;align-items:center;gap:.4rem;white-space:nowrap;flex-shrink:0;}
.sdot{width:5px;height:5px;border-radius:50%;background:#e07b39;animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}

/* NAV */
.nav-toggle{display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:3px;cursor:pointer;font-size:1rem;flex-shrink:0;-webkit-tap-highlight-color:transparent;}
@media(min-width:768px){.nav-toggle{display:none;}}
.layout{display:flex;position:relative;}
.sidebar{position:fixed;top:48px;left:0;bottom:0;width:210px;background:#0f0f0f;border-right:1px solid #1c1c1c;overflow-y:auto;z-index:150;transform:translateX(-100%);transition:transform .2s;padding:1rem 0;}
.sidebar.open{transform:translateX(0);}
@media(min-width:768px){.sidebar{position:sticky;transform:none;top:0;height:calc(100vh - 48px);flex-shrink:0;}}
.snlbl{font-size:.55rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#333;padding:0 .9rem;margin:.9rem 0 .35rem;}
.snlbl:first-child{margin-top:0;}
.snbtn{display:flex;align-items:center;gap:.55rem;width:100%;padding:.5rem .9rem;border:none;background:none;cursor:pointer;text-align:left;transition:background .1s;-webkit-tap-highlight-color:transparent;}
.snbtn:hover{background:#161616;}
.snbtn.on{background:#181200;border-right:2px solid #e07b39;}
.snbi{font-size:.85rem;width:18px;text-align:center;}
.snbl{font-family:'Archivo',sans-serif;font-weight:600;font-size:.7rem;color:#666;}
.snbtn.on .snbl{color:#ddd8ce;}
.sncnt{margin-left:auto;background:#2a1800;color:#e07b39;font-size:.56rem;font-weight:600;padding:.08rem .3rem;border-radius:2px;}

/* OVERLAY */
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:140;}
.overlay.show{display:block;}
@media(min-width:768px){.overlay{display:none!important;}}

/* MAIN */
.main{flex:1;overflow-y:auto;padding:1rem;min-width:0;}
@media(min-width:768px){.main{padding:1.5rem;}}

/* SECTION */
.sh{display:flex;align-items:center;gap:.6rem;margin-bottom:.25rem;}
.st{font-family:'Archivo',sans-serif;font-weight:800;font-size:.95rem;color:#ddd8ce;letter-spacing:-.01em;}
.sl{flex:1;height:1px;background:#1c1c1c;}
.ss{font-size:.68rem;color:#555;margin-bottom:.9rem;}

/* CARDS */
.card{background:#111;border:1px solid #1c1c1c;border-radius:3px;padding:.9rem;}

/* GRIDS */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:.65rem;}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.65rem;}
.g4{display:grid;grid-template-columns:1fr 1fr;gap:.65rem;}
@media(min-width:600px){.g4{grid-template-columns:repeat(4,1fr);}}

.stat-v{font-family:'Archivo',sans-serif;font-weight:800;font-size:1.6rem;line-height:1;color:#ddd8ce;}
.stat-l{font-size:.57rem;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:#444;margin-top:.25rem;}
.stat-d{font-size:.65rem;margin-top:.15rem;}
.dup{color:#4ade80;}.ddn{color:#f87171;}.dfl{color:#555;}

/* SPRINT BAR */
.sbar-wrap{background:#1a1a1a;border-radius:2px;height:5px;overflow:hidden;margin:.45rem 0;}
.sbar-fill{height:100%;background:#e07b39;border-radius:2px;}
.tick-row{display:flex;gap:2px;margin-top:.4rem;}
.tick{flex:1;height:3px;border-radius:1px;}

/* PILLS */
.pill{display:inline-flex;align-items:center;font-size:.55rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:.1rem .38rem;border-radius:2px;}
.p-r{background:#1e0a0a;color:#f87171;}
.p-a{background:#1e1200;color:#e07b39;}
.p-g{background:#0a1e10;color:#4ade80;}
.p-b{background:#0a1020;color:#60a5fa;}
.p-x{background:#1a1a1a;color:#555;}

/* BOARD */
.board-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
.board{display:grid;grid-template-columns:repeat(4,minmax(200px,1fr));gap:.65rem;min-width:820px;}
.bcol{background:#0f0f0f;border:1px solid #1c1c1c;border-radius:3px;padding:.65rem;min-height:260px;}
.bcolh{font-family:'Archivo',sans-serif;font-weight:700;font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-bottom:.65rem;display:flex;align-items:center;justify-content:space-between;}
.bcolh span{background:#1a1a1a;color:#555;font-size:.56rem;padding:.08rem .3rem;border-radius:2px;}
.ticket{background:#141414;border:1px solid #202020;border-radius:3px;padding:.6rem;margin-bottom:.45rem;}
.t-id{font-size:.56rem;color:#444;margin-bottom:.15rem;}
.t-title{font-family:'Archivo',sans-serif;font-weight:600;font-size:.72rem;color:#ccc;line-height:1.3;margin-bottom:.35rem;}
.t-meta{display:flex;gap:.25rem;flex-wrap:wrap;}
.t-src{font-size:.58rem;color:#444;margin-top:.25rem;}

/* STANDUP */
.sdup-tabs{display:flex;gap:.4rem;margin-bottom:.9rem;overflow-x:auto;}
.sdup-tab{padding:.3rem .7rem;background:#1a1a1a;color:#666;border:1px solid #2a2a2a;border-radius:2px;cursor:pointer;font-family:'Archivo',sans-serif;font-weight:700;font-size:.62rem;white-space:nowrap;-webkit-tap-highlight-color:transparent;}
.sdup-tab.on{background:#e07b39;color:#0d0d0d;border-color:#e07b39;}
.sr{display:flex;align-items:flex-start;gap:.65rem;padding:.7rem 0;border-bottom:1px solid #161616;}
.sr:last-child{border-bottom:none;}
.si{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px;}
.sig{background:#4ade80;}.sia{background:#e07b39;animation:pulse 2s infinite;}.sir{background:#f87171;}
.sava{width:30px;height:30px;border-radius:50%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0;}
.san{font-family:'Archivo',sans-serif;font-weight:700;font-size:.75rem;color:#ccc;}
.sau{font-size:.7rem;color:#888;line-height:1.5;margin-top:.12rem;}
.sblk{margin-top:.35rem;background:#1a0a0a;border-left:2px solid #7f1d1d;padding:.35rem .55rem;font-size:.68rem;color:#f87171;line-height:1.45;}

/* REVIEW */
.ri{background:#111;border:1px solid #1c1c1c;border-radius:3px;padding:.9rem;margin-bottom:.65rem;}
.ri-hdr{display:flex;align-items:flex-start;gap:.65rem;margin-bottom:.55rem;}
.ri-title{font-family:'Archivo',sans-serif;font-weight:700;font-size:.82rem;color:#ddd8ce;}
.ri-meta{display:flex;gap:.35rem;align-items:center;margin-top:.18rem;flex-wrap:wrap;}
.ri-pre{font-size:.7rem;color:#777;line-height:1.6;white-space:pre-wrap;background:#0d0d0d;border:1px solid #191919;padding:.65rem;border-radius:3px;margin-bottom:.65rem;max-height:130px;overflow-y:auto;}
.ri-acts{display:flex;gap:.45rem;flex-wrap:wrap;}
.bapp{font-family:'Archivo',sans-serif;font-weight:700;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;background:#0a1e10;color:#4ade80;border:1px solid #1a3a20;padding:.38rem .75rem;cursor:pointer;border-radius:2px;-webkit-tap-highlight-color:transparent;}
.brej{font-family:'Archivo',sans-serif;font-weight:700;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;background:#1e0a0a;color:#f87171;border:1px solid #3a1a1a;padding:.38rem .75rem;cursor:pointer;border-radius:2px;}
.bedt{font-family:'Archivo',sans-serif;font-weight:700;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;background:#1a1a1a;color:#888;border:1px solid #2a2a2a;padding:.38rem .75rem;cursor:pointer;border-radius:2px;}

/* PLANNING */
.pi{display:flex;align-items:center;gap:.65rem;padding:.55rem .7rem;background:#111;border:1px solid #1c1c1c;border-radius:3px;margin-bottom:.4rem;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.pi.sel{border-color:#e07b39;background:#1a1200;}
.pichk{width:16px;height:16px;border-radius:2px;border:1px solid #2a2a2a;background:#1a1a1a;display:flex;align-items:center;justify-content:font-size:.62rem;flex-shrink:0;}
.pi.sel .pichk{background:#e07b39;border-color:#e07b39;color:#000;}
.pi-id{font-size:.58rem;color:#444;width:44px;flex-shrink:0;}
.pi-title{font-family:'Archivo',sans-serif;font-weight:600;font-size:.72rem;color:#ccc;flex:1;min-width:0;}
.pi-pts{font-size:.65rem;color:#555;flex-shrink:0;}

/* RETRO */
.retro-grid{display:grid;grid-template-columns:1fr;gap:.75rem;}
@media(min-width:600px){.retro-grid{grid-template-columns:repeat(3,1fr);}}
.rcol{background:#0f0f0f;border:1px solid #1c1c1c;border-radius:3px;padding:.9rem;}
.rcol-h{font-family:'Archivo',sans-serif;font-weight:700;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.65rem;}
.rh-g{color:#4ade80;}.rh-a{color:#e07b39;}.rh-b{color:#60a5fa;}
.ritem{display:flex;align-items:flex-start;gap:.45rem;font-size:.7rem;color:#888;line-height:1.5;padding:.35rem 0;border-bottom:1px solid #161616;}
.ritem:last-child{border-bottom:none;}
.ritem::before{content:'→';color:#333;flex-shrink:0;}

/* BLOCKERS */
.blk-item{background:#1a0a0a;border-left:2px solid #7f1d1d;padding:.5rem .7rem;font-size:.7rem;color:#f87171;line-height:1.5;margin-bottom:.4rem;border-radius:0 3px 3px 0;}

/* FLOW */
.flow{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:center;padding:1rem 0;}
.fn{background:#111;border:1px solid #1c1c1c;border-radius:3px;padding:.5rem .75rem;text-align:center;}
.fn.act{border-color:#e07b39;background:#1a1200;}
.fn.own{border-color:#60a5fa;background:#0a1020;}
.fn-e{font-size:1.1rem;}
.fn-n{font-family:'Archivo',sans-serif;font-weight:700;font-size:.6rem;color:#555;margin-top:.15rem;}
.fn.act .fn-n{color:#e07b39;}.fn.own .fn-n{color:#60a5fa;}
.farrow{color:#2a2a2a;font-size:.85rem;}

/* AGENT CONFIG */
.ag-toggle{display:flex;align-items:center;gap:.55rem;margin-bottom:1rem;}
.ag-toggle-btn{font-family:'Archivo',sans-serif;font-weight:700;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;background:#1a1a1a;color:#888;border:1px solid #2a2a2a;padding:.38rem .75rem;cursor:pointer;border-radius:2px;transition:all .15s;}
.ag-toggle-btn.active{background:#1a1200;color:#e07b39;border-color:#3a2800;}
.ag-row{display:flex;align-items:center;gap:.55rem;padding:.6rem .75rem;background:#111;border:1px solid #1c1c1c;border-radius:3px;margin-bottom:.35rem;flex-wrap:wrap;}
.ag-row.inactive{opacity:.45;}
.ag-emoji-btn{font-size:1.1rem;background:none;border:none;cursor:pointer;padding:.1rem .25rem;border-radius:2px;transition:background .1s;}
.ag-emoji-btn:hover{background:#222;}
.ag-name-input{font-family:'Archivo',sans-serif;font-weight:700;font-size:.75rem;color:#ddd8ce;background:none;border:none;outline:none;width:90px;border-bottom:1px solid transparent;transition:border-color .15s;}
.ag-name-input:focus{border-bottom-color:#e07b39;}
.ag-desc-input{font-family:'Inconsolata',monospace;font-size:.68rem;color:#666;background:none;border:none;outline:none;flex:1;min-width:120px;border-bottom:1px solid transparent;transition:border-color .15s;}
.ag-desc-input:focus{border-bottom-color:#333;color:#aaa;}
.ag-switch{position:relative;width:30px;height:16px;flex-shrink:0;cursor:pointer;}
.ag-switch input{opacity:0;width:0;height:0;position:absolute;}
.ag-slider{position:absolute;inset:0;background:#2a2a2a;border-radius:8px;transition:.2s;}
.ag-slider:before{content:"";position:absolute;width:10px;height:10px;left:3px;top:3px;background:#555;border-radius:50%;transition:.2s;}
.ag-switch input:checked+.ag-slider{background:#2a1800;}
.ag-switch input:checked+.ag-slider:before{background:#e07b39;transform:translateX(14px);}
.ag-del{font-size:.7rem;background:none;border:none;color:#333;cursor:pointer;padding:.15rem .3rem;border-radius:2px;transition:color .1s;flex-shrink:0;}
.ag-del:hover{color:#f87171;}
.ag-add{font-family:'Archivo',sans-serif;font-weight:700;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;background:#0f0f0f;color:#555;border:1px dashed #2a2a2a;padding:.5rem .75rem;cursor:pointer;border-radius:3px;width:100%;transition:all .15s;margin-top:.25rem;}
.ag-add:hover{color:#ddd8ce;border-color:#444;}
.feed-item{display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem;}
.feed-input{font-family:'Inconsolata',monospace;font-size:.7rem;color:#777;background:none;border:none;outline:none;flex:1;border-bottom:1px solid transparent;transition:border-color .15s;padding:.1rem 0;}
.feed-input:focus{border-bottom-color:#333;color:#aaa;}
.feed-del{font-size:.65rem;background:none;border:none;color:#2a2a2a;cursor:pointer;flex-shrink:0;}
.feed-del:hover{color:#f87171;}
.feed-add{font-size:.65rem;color:#333;background:none;border:none;cursor:pointer;padding:.2rem 0;}
.feed-add:hover{color:#888;}

/* ── AI CODE EDITOR ─────────────────────────────────────────────── */
.chat-history{display:flex;flex-direction:column;gap:.8rem;margin-bottom:1rem;max-height:62vh;overflow-y:auto;padding:.25rem 0;scroll-behavior:smooth;}
.chat-msg{display:flex;flex-direction:column;gap:.25rem;}
.chat-msg.user{align-items:flex-end;}
.chat-msg.assistant{align-items:flex-start;}
.chat-who{font-size:.54rem;letter-spacing:.12em;text-transform:uppercase;color:#444;padding:0 .15rem;}
.chat-bubble{padding:.65rem .85rem;border-radius:3px;font-size:.78rem;line-height:1.7;max-width:92%;white-space:pre-wrap;word-break:break-word;}
.chat-msg.user .chat-bubble{background:#1a1200;border:1px solid #3a2800;color:#ddd8ce;}
.chat-msg.assistant .chat-bubble{background:#111;border:1px solid #1c1c1c;color:#bbb;}
.chat-thinking{background:#111;border:1px solid #1c1c1c;border-radius:3px;padding:.55rem .85rem;font-size:.72rem;color:#e07b39;font-style:italic;}

/* EDIT CARD */
.edit-card{width:100%;background:#0a0f0a;border:1px solid #1a2e1a;border-radius:3px;overflow:hidden;margin-top:.4rem;}
.edit-card-top{display:flex;align-items:center;gap:.5rem;padding:.45rem .7rem;background:#0d160d;border-bottom:1px solid #1a2e1a;flex-wrap:wrap;}
.edit-repo-badge{font-size:.56rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#4ade80;background:#0a1e0a;border:1px solid #1a3a1a;padding:.08rem .35rem;border-radius:2px;flex-shrink:0;}
.edit-path-txt{font-family:'Inconsolata',monospace;font-size:.68rem;color:#888;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.edit-commit-txt{font-family:'Inconsolata',monospace;font-size:.62rem;color:#4ade80;opacity:.7;width:100%;}
.edit-preview-code{font-family:'Inconsolata',monospace;font-size:.62rem;color:#444;padding:.45rem .7rem;max-height:72px;overflow:hidden;white-space:pre;line-height:1.45;border-bottom:1px solid #111;}
.edit-footer{display:flex;align-items:center;gap:.6rem;padding:.45rem .7rem;}
.btn-apply{font-family:'Archivo',sans-serif;font-weight:700;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;background:#0a1e10;color:#4ade80;border:1px solid #1a3a20;padding:.35rem .7rem;cursor:pointer;border-radius:2px;transition:all .15s;flex-shrink:0;}
.btn-apply:hover:not(:disabled){background:#0f2a15;border-color:#2a4a2a;}
.btn-apply:disabled{opacity:.4;cursor:not-allowed;}
.btn-apply.done{background:#0a1e10;color:#4ade80;border-color:#1a3a20;}
.edit-stat{font-size:.63rem;font-family:'Inconsolata',monospace;}
.edit-stat.applying{color:#e07b39;}
.edit-stat.done{color:#4ade80;}
.edit-stat.err{color:#f87171;}

/* CHAT INPUT */
.chat-input-wrap{display:flex;flex-direction:column;gap:.4rem;}
.chat-input-row{display:flex;gap:.5rem;align-items:flex-end;}
.chat-textarea{flex:1;background:#0f0f0f;border:1px solid #1c1c1c;color:#ddd8ce;padding:.6rem .75rem;font-family:'Inconsolata',monospace;font-size:.8rem;outline:none;border-radius:3px;transition:border-color .15s;resize:none;min-height:56px;max-height:200px;}
.chat-textarea:focus{border-color:#e07b39;}
.btn-send{font-family:'Archivo',sans-serif;font-weight:700;font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;background:#e07b39;color:#0d0d0d;padding:0 1rem;border:none;cursor:pointer;border-radius:3px;height:56px;flex-shrink:0;transition:background .12s;min-width:64px;}
.btn-send:hover:not(:disabled){background:#f0904a;}
.btn-send:disabled{background:#2a2a2a;color:#555;cursor:not-allowed;}
.chat-meta{display:flex;justify-content:space-between;align-items:center;}
.chat-hint{font-size:.57rem;color:#333;}
.btn-new-chat{font-size:.6rem;color:#444;background:none;border:none;cursor:pointer;padding:0;}
.btn-new-chat:hover{color:#888;}
.gh-pill{display:inline-flex;align-items:center;gap:.3rem;font-size:.58rem;font-weight:600;letter-spacing:.08em;padding:.15rem .45rem;border-radius:2px;margin-left:.4rem;}
.gh-pill.ok{background:#0a1e0a;color:#4ade80;border:1px solid #1a3a1a;}
.gh-pill.no{background:#1e1200;color:#e07b39;border:1px solid #3a2800;}
.gh-dot{width:5px;height:5px;border-radius:50%;}
.gh-pill.ok .gh-dot{background:#4ade80;}
.gh-pill.no .gh-dot{background:#e07b39;animation:pulse 2s infinite;}

/* GENERAL */
.btn-run{font-family:'Archivo',sans-serif;font-weight:700;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;background:#e07b39;color:#0d0d0d;padding:.55rem 1.1rem;border:none;cursor:pointer;border-radius:3px;transition:background .12s;-webkit-tap-highlight-color:transparent;}
.btn-run:hover{background:#f0904a;}
.btn-run:disabled{background:#2a2a2a;color:#555;cursor:not-allowed;}
`;

const AGENTS_DEFAULT = [
  {id:"analytics", name:"Analytics", emoji:"📊", active:true,  desc:"Tracks platform metrics and feeds the daily standup"},
  {id:"research",  name:"Research",  emoji:"🔍", active:true,  desc:"Market scans, competitor tracking, prospect discovery"},
  {id:"outreach",  name:"Outreach",  emoji:"📣", active:true,  desc:"Drafts cold emails and outreach campaigns for approval"},
  {id:"product",   name:"Product",   emoji:"🔧", active:true,  desc:"Creates feature specs from feedback; triages the backlog"},
  {id:"finance",   name:"Finance",   emoji:"💰", active:true,  desc:"Monitors user financials and triggers critical alerts"},
  {id:"support",   name:"Support",   emoji:"🛟", active:true,  desc:"Catches churn risk and routes feedback to Product"},
  {id:"onboarding",name:"Onboarding",emoji:"🚀", active:true,  desc:"Handles new-signup checklists and activation flows"},
  {id:"strategy",  name:"Strategy",  emoji:"♟", active:false, desc:"Long-term planning; feeds priorities into the backlog"},
];

const FEEDS_IN_DEFAULT = [
  "User feedback → Support → Product → Backlog",
  "Market changes → Research → Backlog + Outreach queue",
  "User financials → Finance → Strategy → Dashboard updates",
  "Platform metrics → Analytics → Your daily standup",
];

const FEEDS_OUT_DEFAULT = [
  "Approved outreach emails → sent to prospects",
  "Approved feature specs → Sprint backlog → Development",
  "Approved financial alerts → user dashboard",
  "Approved intel → competitor tabs refresh",
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const PC = {P0:"p-r",P1:"p-a",P2:"p-b",P3:"p-x"};
const SC = {"Backlog":"p-x","In Progress":"p-a","Done":"p-g","Blocked":"p-r"};
const TC = {"Feature":"p-b","Bug":"p-r","Improvement":"p-a"};

const NAV = [
  {id:"overview",  icon:"⬛", label:"Overview"},
  {id:"standup",   icon:"☀️", label:"Daily Standup",   count:2},
  {id:"board",     icon:"📋", label:"Sprint Board"},
  {id:"review",    icon:"✅", label:"Review Queue",    count:5},
  {id:"planning",  icon:"🗓️", label:"Sprint Planning"},
  {id:"retro",     icon:"🔄", label:"Retrospective"},
  {id:"backlog",   icon:"📦", label:"Product Backlog"},
  {id:"flow",      icon:"♻️", label:"Agent Loop"},
  {id:"ai",        icon:"🤖", label:"AI Assistant"},
];

export default function App() {
  const [view,setView]           = useState("overview");
  const [menuOpen,setMenuOpen]   = useState(false);
  const [backlog,setBacklog]     = useState(BACKLOG);
  const [rstates,setRstates]     = useState({});
  const [selected,setSelected]   = useState([]);
  const [seDay,setSeDay]         = useState(0);
  const [agents,setAgents]       = useState(AGENTS_DEFAULT);
  const [feedsIn,setFeedsIn]     = useState(FEEDS_IN_DEFAULT);
  const [feedsOut,setFeedsOut]   = useState(FEEDS_OUT_DEFAULT);
  const [showConfig,setShowConfig] = useState(false);
  const [emojiEdit,setEmojiEdit] = useState(null);

  // ── AI CODE EDITOR STATE ──
  const [aiInput,setAiInput]     = useState("");
  const [aiRun,setAiRun]         = useState(false);
  const [aiMessages,setAiMessages] = useState([]);
  const [editStatus,setEditStatus] = useState({});
  const chatBottomRef = useRef(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [aiMessages, aiRun]);

  const navigate = (id) => { setView(id); setMenuOpen(false); };
  const sprintItems = backlog.filter(b=>b.sprint===1);
  const donePts     = sprintItems.filter(b=>b.status==="Done").reduce((a,b)=>a+b.pts,0);
  const totalPts    = sprintItems.reduce((a,b)=>a+b.pts,0);
  const pct         = Math.round((SPRINT.dayElapsed/SPRINT.dayTotal)*100);
  const pendingRev  = REVIEW_ITEMS.filter(r=>!rstates[r.id]||rstates[r.id]==="Pending").length;
  const blockers    = STANDUPS[0].agents.filter(a=>a.blocker);

  const toggleSel    = id => setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const commitSprint = () => { setBacklog(bl=>bl.map(b=>selected.includes(b.id)?{...b,sprint:2,status:"In Progress"}:b)); setSelected([]); };

  const toggleAgent = id => setAgents(a=>a.map(ag=>ag.id===id?{...ag,active:!ag.active}:ag));
  const updateAgent = (id,field,val) => setAgents(a=>a.map(ag=>ag.id===id?{...ag,[field]:val}:ag));
  const deleteAgent = id => setAgents(a=>a.filter(ag=>ag.id!==id));
  const addAgent    = () => {
    const id = "agent-"+Date.now();
    setAgents(a=>[...a,{id,name:"New Agent",emoji:"🤖",active:true,desc:"Describe what this agent does"}]);
  };
  const updateFeed = (list,setList,i,val) => setList(l=>l.map((x,j)=>j===i?val:x));
  const deleteFeed = (list,setList,i)     => setList(l=>l.filter((_,j)=>j!==i));
  const addFeed    = (setList)            => setList(l=>[...l,"New connection → destination"]);

  // ── AI SEND ───────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!aiInput.trim() || aiRun) return;
    const userText = aiInput.trim();
    setAiInput("");
    setAiRun(true);

    const newUserMsg = { role:"user", content:userText };
    const history = [...aiMessages, newUserMsg];
    setAiMessages(history);

    // Build API messages from history
    const apiMsgs = history.map(m => ({ role:m.role, content:m.content }));

    try {
      let response = await callClaude(AI_SYS, apiMsgs);
      let workingApiMsgs = [...apiMsgs, { role:"assistant", content:response }];

      // Handle FILE_REQUEST lines
      const fileReqs = parseFileRequests(response);
      if (fileReqs.length > 0) {
        const parts = [];
        for (const req of fileReqs) {
          try {
            const content = await ghRead(req.repo, req.path);
            parts.push(`\n\nFile: ${req.repo}/${req.path}\n\`\`\`jsx\n${content}\n\`\`\``);
          } catch(e) {
            parts.push(`\n\n[Could not read ${req.repo}/${req.path}: ${e.message}]`);
          }
        }
        const fileMsg = `Here are the files you requested:${parts.join("")}\n\nNow please provide your changes.`;
        workingApiMsgs = [...workingApiMsgs, { role:"user", content:fileMsg }];
        response = await callClaude(AI_SYS, workingApiMsgs);
      }

      const edits   = parseEdits(response);
      const display = stripEdits(response);

      setAiMessages(prev => [...prev, {
        role:"assistant",
        content:response,
        display,
        edits,
      }]);
    } catch(e) {
      setAiMessages(prev => [...prev, {
        role:"assistant",
        content:`Error: ${e.message}`,
        display:`Error: ${e.message}`,
        edits:[],
      }]);
    }
    setAiRun(false);
  };

  const applyEdit = async (edit, key) => {
    setEditStatus(s=>({...s,[key]:"applying"}));
    try {
      await ghWrite(edit.repo, edit.path, edit.content, edit.commit);
      setEditStatus(s=>({...s,[key]:"done"}));
    } catch(e) {
      setEditStatus(s=>({...s,[key]:"err:"+e.message}));
    }
  };

  const resetChat = () => { setAiMessages([]); setEditStatus({}); setAiInput(""); };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">

        {/* TOP BAR */}
        <div className="bar">
          <button className="nav-toggle" onClick={()=>setMenuOpen(!menuOpen)}>☰</button>
          <div className="logo">Trade<b>Stack</b> <span style={{color:"#444",fontSize:".6rem",fontWeight:300}}>/ Admin</span></div>
          <div className="sbadge"><div className="sdot"/>S{SPRINT.num} · Day {SPRINT.dayElapsed}/{SPRINT.dayTotal}</div>
        </div>

        {/* OVERLAY */}
        <div className={`overlay ${menuOpen?"show":""}`} onClick={()=>setMenuOpen(false)}/>

        <div className="layout">

          {/* SIDEBAR */}
          <div className={`sidebar ${menuOpen?"open":""}`}>
            <div className="snlbl">Scrum Events</div>
            {NAV.map(n=>(
              <button key={n.id} className={`snbtn ${view===n.id?"on":""}`} onClick={()=>navigate(n.id)}>
                <span className="snbi">{n.icon}</span>
                <span className="snbl">{n.label}</span>
                {n.count>0&&<span className="sncnt">{n.count}</span>}
              </button>
            ))}
          </div>

          {/* MAIN */}
          <div className="main">

            {/* OVERVIEW */}
            {view==="overview"&&<>
              <div className="sh"><div className="st">Sprint {SPRINT.num} Overview</div><div className="sl"/></div>
              <div className="ss">{SPRINT.start} → {SPRINT.end} · You are Scrum Master</div>
              <div className="g4" style={{marginBottom:"1rem"}}>
                {[
                  {v:"7",l:"Active Users",d:"+2 this week",up:true},
                  {v:`${donePts}/${totalPts}`,l:"Story Points",d:`${sprintItems.filter(b=>b.status==="Done").length}/${sprintItems.length} tickets`,up:null},
                  {v:String(pendingRev),l:"Awaiting Review",d:"Need your decision",up:false},
                  {v:String(backlog.filter(b=>!b.sprint).length),l:"Backlog Items",d:"Sprint 2 ready",up:null},
                ].map((s,i)=>(
                  <div key={i} className="card">
                    <div className="stat-v">{s.v}</div>
                    <div className="stat-l">{s.l}</div>
                    <div className={`stat-d ${s.up===true?"dup":s.up===false?"ddn":"dfl"}`}>{s.d}</div>
                  </div>
                ))}
              </div>
              <div className="card" style={{marginBottom:"1rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".4rem"}}>
                  <span style={{fontFamily:"'Archivo',sans-serif",fontWeight:700,fontSize:".72rem",color:"#888"}}>Sprint Progress</span>
                  <span style={{fontSize:".65rem",color:"#e07b39"}}>{pct}% elapsed · {Math.round((donePts/totalPts)*100)}% done</span>
                </div>
                <div className="sbar-wrap"><div className="sbar-fill" style={{width:`${pct}%`}}/></div>
                <div className="tick-row">
                  {sprintItems.map(t=>(
                    <div key={t.id} className="tick" style={{background:t.status==="Done"?"#4ade80":t.status==="In Progress"?"#e07b39":"#2a2a2a"}} title={t.title}/>
                  ))}
                </div>
              </div>
              <div className="g2">
                <div className="card">
                  <div style={{fontFamily:"'Archivo',sans-serif",fontWeight:700,fontSize:".72rem",color:"#888",marginBottom:".65rem"}}>Today's Blockers</div>
                  {blockers.length===0
                    ? <div style={{color:"#4ade80",fontSize:".7rem"}}>No blockers</div>
                    : blockers.map((a,i)=><div key={i} className="blk-item"><strong style={{color:"#f87171"}}>{a.name}:</strong> {a.blocker}</div>)}
                </div>
                <div className="card">
                  <div style={{fontFamily:"'Archivo',sans-serif",fontWeight:700,fontSize:".72rem",color:"#888",marginBottom:".65rem"}}>Sprint Goals</div>
                  {sprintItems.map(t=>(
                    <div key={t.id} style={{display:"flex",alignItems:"flex-start",gap:".45rem",marginBottom:".35rem"}}>
                      <span style={{fontSize:".7rem",flexShrink:0}}>{t.status==="Done"?"[x]":t.status==="In Progress"?"[~]":"[ ]"}</span>
                      <span style={{fontSize:".7rem",color:t.status==="Done"?"#4ade80":"#888",lineHeight:1.4}}>{t.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>}

            {/* STANDUP */}
            {view==="standup"&&<>
              <div className="sh"><div className="st">Daily Standup</div><div className="sl"/></div>
              <div className="ss">Each agent reports: what they did, doing, and what's blocking them</div>
              <div className="sdup-tabs">
                {STANDUPS.map((s,i)=><button key={i} className={`sdup-tab ${sdDay===i?"on":""}`} onClick={()=>setSdDay(i)}>{s.date}</button>)}
              </div>
              <div className="card">
                {STANDUPS[sdDay].agents.map((a,i)=>(
                  <div key={i} className="sr">
                    <div className={`si ${a.s==="green"?"sig":a.s==="amber"?"sia":"sir"}`}/>
                    <div className="sava">{a.emoji}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="san">{a.name} Agent</div>
                      <div className="sau">{a.update}</div>
                      {a.blocker&&<div className="sblk">{a.blocker}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>}

            {/* BOARD */}
            {view==="board"&&<>
              <div className="sh"><div className="st">Sprint Board</div><div className="sl"/></div>
              <div className="ss">Sprint {SPRINT.num} — scroll right to see all columns</div>
              <div className="board-wrap">
                <div className="board">
                  {["Backlog","In Progress","Review","Done"].map(col=>{
                    const items = backlog.filter(b=>b.sprint===1&&b.status===col);
                    return (
                      <div key={col} className="bcol">
                        <div className="bcolh">{col}<span>{items.length}</span></div>
                        {items.map(t=>(
                          <div key={t.id} className="ticket">
                            <div className="t-id">{t.id}</div>
                            <div className="t-title">{t.title}</div>
                            <div className="t-meta">
                              <span className={`pill ${PC[t.priority]}`}>{t.priority}</span>
                              <span className={`pill ${TC[t.type]}`}>{t.type}</span>
                              <span className="pill p-x">{t.pts}pt</span>
                            </div>
                            <div className="t-src">via {t.source}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>}

            {/* REVIEW */}
            {view==="review"&&<>
              <div className="sh"><div className="st">Review Queue</div><div className="sl"/></div>
              <div className="ss">Every agent output lands here. You approve, reject, or edit before anything happens.</div>
              {REVIEW_ITEMS.map(item=>{
                const state = rstates[item.id];
                return (
                  <div key={item.id} className="ri">
                    <div className="ri-hdr">
                      <div style={{fontSize:"1.1rem"}}>{item.emoji}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div className="ri-title">{item.title}</div>
                        <div className="ri-meta">
                          <span className="pill p-x">{item.agent} Agent</span>
                          <span className={`pill ${item.urgency==="High"?"p-r":"p-x"}`}>{item.urgency}</span>
                        </div>
                      </div>
                    </div>
                    <div className="ri-pre">{item.preview}</div>
                    <div className="ri-acts">
                      {!state||state==="Pending"
                        ? <><button className="bapp" onClick={()=>setRstates(s=>({...s,[item.id]:"Approved"}))}>Approve</button>
                            <button className="brej" onClick={()=>setRstates(s=>({...s,[item.id]:"Rejected"}))}>Reject</button>
                            <button className="bedt">Edit</button></>
                        : <span style={{fontSize:".65rem",color:state==="Approved"?"#4ade80":"#f87171"}}>
                            {state==="Approved"?"Approved — queued for action":"Rejected — returned to agent"}
                          </span>}
                    </div>
                  </div>
                );
              })}
            </>}

            {/* PLANNING */}
            {view==="planning"&&<>
              <div className="sh"><div className="st">Sprint Planning</div><div className="sl"/></div>
              <div className="ss">Select backlog items for Sprint 2. You set scope — agents execute.</div>
              <div className="card" style={{marginBottom:"1rem"}}>
                <div style={{fontFamily:"'Archivo',sans-serif",fontWeight:700,fontSize:".72rem",color:"#888",marginBottom:".25rem"}}>
                  Sprint 2 · Selected: {selected.reduce((a,id)=>a+(backlog.find(b=>b.id===id)?.pts||0),0)} story points
                </div>
                <div style={{fontSize:".68rem",color:"#555"}}>Sprint 1 velocity: {donePts} pts. Match or go slightly under.</div>
              </div>
              {backlog.filter(b=>!b.sprint).sort((a,b)=>a.priority.localeCompare(b.priority)).map(item=>(
                <div key={item.id} className={`pi ${selected.includes(item.id)?"sel":""}`} onClick={()=>toggleSel(item.id)}>
                  <div className="pichk">{selected.includes(item.id)?"✓":""}</div>
                  <div className="pi-id">{item.id}</div>
                  <div className="pi-title">{item.title}</div>
                  <span className={`pill ${PC[item.priority]}`}>{item.priority}</span>
                  <div className="pi-pts">{item.pts}pt</div>
                </div>
              ))}
              {selected.length>0&&<button className="btn-run" style={{marginTop:".75rem"}} onClick={commitSprint}>Commit {selected.length} Items to Sprint 2 →</button>}
            </>}

            {/* RETRO */}
            {view==="retro"&&<>
              <div className="sh"><div className="st">Retrospective</div><div className="sl"/></div>
              <div className="ss">Sprint {SPRINT.num} reflection — what worked, what broke, what changes next sprint</div>
              <div className="retro-grid">
                {RETRO.map((col,i)=>(
                  <div key={i} className="rcol">
                    <div className={`rcol-h ${col.cls}`}>{col.head}</div>
                    {col.items.map((item,j)=><div key={j} className="ritem">{item}</div>)}
                  </div>
                ))}
              </div>
            </>}

            {/* BACKLOG */}
            {view==="backlog"&&<>
              <div className="sh"><div className="st">Product Backlog</div><div className="sl"/></div>
              <div className="ss">All requirements ordered by priority. Agents add items continuously.</div>
              {backlog.sort((a,b)=>a.priority.localeCompare(b.priority)).map(item=>(
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:".5rem",padding:".55rem .7rem",background:"#111",border:"1px solid #1c1c1c",borderRadius:"3px",marginBottom:".35rem",flexWrap:"wrap"}}>
                  <span style={{fontSize:".58rem",color:"#444",width:"40px",flexShrink:0}}>{item.id}</span>
                  <span style={{fontFamily:"'Archivo',sans-serif",fontWeight:600,fontSize:".72rem",color:"#ccc",flex:1,minWidth:"120px"}}>{item.title}</span>
                  <span className={`pill ${PC[item.priority]}`}>{item.priority}</span>
                  <span className={`pill ${TC[item.type]}`}>{item.type}</span>
                  <span className={`pill ${SC[item.status]}`}>{item.status}</span>
                  <span style={{fontSize:".62rem",color:"#555"}}>{item.pts}pt</span>
                </div>
              ))}
            </>}

            {/* AGENT LOOP */}
            {view==="flow"&&<>
              <div className="sh"><div className="st">Circular Agent Loop</div><div className="sl"/></div>
              <div className="ss">Agents feed each other every sprint — nothing terminates, everything loops back into the backlog</div>
              <div className="card" style={{marginBottom:".75rem"}}>
                <div className="flow">
                  {agents.map((ag,i)=>[
                    <div key={ag.id} className={`fn ${ag.active?"act":""}`} style={!ag.active?{opacity:.35}:{}}>
                      <div className="fn-e">{ag.emoji}</div>
                      <div className="fn-n">{ag.name}</div>
                    </div>,
                    i<agents.length-1&&<div key={ag.id+"-arr"} className="farrow">→</div>
                  ])}
                  {agents.length>1&&<div className="farrow">↩</div>}
                  <div className="fn own"><div className="fn-e">🧑</div><div className="fn-n">You (SM)</div></div>
                </div>
              </div>
              <div className="ag-toggle">
                <button className={`ag-toggle-btn ${showConfig?"active":""}`} onClick={()=>setShowConfig(s=>!s)}>
                  {showConfig?"▲ Hide Config":"⚙ Configure Agents"}
                </button>
                {showConfig&&<span style={{fontSize:".62rem",color:"#555"}}>Click any field to edit · Changes update the loop above</span>}
              </div>
              {showConfig&&<>
                <div className="card" style={{marginBottom:".75rem"}}>
                  <div style={{fontFamily:"'Archivo',sans-serif",fontWeight:700,fontSize:".72rem",color:"#888",marginBottom:".75rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    Agents
                    <span style={{fontSize:".6rem",color:"#444",fontFamily:"'Inconsolata',monospace",fontWeight:300}}>{agents.filter(a=>a.active).length} active · {agents.filter(a=>!a.active).length} inactive</span>
                  </div>
                  {agents.map(ag=>(
                    <div key={ag.id} className={`ag-row ${!ag.active?"inactive":""}`}>
                      {emojiEdit===ag.id
                        ? <input autoFocus style={{width:"2.5rem",fontSize:"1rem",background:"#1a1a1a",border:"1px solid #e07b39",borderRadius:"2px",color:"#ddd8ce",textAlign:"center",padding:".1rem"}}
                            defaultValue={ag.emoji}
                            onBlur={e=>{updateAgent(ag.id,"emoji",e.target.value.trim()||ag.emoji);setEmojiEdit(null);}}
                            onKeyDown={e=>{if(e.key==="Enter"){updateAgent(ag.id,"emoji",e.target.value.trim()||ag.emoji);setEmojiEdit(null);}}}/>
                        : <button className="ag-emoji-btn" title="Click to change emoji" onClick={()=>setEmojiEdit(ag.id)}>{ag.emoji}</button>
                      }
                      <input className="ag-name-input" value={ag.name} onChange={e=>updateAgent(ag.id,"name",e.target.value)} placeholder="Agent name"/>
                      <input className="ag-desc-input" value={ag.desc} onChange={e=>updateAgent(ag.id,"desc",e.target.value)} placeholder="What does this agent do?"/>
                      <label className="ag-switch" title={ag.active?"Disable":"Enable"}>
                        <input type="checkbox" checked={ag.active} onChange={()=>toggleAgent(ag.id)}/>
                        <span className="ag-slider"/>
                      </label>
                      <button className="ag-del" title="Remove agent" onClick={()=>deleteAgent(ag.id)}>✕</button>
                    </div>
                  ))}
                  <button className="ag-add" onClick={addAgent}>+ Add Agent</button>
                </div>
                <div className="g2">
                  <div className="card">
                    <div style={{fontFamily:"'Archivo',sans-serif",fontWeight:700,fontSize:".72rem",color:"#888",marginBottom:".65rem"}}>Feeds INTO the loop</div>
                    {feedsIn.map((item,i)=>(
                      <div key={i} className="feed-item">
                        <span style={{color:"#333",fontSize:".7rem",flexShrink:0}}>→</span>
                        <input className="feed-input" value={item} onChange={e=>updateFeed(feedsIn,setFeedsIn,i,e.target.value)}/>
                        <button className="feed-del" onClick={()=>deleteFeed(feedsIn,setFeedsIn,i)}>✕</button>
                      </div>
                    ))}
                    <button className="feed-add" onClick={()=>addFeed(setFeedsIn)}>+ Add input</button>
                  </div>
                  <div className="card">
                    <div style={{fontFamily:"'Archivo',sans-serif",fontWeight:700,fontSize:".72rem",color:"#888",marginBottom:".65rem"}}>Feeds OUT of the loop</div>
                    {feedsOut.map((item,i)=>(
                      <div key={i} className="feed-item">
                        <span style={{color:"#333",fontSize:".7rem",flexShrink:0}}>→</span>
                        <input className="feed-input" value={item} onChange={e=>updateFeed(feedsOut,setFeedsOut,i,e.target.value)}/>
                        <button className="feed-del" onClick={()=>deleteFeed(feedsOut,setFeedsOut,i)}>✕</button>
                      </div>
                    ))}
                    <button className="feed-add" onClick={()=>addFeed(setFeedsOut)}>+ Add output</button>
                  </div>
                </div>
              </>}
              {!showConfig&&<div className="g2">
                {[
                  {title:"Feeds INTO the loop",items:feedsIn},
                  {title:"Feeds OUT of the loop",items:feedsOut},
                ].map((col,i)=>(
                  <div key={i} className="card">
                    <div style={{fontFamily:"'Archivo',sans-serif",fontWeight:700,fontSize:".72rem",color:"#888",marginBottom:".65rem"}}>{col.title}</div>
                    {col.items.map((it,j)=><div key={j} style={{display:"flex",gap:".4rem",fontSize:".7rem",color:"#777",lineHeight:1.55,marginBottom:".3rem"}}><span style={{color:"#333"}}>→</span>{it}</div>)}
                  </div>
                ))}
              </div>}
            </>}

            {/* AI CODE EDITOR */}
            {view==="ai"&&<>
              <div className="sh">
                <div className="st">AI Code Editor</div>
                <div className="sl"/>
              </div>
              <div className="ss">
                Chat with Claude to edit this admin or the main TradeStack site. Changes push live to GitHub — Vercel builds in ~10s.
                {GH_TOKEN
                  ? <span className="gh-pill ok"><span className="gh-dot"/>GitHub connected</span>
                  : <span className="gh-pill no"><span className="gh-dot"/>Add VITE_GITHUB_TOKEN in Vercel to enable pushes</span>}
              </div>

              {/* Chat history */}
              {aiMessages.length > 0 && (
                <div className="chat-history">
                  {aiMessages.map((msg,i)=>(
                    <div key={i} className={`chat-msg ${msg.role}`}>
                      <span className="chat-who">{msg.role==="user"?"You":"Claude"}</span>
                      {(msg.display||msg.content)&&(
                        <div className="chat-bubble">{msg.display||msg.content}</div>
                      )}
                      {msg.edits&&msg.edits.length>0&&msg.edits.map((edit,j)=>{
                        const key = `${i}-${j}`;
                        const st  = editStatus[key];
                        const isDone = st==="done";
                        const isApplying = st==="applying";
                        const isErr = st&&st.startsWith("err:");
                        return (
                          <div key={j} className="edit-card">
                            <div className="edit-card-top">
                              <span className="edit-repo-badge">{edit.repo}</span>
                              <span className="edit-path-txt">{edit.path}</span>
                              <span className="edit-commit-txt">{edit.commit}</span>
                            </div>
                            <div className="edit-preview-code">{edit.content.slice(0,300)}</div>
                            <div className="edit-footer">
                              <button
                                className={`btn-apply ${isDone?"done":""}`}
                                disabled={!GH_TOKEN||isApplying||isDone}
                                onClick={()=>applyEdit(edit,key)}
                              >
                                {isDone?"✓ Applied":isApplying?"Pushing…":"↑ Push to GitHub"}
                              </button>
                              {st&&(
                                <span className={`edit-stat ${isDone?"done":isApplying?"applying":isErr?"err":""}`}>
                                  {isDone?"Vercel is building…":isApplying?"":isErr?st.replace("err:",""):st}
                                </span>
                              )}
                              {!GH_TOKEN&&<span className="edit-stat" style={{color:"#555"}}>Add VITE_GITHUB_TOKEN to push</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {aiRun&&(
                    <div className="chat-msg assistant">
                      <span className="chat-who">Claude</span>
                      <div className="chat-thinking">Thinking…</div>
                    </div>
                  )}
                  <div ref={chatBottomRef}/>
                </div>
              )}

              {/* Input */}
              <div className="chat-input-wrap">
                <div className="chat-input-row">
                  <textarea
                    className="chat-textarea"
                    rows={2}
                    placeholder={aiMessages.length===0
                      ? "Try: \"Fix the emoji encoding corruption in the admin\"\nOr: \"Make the main site text more readable — better contrast\"\nOr: \"The desktop layout is too zoomed out, fix it\""
                      : "Continue the conversation…"}
                    value={aiInput}
                    onChange={e=>setAiInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)){e.preventDefault();sendMessage();}}}
                  />
                  <button className="btn-send" disabled={aiRun||!aiInput.trim()} onClick={sendMessage}>
                    {aiRun?"…":"Send"}
                  </button>
                </div>
                <div className="chat-meta">
                  <span className="chat-hint">Cmd+Enter to send · Claude reads files from GitHub automatically</span>
                  {aiMessages.length>0&&(
                    <button className="btn-new-chat" onClick={resetChat}>↺ New chat</button>
                  )}
                </div>
              </div>
            </>}

          </div>
        </div>
      </div>
    </>
  );
}
