const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const FIRECRAWL_KEY = process.env.FIRECRAWL_KEY;
const ANTHROPIC_KEY = process.env.API_Anthropic;
const SERVER_VERSION = 'v28d';

// ── NUTZER & PASSWÖRTER ────────────────────────────────────────
const USERS = {
  'MW-rb2024': 'Ralf',
  'MW-jb5817': 'Jonathan',
  'MW-tb3392': 'Thorben',
  'MW-hf7741': 'Holger',
  'MW-ag4156': 'Antonios',
  'MW-ng8823': 'Nasir',
  'MW-jh6634': 'Jörg',
  'MW-dm2291': 'Daniel',
  'MW-dv5478': 'Dusan',
  'MW-wg9912': 'Walter',
  'MW-mm3367': 'Michael',
  'MW-rb7754': 'Robin'
};



// ── GOOGLE SHEETS LOGGING ──────────────────────────────────────
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) : null;

async function getGoogleToken() {
  if (!SERVICE_ACCOUNT) return null;
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: SERVICE_ACCOUNT.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600, iat: now
    })).toString('base64url');
    const { createSign } = require('crypto');
    const sign = createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const sig = sign.sign(SERVICE_ACCOUNT.private_key, 'base64url');
    const jwt = `${header}.${payload}.${sig}`;
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
    });
    const data = await resp.json();
    return data.access_token || null;
  } catch(e) { console.log('Google token error:', e.message); return null; }
}

async function logToSheets(nutzer, aktion, plz, projekte, firmen, projektnamen, firmennamen) {
  if (!SHEET_ID || !SERVICE_ACCOUNT) return;
  try {
    const token = await getGoogleToken();
    if (!token) return;
    const now = new Date();
    const berlin = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const uhrzeitStr = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(now);
    const row = [
      berlin,
      uhrzeitStr,
      nutzer,
      plz || '–',
      aktion,
      projekte ?? '–',
      firmen ?? '–',
      projektnamen || '–',
      firmennamen || '–'
    ];
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A1:I1:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    });
  } catch(e) { console.log('Sheets log error:', e.message); }
}

// Spaltenköpfe beim Start setzen
async function initSheet() {
  if (!SHEET_ID || !SERVICE_ACCOUNT) return;
  try {
    const token = await getGoogleToken();
    if (!token) return;
    const check = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await check.json();
    if (!data.values) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A1:I1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [['Datum', 'Uhrzeit', 'Nutzer', 'PLZ', 'Aktion', 'Projekte', 'Firmen', 'Projektnamen', 'Firmennamen']] })
      });
    }
  } catch(e) { console.log('Sheet init error:', e.message); }
}

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── AUTH ENDPOINT ──────────────────────────────────────────────
app.post('/api/auth', async (req, res) => {
  const { password } = req.body;
  const nutzer = USERS[password];
  if (!nutzer) return res.json({ error: 'Ungültiges Passwort.' });
  await logToSheets(nutzer, 'Login', null, null, null);
  return res.json({ ok: true, nutzer });
});

initSheet();

const PLZ_MAP = {
  '01':['Dresden','Meißen','Radebeul'],'02':['Görlitz','Bautzen','Zittau'],'03':['Cottbus','Spremberg'],
  '04':['Leipzig','Borna','Grimma'],'06':['Halle','Merseburg','Dessau'],'07':['Erfurt','Jena','Weimar','Gera'],
  '08':['Chemnitz','Zwickau','Plauen'],'09':['Chemnitz','Freiberg','Mittweida'],
  '10':['Berlin-Mitte','Berlin-Tiergarten'],'11':['Berlin'],'12':['Berlin-Tempelhof','Berlin-Neukölln'],
  '13':['Berlin-Wedding','Berlin-Reinickendorf'],'14':['Berlin-Charlottenburg','Potsdam'],
  '15':['Potsdam','Königs Wusterhausen'],'16':['Oranienburg','Neuruppin','Bernau'],
  '17':['Neubrandenburg','Greifswald'],'18':['Rostock','Wismar','Stralsund'],
  '19':['Schwerin','Ludwigslust'],'20':['Hamburg-Mitte'],'21':['Hamburg-Harburg','Lüneburg','Stade'],
  '22':['Hamburg-Eimsbüttel','Hamburg-Altona'],'23':['Lübeck','Ratzeburg'],
  '24':['Kiel','Neumünster'],'25':['Heide','Itzehoe'],'26':['Oldenburg','Wilhelmshaven'],
  '27':['Bremerhaven','Cuxhaven'],'28':['Bremen'],'29':['Celle','Uelzen'],
  '30':['Hannover','Langenhagen'],'31':['Hildesheim','Hameln'],'32':['Herford','Minden'],
  '33':['Bielefeld','Paderborn','Gütersloh'],'34':['Kassel'],'35':['Marburg','Gießen','Wetzlar'],
  '36':['Fulda'],'37':['Göttingen'],'38':['Braunschweig','Wolfsburg','Salzgitter'],
  '39':['Magdeburg'],'40':['Düsseldorf','Ratingen'],'41':['Mönchengladbach','Krefeld','Neuss'],
  '42':['Wuppertal','Remscheid','Solingen'],'44':['Dortmund','Lünen'],
  '45':['Essen','Gelsenkirchen','Mülheim'],'46':['Oberhausen','Wesel'],
  '47':['Duisburg','Kleve','Moers'],'48':['Münster','Osnabrück'],
  '49':['Osnabrück','Lingen'],'50':['Köln','Brühl','Pulheim','Frechen','Hürth'],
  '51':['Köln-Porz','Bergisch Gladbach','Leverkusen'],'52':['Aachen','Eschweiler','Stolberg'],
  '53':['Bonn','Siegburg','Sankt Augustin','Troisdorf'],'54':['Trier','Bitburg'],
  '55':['Mainz','Worms','Bad Kreuznach'],'56':['Koblenz','Neuwied','Andernach'],
  '57':['Siegen','Olpe'],'58':['Hagen','Iserlohn','Lüdenscheid'],
  '59':['Hamm','Soest','Arnsberg'],'60':['Frankfurt-Innenstadt','Frankfurt-Nordend'],
  '61':['Bad Homburg','Friedberg','Oberursel'],'63':['Offenbach','Hanau'],
  '64':['Darmstadt','Rüsselsheim'],'65':['Wiesbaden'],'66':['Saarbrücken'],
  '67':['Ludwigshafen','Mannheim'],'68':['Mannheim','Heidelberg'],
  '69':['Heidelberg','Weinheim'],'70':['Stuttgart','Fellbach'],
  '71':['Ludwigsburg','Waiblingen'],'72':['Tübingen','Reutlingen'],
  '73':['Esslingen','Göppingen'],'74':['Heilbronn','Neckarsulm'],
  '75':['Pforzheim'],'76':['Karlsruhe','Baden-Baden'],
  '77':['Offenburg','Lahr'],'78':['Konstanz','Villingen-Schwenningen'],
  '79':['Freiburg'],'80':['München-Schwabing','München-Innenstadt'],
  '81':['München-Bogenhausen'],'82':['München-Süd','Starnberg','Germering'],
  '83':['Rosenheim'],'84':['Landshut'],'85':['Ingolstadt','Freising'],
  '86':['Augsburg'],'87':['Kempten'],'88':['Ravensburg','Friedrichshafen'],
  '89':['Ulm','Neu-Ulm'],'90':['Nürnberg','Fürth','Erlangen'],
  '91':['Schwabach','Ansbach'],'92':['Amberg','Weiden'],
  '93':['Regensburg'],'94':['Passau'],'95':['Bayreuth','Hof'],
  '96':['Bamberg','Coburg'],'97':['Würzburg','Schweinfurt'],
  '98':['Suhl'],'99':['Erfurt','Gotha','Eisenach']
};

function parsePlzInput(input) {
  input = input.trim();
  const prefixes = new Set();
  const parts = input.split(/[,\s]+/);
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-');
      const s = parseInt(start.substring(0,2)), e = parseInt(end.substring(0,2));
      if (!isNaN(s) && !isNaN(e)) for (let i=s; i<=e; i++) prefixes.add(String(i).padStart(2,'0'));
    } else if (part.match(/^\d+$/)) {
      prefixes.add(part.substring(0,2).padStart(2,'0'));
    }
  }
  const orte = new Set();
  prefixes.forEach(p => (PLZ_MAP[p]||[]).forEach(o => orte.add(o)));
  return { prefixes: [...prefixes], orte: [...orte] };
}

function getDateRange() {
  const now = new Date();
  const from12 = new Date(now); from12.setMonth(from12.getMonth()-12);
  const from10 = new Date(now); from10.setMonth(from10.getMonth()-10);
  const plus6 = new Date(now); plus6.setMonth(plus6.getMonth()+6);
  const M = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  return {
    today: `${M[now.getMonth()]} ${now.getFullYear()}`,
    from12: `${M[from12.getMonth()]} ${from12.getFullYear()}`,
    from10: `${M[from10.getMonth()]} ${from10.getFullYear()}`,
    plus6: `${M[plus6.getMonth()]} ${plus6.getFullYear()}`,
    range12: `${M[from12.getMonth()]} ${from12.getFullYear()} bis ${M[now.getMonth()]} ${now.getFullYear()}`,
    range10: `${M[from10.getMonth()]} ${from10.getFullYear()} bis ${M[now.getMonth()]} ${now.getFullYear()}`
  };
}

// ── BRAVE SEARCH ─────────────────────────────────────────────────
const BRAVE_KEY = process.env.Brave_Search_API;

async function braveSearch(query, limit = 5) {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', Math.min(limit, 10));
  url.searchParams.set('country', 'de');
  url.searchParams.set('search_lang', 'de');
  url.searchParams.set('freshness', 'py');
  const resp = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': BRAVE_KEY }
  });
  if (!resp.ok) throw new Error(`Brave API error: ${resp.status}`);
  const data = await resp.json();
  return data.web?.results || [];
}

// Vorfilter: URL-Deduplizierung, Jahresdatum-Filter, Formatierung
function filterAndFormatResults(resultsArrays, yearFilter = true) {
  const seenUrls = new Set();
  const seenDomains = new Map();
  const yearRegex = /202[5-9]|203[0-9]/;
  const filtered = resultsArrays.flat().filter(r => {
    if (!r || !r.url) return false;
    if (seenUrls.has(r.url)) return false;
    seenUrls.add(r.url);
    const domain = r.url.replace(/^https?:\/\//, '').split('/')[0];
    const cnt = (seenDomains.get(domain) || 0) + 1;
    seenDomains.set(domain, cnt);
    if (cnt > 2) return false;
    if (yearFilter) {
      const text = `${r.title||''} ${r.description||''}`;
      if (!yearRegex.test(text)) return false;
    }
    return true;
  });
  return filtered.map(r => `[${r.title||''}](${r.url||''})\n${r.description||''}`).join('\n\n---\n\n').substring(0, 28000);
}

// Alias für Rückwärtskompatibilität (profile searches etc.)
const firecrawlSearch = async (query, limit) => {
  const results = await braveSearch(query, limit);
  return results.map(r => `[${r.title||''}](${r.url||''})\n${r.description||''}`).join('\n\n---\n\n').substring(0, 1800);
};

// ── FIRECRAWL SCRAPE (gezieltes URL-Scraping) ─────────────────
async function firecrawlScrape(url, maxChars = 30000) {
  if (!FIRECRAWL_KEY) return '';
  try {
    const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FIRECRAWL_KEY}` },
      body: JSON.stringify({ url, formats: ['markdown'] })
    });
    const data = await resp.json();
    return (data.data?.markdown || '').substring(0, maxChars);
  } catch(e) { return ''; }
}


async function claudeSonnet(apiKey, system, userMsg, maxTokens = 2000) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, system, messages: [{ role: 'user', content: userMsg }] })
  });
  const data = await resp.json();
  if (data.error?.type === 'overloaded_error') throw new Error('overloaded');
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

async function claudeHaiku(apiKey, system, userMsg, maxTokens = 1500) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, system, messages: [{ role: 'user', content: userMsg }] })
  });
  const data = await resp.json();
  if (data.error?.type === 'overloaded_error') throw new Error('overloaded');
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

// ── TEST ENDPOINT ───────────────────────────────────────────────
app.get('/api/test', async (req, res) => {
  const key = BRAVE_KEY;
  if (!key) return res.json({ status: 'ERROR', message: 'Brave_Search_API not set' });
  try {
    const result = await braveSearch('Köln GmbH Büro 2026', 2);
    return res.json({ status: 'OK', keySet: true, resultLength: result.length, preview: result.substring(0,300) });
  } catch(err) {
    return res.json({ status: 'ERROR', message: err.message, keySet: !!key });
  }
});

// ── REGION RESOLVER ─────────────────────────────────────────────
async function getRegionAndCities(apiKey, plzPrefixes, orte) {
  const text = await claudeHaiku(apiKey, '',
    `Du bekommst PLZ-Präfixe und Städtenamen einer deutschen Region. Gib NUR ein JSON-Objekt zurück. Der Regionsbegriff muss ein einzelnes gebräuchliches Wort oder kurzer zusammengesetzter Begriff sein der als Google-Suchbegriff funktioniert (z.B. Rheinland, Ruhrgebiet, Rhein-Main, Schwaben, Franken) – KEIN "und", KEINE Kombination mehrerer Regionen.
PLZ-Präfixe: ${plzPrefixes.join(', ')}
Städte: ${orte.slice(0,30).join(', ')}

{"region":"Rheinland","top_staedte":["Köln","Bonn","Aachen"],"hidden_champion":"Leverkusen"}`,
    300
  );
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch(e) {} }
  return { region: orte[0], top_staedte: orte.slice(0,3), hidden_champion: orte[3] || '' };
}

// ── PLZ RESOLVE ─────────────────────────────────────────────────
app.post('/api/plz', async (req, res) => {
  const { plz } = req.body; const apiKey = ANTHROPIC_KEY;
  if (!plz) return res.status(400).json({ error: 'Missing plz' });
  const result = parsePlzInput(plz);
  if (!result.orte.length) return res.json({ error: 'PLZ-Bereich nicht erkannt.' });

  // Resolve region and key cities immediately
  let regionData = { region: result.orte[0], top_staedte: result.orte.slice(1,4), hidden_champion: result.orte[4]||'' };
  if (apiKey) {
    try {
      regionData = await getRegionAndCities(apiKey, result.prefixes, result.orte);
    } catch(e) {}
  }

  // 2 große + 2 wirtschaftsstarke + 3 zufällig
  const grosse = regionData.top_staedte.slice(0, 2);
  const wirtschaftsstarke = [regionData.hidden_champion, regionData.top_staedte[2]].filter(Boolean);
  const restOrte = result.orte.filter(o => !grosse.includes(o) && !wirtschaftsstarke.includes(o));
  const shuffled = restOrte.slice().sort(() => Math.random() - 0.5);
  const selectedOrte = [...new Set([...grosse, ...wirtschaftsstarke, ...shuffled.slice(0, 3)])];

  return res.json({ orte: result.orte, prefixes: result.prefixes, regionData, selectedOrte });
});

// ── PROJECT SEARCH ───────────────────────────────────────────────
app.post('/api/projects', async (req, res) => {
  const { orte, plzPrefixes, strictness, password } = req.body; const apiKey = ANTHROPIC_KEY;
  if (!apiKey || !orte?.length) return res.status(400).json({ error: 'Missing params' });
  const nutzer = USERS[password] || 'unbekannt';
  const dates = getDateRange();
  const region = orte.slice(0,4).join(', ');
  const allOrte = orte.join(', ');

  try {
    console.log('Starting project search for', orte.slice(0,3));
    // Resolve region and key cities
    let regionData;
    try {
      regionData = await getRegionAndCities(apiKey, plzPrefixes||[], orte);
    } catch(e) {
      console.log('Region resolver error:', e.message);
      regionData = { region: orte[0]||'Köln', top_staedte: orte.slice(1,4), hidden_champion: orte[4]||'' };
    }
    console.log('Region resolved:', JSON.stringify(regionData));
    const { region, top_staedte, hidden_champion } = regionData;
    // 2 große + 2 wirtschaftsstarke + 3 zufällig aus dem Rest
    const grosse = top_staedte.slice(0, 2);
    const wirtschaftsstarke = [hidden_champion, top_staedte[2]].filter(Boolean);
    const restOrte = orte.filter(o => !grosse.includes(o) && !wirtschaftsstarke.includes(o));
    // Fisher-Yates shuffle für zufällige Auswahl
    const shuffled = restOrte.slice().sort(() => Math.random() - 0.5);
    const zufaellige = shuffled.slice(0, 3);
    const queryOrte = [...grosse, ...wirtschaftsstarke, ...zufaellige];
    console.log('Query-Orte:', queryOrte);
    const o = (i) => queryOrte[i % queryOrte.length] || top_staedte[0];
    const y1 = new Date().getFullYear();
    const y2 = y1+1, y3 = y1+2;
    const queries = strictness === 'breit' ? [
      `${o(0)} Büro Neubau ${y1} ${y2}`,
      `${o(1)} Büro Gewerbe Neubau ${y1} ${y2}`,
      `${o(2)} Bürofläche Neubau Fertigstellung ${y2}`,
      `${o(3)} Büro Umbau Sanierung ${y1} ${y2}`,
      `${o(4)} Gewerbe Büro Neubau ${y1} ${y2}`,
      `${o(5)} Büro Standort Fertigstellung ${y2}`,
      `${o(6)} Verwaltungsgebäude Neubau ${y2}`,
      `${o(7)} Bürofläche Investition ${y2}`
    ] : [
      `${o(0)} Bürogebäude Neubau ${y2} ${y3}`,
      `${o(1)} Büroprojekt Neubau ${y1} ${y2}`,
      `${o(2)} Büro Umbau Sanierung ${y2}`,
      `${o(3)} Bürokomplex Neubau ${y2}`,
      `${o(4)} Büro Neubau Fertigstellung ${y1} ${y2}`,
      `${o(5)} Gewerbe Bürofläche Neubau ${y2}`,
      `${o(6)} Bürogebäude Architekt ${y2} ${y3}`
    ];

    console.log('Project queries:', queries);

    // Ausschreibungs-Queries: gezielt auf Vergabeportale + öffentliche Bauvorhaben
    const ausschreibungsQueries = [
      `${o(0)} Büro Neubau Ausschreibung Vergabe ${y1} ${y2}`,
      `${o(1)} Verwaltungsgebäude öffentlich Neubau Ausschreibung ${y2}`,
      `${o(2)} Bürogebäude Neubau Vergabe evergabe ausschreibungen ${y2} ${y3}`,
      `${o(3)} Behörde Hochschule Neubau Büro Vergabe ${y2} ${y3}`
    ];
    console.log('Ausschreibungs queries:', ausschreibungsQueries);

    const alleQueries = queries.concat(ausschreibungsQueries);
    let resultsArrays = await Promise.all(alleQueries.map(q => braveSearch(q, 5).catch(err => { console.log('Brave error:', err.message); return []; })));
    let rawText = filterAndFormatResults(resultsArrays, true);
    console.log('Project rawText length after filter:', rawText.length);

    // Fallback: breitere Suche wenn Ergebnis mager
    if (!rawText || rawText.length < 500) {
      console.log('Project fallback query triggered');
      const fallback = await firecrawlSearch(`${o(0)} OR ${o(1)} OR ${o(2)} Bürogebäude Bauprojekt ${y1} ${y2} ${y3}`, 6).catch(() => '');
      rawText = fallback.substring(0, 28000);
      console.log('Project fallback rawText length:', rawText.length);
    }

    if (!rawText || rawText.length < 50) return res.json({ projects: [], _range: dates.range10 });

    console.log('Raw project text preview:', rawText.substring(0,500));
    console.log('Calling Sonnet with apiKey:', apiKey ? 'set ('+apiKey.substring(0,8)+'...)' : 'MISSING');
    // Ein einziger Call: extrahieren + anreichern (stabiler, günstiger)
    let jsonText = '';
    try {
      jsonText = await claudeSonnet(apiKey,
        `Gib NUR ein JSON-Array zurück, beginne mit [ und schließe mit ]. Kein Text davor oder danach. Strings kurz halten.
NUR Projekte aus: ${orte.slice(0,15).join(', ')}. Keine Projekte aus Berlin, Frankfurt, München, Hamburg.
${strictness === 'breit' ? 'Jeden Büroanteil aufnehmen.' : 'Nur klare Büroprojekte.'}
Auch öffentliche Bauvorhaben aufnehmen (Behörden, Verwaltungsgebäude, Hochschulen, Ministerien, Polizei, Landesbauten).
Feld "zeitpunkt": bevorzugt Fertigstellung; wenn nur Baubeginn bekannt, diesen nehmen. Feld "zeitpunkt_typ": "Fertigstellung" oder "Baubeginn" (was in zeitpunkt steht).
Feld "beschreibung": nur EIN konkreter harter Zusatzfakt der nicht schon in anderen Feldern steht (besondere Nutzung, Bauphase, Sanierungsdetail). Keine Zusammenfassung, keine Spekulation, keine Wertung. Sonst leerer String.
Maximal 6 Projekte.`,
        `${rawText}\n\n[{"projektname":"...","standort":"nur Stadt","zeitpunkt":"...","zeitpunkt_typ":"Fertigstellung oder Baubeginn","bueroflaeche":"Zahl mit Einheit oder leer","arbeitsplaetze":"Zahl oder leer","bauherr":"wichtigster Bauherr/Entwickler oder leer","beschreibung":"...","quelleUrl":"https://..."}]`,
        5000
      );
    } catch(sonnetErr) {
      console.log('Sonnet failed:', sonnetErr.message);
      return res.json({ projects: [], _range: dates.range10 });
    }

    console.log('Project JSON preview:', jsonText.substring(0, 300));
    let projects = [];
    const startIdx = jsonText.indexOf('[');
    const endIdx = jsonText.lastIndexOf(']');
    if (startIdx >= 0 && endIdx > startIdx) {
      // Sauberer Schnitt: nur vom ersten [ bis zum letzten ] – Nachgeplapper ignorieren
      const clean = jsonText.substring(startIdx, endIdx + 1);
      try {
        projects = JSON.parse(clean);
      } catch(e) {
        console.log('JSON parse error:', e.message, '— attempting partial rescue');
        try {
          // Rettung: bis zum letzten vollständigen Objekt schneiden
          const raw = jsonText.substring(startIdx);
          const lastClose = raw.lastIndexOf('}');
          if (lastClose > 0) {
            const partial = raw.substring(0, lastClose + 1) + ']';
            projects = JSON.parse(partial);
            console.log('Partial rescue successful:', projects.length, 'projects');
          }
        } catch(e2) { console.log('Partial rescue failed:', e2.message); }
      }
    }
    console.log('Projects found:', projects.length);

    // Deduplizierung: gleiche Quelle oder sehr ähnlicher Name → nur einmal
    const seen = new Set();
    projects = projects.filter(p => {
      const key = (p.quelleUrl||'') + '|' + (p.projektname||'').toLowerCase().replace(/[^a-z0-9]/g,'').substring(0,20);
      if (seen.has(key)) return false;
      seen.add(key);
      // Auch sehr ähnliche Namen deduplizieren (Levenshtein-ähnlich: erste 15 Zeichen)
      const nameKey = (p.projektname||'').toLowerCase().replace(/[^a-z0-9]/g,'').substring(0,15);
      if (nameKey.length > 5 && seen.has('name:'+nameKey)) return false;
      seen.add('name:'+nameKey);
      return true;
    });
    console.log('Projects after dedup:', projects.length);

    // Filter: Projekte mit Fertigstellung in der Vergangenheit ausschließen
    const currentYear = new Date().getFullYear();
    projects = projects.filter(p => {
      const fertig = p.zeitpunkt || p.fertigstellung || '';
      const m = fertig.match(/(\d{4})/);
      if (!m) return true; // unbekannt → behalten
      return parseInt(m[1]) >= currentYear;
    });
    console.log('Projects after past-filter:', projects.length);

    // Sortier-Schlüssel aus Fertigstellung ableiten (Jahr*100 + Monat; unbekannt = ganz ans Ende)
    const fertigKey = (p) => {
      const f = (p.zeitpunkt || p.fertigstellung || '').toLowerCase();
      const ym = f.match(/(\d{4})/);
      if (!ym) return 999900; // unbekannt → Ende
      let month = 6; // Default Jahresmitte
      if (/q1|1\.\s*quartal|frühjahr|anfang|januar|februar|märz/.test(f)) month = 2;
      else if (/q2|2\.\s*quartal|sommer|mitte|april|mai|juni/.test(f)) month = 5;
      else if (/q3|3\.\s*quartal|herbst|juli|august|september/.test(f)) month = 8;
      else if (/q4|4\.\s*quartal|winter|ende|oktober|november|dezember/.test(f)) month = 11;
      if (/nicht vor|ab\s+\d{4}|frühestens/.test(f)) month = 12; // vage Spät-Angabe hinten einsortieren
      return parseInt(ym[1]) * 100 + month;
    };
    projects.sort((a, b) => fertigKey(a) - fertigKey(b));
    console.log('Projects sorted by Fertigstellung');

    // Anreicherung: fehlende Bürofläche/Arbeitsplätze aus Quell-Volltext nachziehen (parallel)
    const leer = (v) => !v || v === '' || v === '–' || v === 'unbekannt';
    const toEnrich = projects.filter(p => (leer(p.bueroflaeche) || leer(p.arbeitsplaetze)) && p.quelleUrl && p.quelleUrl.startsWith('http'));
    console.log('Enriching', toEnrich.length, 'projects via scrape');
    await Promise.all(toEnrich.map(async (p) => {
      try {
        const scraped = await firecrawlScrape(p.quelleUrl);
        if (!scraped || scraped.length < 100) return;
        const ex = await claudeSonnet(apiKey,
          'Gib NUR ein JSON-Objekt zurück. Extrahiere Bürofläche und Anzahl Büroarbeitsplätze für GENAU dieses Projekt. REGELN: (1) Betrifft der Artikel mehrere Gebäude/Bauabschnitte, nimm NUR die Zahl des im Projektnamen genannten Gebäudes. (2) Gibt es eine explizite BÜROfläche, trage sie direkt ein (z.B. "6.000 m²"). (3) Gibt es KEINE reine Bürofläche, aber eine Gesamt-, Brutto- oder Mischnutzungsfläche (Gebäude mit Büro plus Hotel/Gastronomie/Handel o.ä.), trage sie mit Präfix ein: "Mischnutzung: 9.000 m²". (4) Nur explizit Genanntes, nicht schätzen. Fehlt jede Flächenangabe: leerer String.',
          `Projekt: ${p.projektname}\n\nArtikel (Volltext):\n${scraped.substring(0, 30000)}\n\n{"bueroflaeche":"Zahl mit Einheit oder leer","arbeitsplaetze":"Zahl oder leer"}`,
          400
        );
        const m = ex.match(/\{[\s\S]*\}/);
        if (m) {
          const d = JSON.parse(m[0]);
          if (leer(p.bueroflaeche) && !leer(d.bueroflaeche)) p.bueroflaeche = d.bueroflaeche;
          if (leer(p.arbeitsplaetze) && !leer(d.arbeitsplaetze)) p.arbeitsplaetze = d.arbeitsplaetze;
        }
      } catch(e) { console.log('Enrich failed for', p.projektname, e.message); }
    }));
    console.log('Enrichment done');

    // Logging
    return res.json({ projects, _range: dates.range10 });

  } catch (err) {
    const msg = err.message === 'overloaded' ? 'overloaded' : err.message;
    return res.status(500).json({ error: { message: msg }, projects: [] });
  }
});

// ── COMPANY SEARCH ───────────────────────────────────────────────
app.post('/api/search', async (req, res) => {
  const { orte, plzPrefixes, strictness, password } = req.body; const apiKey = ANTHROPIC_KEY;
  if (!apiKey || !orte?.length) return res.status(400).json({ error: 'Missing params' });
  const nutzer = USERS[password] || 'unbekannt';
  const dates = getDateRange();
  const region = orte.slice(0,4).join(', ');
  const allOrte = orte.join(', ');
  const plzListe = plzPrefixes ? plzPrefixes.map(p=>p+'xxx').join(', ') : '';

  const strictRule = strictness === 'breit'
    ? 'Auch schwächere Signale. Mehr Treffer, auch vagere.'
    : 'Mittlere Signale reichen. Inhabergeführt bevorzugt.';

  try {
    // Branchenanalyse (Haiku ohne Suche)
    const branchenText = await claudeHaiku(apiKey,
      '',
      `Nenne 4 wirtschaftlich starke Branchen in ${region}. Format: BRANCHE: [Name] | STAERKE: stark/moderat | BEGRUENDUNG: [2 Saetze] ---`,
      600
    );

    // Resolve region and key cities
    const regionData = await getRegionAndCities(apiKey, plzPrefixes||[], orte);
    const { region: reg, top_staedte: topS, hidden_champion: hc } = regionData;
    // 2 große + 2 wirtschaftsstarke + 3 zufällig aus dem Rest
    const grosseC = topS.slice(0, 2);
    const wirtschaftsstarkeC = [hc, topS[2]].filter(Boolean);
    const restOrteC = orte.filter(o => !grosseC.includes(o) && !wirtschaftsstarkeC.includes(o));
    const shuffledC = restOrteC.slice().sort(() => Math.random() - 0.5);
    const zufaelligeC = shuffledC.slice(0, 3);
    const queryOrteC = [...grosseC, ...wirtschaftsstarkeC, ...zufaelligeC];
    const o = (i) => queryOrteC[i % queryOrteC.length] || topS[0];
    const cy = new Date().getFullYear();
    const py = cy-1;
    const queries = [
      `${o(0)} GmbH Umzug neues Büro Einweihung ${cy}`,
      `${o(1)} Mittelstand GmbH Expansion neuer Standort ${py} ${cy}`,
      `${o(2)} inhabergeführt Bürofläche Wachstum Stellenaufbau ${cy}`,
      `${o(3)} GmbH Pressemitteilung Standort Neubezug ${cy}`,
      `${o(4)} Familienunternehmen Büro Erweiterung Investition ${cy}`,
      `${o(5)} Softwareunternehmen Beratungsunternehmen neues Büro Standort ${cy}`
    ].filter(q => q.trim());

    console.log('Company queries:', queries);
    let resultsArrays = await Promise.all(queries.map(q => braveSearch(q, 4).catch(err => { console.log('Brave error:', err.message); return []; })));
    let rawText = filterAndFormatResults(resultsArrays, false);
    console.log('Company rawText length after filter:', rawText.length);

    // Fallback: allgemeinere Signalsuche
    if (!rawText || rawText.length < 500) {
      console.log('Company fallback query triggered');
      const fallback = await firecrawlSearch(`${o(0)} OR ${o(1)} OR ${o(2)} Unternehmen Büro Umzug Expansion ${cy}`, 6).catch(() => '');
      rawText = fallback.substring(0, 28000);
      console.log('Company fallback rawText length:', rawText.length);
    }

    if (!rawText || rawText.length < 30) {
      return res.json({ error: { message: 'no_results' }, _debug: { rawLen: rawText.length, preview: rawText.substring(0,200), braveKey: BRAVE_KEY ? 'set' : 'MISSING' } });
    }

    const signaleHoch = 'Neubau, Umbau, Erweiterungsbau, Baugenehmigung, Finanzierungsrunde, Kapitalerhöhung, KfW-Förderung';
    const signaleMittel = 'Expansion, neuer Standort, Mitarbeiterwachstum, Fusion, New Work, Führungswechsel, Generationswechsel';

    let jsonText = '';
    try {
      jsonText = await claudeSonnet(apiKey,
        `Gib NUR ein JSON-Objekt zurück. Beginne mit {
${strictRule}
NICHT: DAX-Konzerne, VW, Continental, Siemens, BMW, BASF, Bayer, Allianz, Bürovermietungen, Kammern, Portale, Messen, Messegesellschaften, Kultureinrichtungen, Theater, Opern, Konzerthäuser, Museen, öffentliche Institutionen, Stadtbetriebe, Bundesbehörden, Hochschulen, Verbände.
NUR: privatwirtschaftliche, inhabergeführte Unternehmen ab 50 MA. Keine börsennotierten Konzerne.
Maximal 6 Unternehmen. Priorität HOCH zuerst, dann MITTEL.
Priorität HOCH: starkes Signal (${signaleHoch})
Priorität MITTEL: schwächeres Signal (${signaleMittel})`,
        `BRANCHEN:\n${branchenText}\n\nSUCHERGEBNISSE:\n${rawText}\n\n{"branchen":[{"name":"...","staerke":"stark/moderat","begruendung":"..."}],"leads":[{"name":"Firmenname","branche":"...","ort":"...","plz":"...","prioritaet":"Hoch oder Mittel","signale":[{"text":"Konkretes Signal","url":"https://..."}],"warumJetzt":"Warum in ${dates.today} relevant? Projektzeitraum nennen. 2-3 Saetze.","ansprechpartner":{"name":"GF/Inhaber oder nicht oeffentlich","funktion":"Inhaber oder GF"}}]}`,
        4000
      );
    } catch(companyErr) {
      console.log('Company Sonnet failed:', companyErr.message);
      return res.json({ error: { message: companyErr.message === 'overloaded' ? 'overloaded' : companyErr.message } });
    }

    // Logging
    const parsed = jsonText ? (() => { try { const m = jsonText.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch(e) { return null; } })() : null;
    const leadCount = parsed?.leads?.length ?? null;
    return res.json({ _jsonText: jsonText, _dateRange: dates.range12, _orte: region, _regionData: regionData });

  } catch (err) {
    const msg = err.message === 'overloaded' ? 'overloaded' : err.message;
    return res.json({ error: { message: msg } });
  }
});

// ── COMPANY PROFILE ──────────────────────────────────────────────
app.post('/api/company', async (req, res) => {
  const { name, ort, branche, kontext } = req.body; const apiKey = ANTHROPIC_KEY;
  if (!apiKey || !name) return res.status(400).json({ error: 'Missing params' });

  const vorlagen = {
    einstieg: [
      `Wir sind verliebt in das Konzept des perfekten Büros – und [TRIGGER] hat unser Interesse an [FIRMENNAME] geweckt.`,
      `[TRIGGER] – das ist genau der Moment, in dem wir als MYWORKSPACE gerne ins Gespräch kommen.`
    ],
    positionierung: `Als 360-Grad-Partner für Bürolösungen begleiten wir Unternehmen von der ersten Planung bis zur fertigen Einrichtung – Licht, Akustik, Ergonomie, Zonen und Design aus einer Hand.`,
    bruecke: [`Gerade in der frühen Planungsphase entstehen die wichtigsten Weichen für eine motivierende Arbeitsumgebung.`],
    cta: `Ich würde mich freuen, Ihnen in einem kurzen, unverbindlichen Gespräch zu zeigen, was für Ihr Unternehmen möglich ist.`
  };

  try {
    // 3 parallele Brave-Queries: Kontakte, Signale, Impressum (§5 TMG: GF-Namen Pflicht)
    const [rawContacts, rawSignals, rawImpressum] = await Promise.all([
      firecrawlSearch(`"${name}" ${ort} Geschäftsführer Inhaber Gründer`, 4).catch(() => ''),
      firecrawlSearch(`"${name}" ${ort} Expansion Büro Standort Mitarbeiter`, 4).catch(() => ''),
      braveSearch(`"${name}" ${ort} Impressum`, 3).catch(() => [])
    ]);

    // Impressum-URL finden und vollständig scrapen (GF, Kontakt, HR-Nummer)
    let impressumScrape = '';
    const impressumHit = (rawImpressum || []).find(r => r.url && /impressum|imprint|kontakt/i.test(r.url));
    const scrapeUrl = impressumHit ? impressumHit.url : (rawImpressum && rawImpressum[0] ? rawImpressum[0].url : null);
    if (scrapeUrl) {
      impressumScrape = await firecrawlScrape(scrapeUrl, 8000).catch(() => '');
    }

    const impressumSnippets = (rawImpressum || []).map(r => `[${r.title||''}](${r.url||''})\n${r.description||''}`).join('\n\n');

    // Kontext von der Startseite (bereits gefundene Infos durchreichen)
    const kontextBlock = kontext ? `BEREITS BEKANNTE INFORMATIONEN (von der Suchergebnis-Karte, priorisiert nutzen):\n${kontext}\n\n` : '';

    const rawText = [
      kontextBlock,
      impressumScrape ? `IMPRESSUM-VOLLTEXT:\n${impressumScrape}` : '',
      impressumSnippets ? `IMPRESSUM-TREFFER:\n${impressumSnippets}` : '',
      `KONTAKT-SUCHE:\n${rawContacts}`,
      `SIGNAL-SUCHE:\n${rawSignals}`
    ].filter(Boolean).join('\n\n===\n\n').substring(0, 28000);

    let jsonText = '';
    try {
      jsonText = await claudeSonnet(apiKey,
        'Gib NUR ein JSON-Objekt zurück. Beginne mit { Alle Strings einzeilig. PRIORITÄT: Echte Namen von Geschäftsführern, Inhabern oder Gründern extrahieren. Das Impressum (§5 TMG) enthält verpflichtend Vertretungsberechtigte, Adresse, Telefon, E-Mail und Handelsregisternummer – diese Angaben unbedingt auswerten und eintragen. Nutze die bereits bekannten Informationen als Basis und ergänze sie. Nur wenn wirklich kein Name/Wert vorkommt: "nicht öffentlich".',
        `Firmendaten:\n\n${rawText}\n\n{"basis":{"adresse":"...","telefon":"...","email":"...","website":"...","gruendung":"...","mitarbeiter":"...","handelsregister":"..."},"ansprechpartner":[{"name":"...","funktion":"GF oder Inhaber oder Office Manager oder Facility Manager","telefon":"...","email":"..."}],"bueroplanung":{"arbeitskultur":"...","raumbedarf":"...","new_work_affinitaet":"hoch/mittel/gering","new_work_begruendung":"..."},"design_reife":{"stufe":2,"stufe_label":"...","begruendung":"..."},"linkedin":{"groesse":"...","wachstumstrend":"steigend/stabil/sinkend","offene_stellen":"..."},"pressespiegel":[{"datum":"...","titel":"...","zusammenfassung":"...","vertriebsrelevanz":"..."}],"budget":{"umsatz_schaetzung":"...","cluster":"Einstieg/Mid/Premium","produktempfehlung":"..."},"quellen":[{"label":"...","url":"..."}]}`,
        2500
      );
    } catch(companyErr) {
      console.log('Company Sonnet failed:', companyErr.message);
      return res.json({ error: { message: companyErr.message === 'overloaded' ? 'overloaded' : companyErr.message } });
    }

    const match = jsonText.match(/\{[\s\S]*\}/);
    let parsed = null;
    if (match) { try { parsed = JSON.parse(match[0]); } catch(e) {} }
    return res.json({ _data: parsed, _vorlagen: vorlagen });

  } catch (err) {
    const msg = err.message === 'overloaded' ? 'overloaded' : err.message;
    return res.json({ error: { message: msg } });
  }
});

// ── PROJECT RESEARCH ─────────────────────────────────────────────
app.post('/api/project-research', async (req, res) => {
  const { projektname, standort, quelleUrl, kontext, ankerFakten } = req.body; const apiKey = ANTHROPIC_KEY;
  if (!apiKey || !projektname) return res.status(400).json({ error: 'Missing params' });

  try {
    // Bekannten Bauherrn/Entwickler als Anker in die Queries aufnehmen
    const anker = (ankerFakten && ankerFakten.beteiligte) ? ankerFakten.beteiligte : '';
    const ankerQuery = anker ? ` ${anker}` : '';

    // 1. Brave: gezielt zum richtigen Projekt (mit Anker)
    const searchResults = await Promise.all([
      braveSearch(`"${projektname}" ${standort||''}${ankerQuery} Architekt Bauherr Projektentwickler`, 5).catch(() => []),
      braveSearch(`"${projektname}" ${standort||''}${ankerQuery} Baugenehmigung Fertigstellung`, 5).catch(() => []),
      braveSearch(`"${projektname}" ${standort||''}${ankerQuery} Investition Budget`, 4).catch(() => [])
    ]);

    // 2. Firecrawl: Quellartikel vollständig scrapen
    let scrapedContent = '';
    if (quelleUrl && quelleUrl.startsWith('http')) {
      scrapedContent = await firecrawlScrape(quelleUrl);
    }

    // Quellen technisch einsammeln (nicht Sonnet überlassen)
    const quellenSammlung = { projekt: [], beteiligte: {} };
    if (quelleUrl && quelleUrl.startsWith('http')) {
      quellenSammlung.projekt.push({ label: 'Projektquelle', url: quelleUrl });
    }
    searchResults.forEach(arr => {
      if (Array.isArray(arr)) arr.forEach(r => {
        if (r.url && r.url.startsWith('http')) quellenSammlung.projekt.push({ label: r.title || r.url, url: r.url });
      });
    });

    const searchText = searchResults.map(arr => Array.isArray(arr)
      ? arr.map(r => `[${r.title||''}](${r.url||''})\n${r.description||''}`).join('\n\n')
      : arr).join('\n\n===\n\n');

    const kontextBlock = kontext ? `BEKANNTE FAKTEN ZUM ZIELPROJEKT (verbindlicher Anker):\n${kontext}\n\n===\n\n` : '';

    const rawText = [kontextBlock, scrapedContent ? `QUELLARTIKEL-VOLLTEXT:\n${scrapedContent}` : '', searchText].filter(Boolean).join('\n\n===\n\n').substring(0, 28000);

    const systemPrompt = 'Gib NUR ein JSON-Objekt zurück. Beginne mit { Alle Strings einzeilig. '
      + 'WICHTIG - PROJEKT-IDENTITÄT: Die BEKANNTEN FAKTEN oben definieren EINDEUTIG das Zielprojekt (Projektname, Standort, bekannte Beteiligte). '
      + 'Recherchiere AUSSCHLIESSLICH zu genau diesem Projekt. Wenn ein Suchergebnis ein ANDERES Projekt betrifft (anderer Bauherr, andere Stadt, anderer Projektname), IGNORIERE es vollständig – übernimm daraus keine Daten. '
      + 'KONFLIKT-ERKENNUNG: Wenn du zu einem Feld einen Wert findest, der einem bekannten Fakt WIDERSPRICHT (z.B. andere Fertigstellung, anderer Bauherr), gib beide Werte im "konflikte"-Array an mit Quelle. Nur bei echten Widersprüchen (zwei konkrete, unterschiedliche Werte) – nicht bei Ergänzungen (leer vs. konkret). '
      + 'Fehlende Felder mit "unbekannt" füllen.';

    const jsonText = await claudeSonnet(apiKey,
      systemPrompt,
      `Zielprojekt: ${projektname}, Standort: ${standort||'unbekannt'}\n\nSuchergebnisse:\n${rawText}\n\n{"projektname":"...","standort":"...","plz":"...","projekttyp":"...","beschreibung":"...","bueroflaeche":"...","gesamtflaeche":"...","investitionsvolumen":"...","fertigstellung":"...","baustart":"...","baugenehmigung":"...","ausschreibungsstatus":"...","moebelbedarfEinschaetzung":"hoch/mittel","ansprechpartner":[{"rolle":"Architekt/Bauherr/Projektentwickler/GU/Vermarktung","firma":"...","name":"...","telefon":"...","email":"...","adresse":"...","url":"..."}],"projektnews":[{"datum":"...","titel":"...","zusammenfassung":"...","url":"..."}],"konflikte":[{"feld":"Fertigstellung","wert_bekannt":"nicht vor 2030","quelle_bekannt":"https://...","wert_recherche":"Frühjahr 2027","quelle_recherche":"https://..."}],"quellen":[{"label":"...","url":"..."}]}`,
      4000
    );

    const match = jsonText.match(/\{[\s\S]*\}/);
    let parsed = null;
    if (match) { try { parsed = JSON.parse(match[0]); } catch(e) {} }

    // ── ETAPPE 2A: Ansprechpartner-Recherche für relevante Rollen ──
    if (parsed && Array.isArray(parsed.ansprechpartner)) {
      const relevanteRollen = /architekt|innenarchitekt|projektentwickler|mieter/i;
      const relevante = parsed.ansprechpartner.filter(a => a.firma && relevanteRollen.test(a.rolle||''));
      // pro Firma nur einmal (nach Firmenname dedupliziert)
      const gesehen = new Set();
      const zuRecherchieren = relevante.filter(a => {
        const key = (a.firma||'').toLowerCase().trim();
        if (!key || gesehen.has(key)) return false;
        gesehen.add(key); return true;
      }).slice(0, 4); // maximal 4 Firmen

      const beteiligte = await Promise.all(zuRecherchieren.map(async (a) => {
        const firma = a.firma;
        const result = { rolle: a.rolle, firma: firma, projektkontaktName: a.name || '', firmendaten: null, ansprechpartner: [], quellen: [] };
        try {
          // Parallel: Impressum-Suche + Team-Suche
          const [impRes, teamRes] = await Promise.all([
            braveSearch(`"${firma}" Impressum`, 3).catch(() => []),
            braveSearch(`"${firma}" Team Ansprechpartner Kontakt`, 3).catch(() => [])
          ]);
          // Impressum scrapen
          const impHit = (impRes||[]).find(r => r.url && /impressum|imprint/i.test(r.url)) || (impRes||[])[0];
          let impScrape = '';
          if (impHit && impHit.url) { impScrape = await firecrawlScrape(impHit.url, 8000).catch(() => ''); result.quellen.push({ label: 'Impressum', url: impHit.url }); }
          // Team-Seite scrapen (nur wenn es einen projektbezogenen Namen gibt zum Anreichern)
          const teamHit = (teamRes||[]).find(r => r.url && /team|kontakt|ansprechpartner|ueber-uns|about/i.test(r.url)) || (teamRes||[])[0];
          let teamScrape = '';
          if (a.name && teamHit && teamHit.url) { teamScrape = await firecrawlScrape(teamHit.url, 12000).catch(() => ''); result.quellen.push({ label: 'Team-/Kontaktseite', url: teamHit.url }); }

          // Sonnet: Impressum-Firmendaten + Namen-Anreicherung, STRIKT getrennt
          const exText = await claudeSonnet(apiKey,
            'Gib NUR ein JSON-Objekt zurück. Trenne STRIKT zwischen Firmendaten (aus Impressum) und Ansprechpartnern. '
            + 'firmendaten: aus dem Impressum (§5 TMG) – Geschäftsführer/Vertretungsberechtigte, Anschrift, Telefon, E-Mail, Handelsregister. Nur explizit Genanntes. '
            + 'ansprechpartner: NUR wenn ein projektbezogener Name übergeben wurde, gib GENAU diesen aus. Setze "aufSeiteGefunden" auf true NUR wenn der Name WÖRTLICH auf der Team-/Kontaktseite steht – dann darfst du Funktion/Telefon/E-Mail von dort ergänzen und quelle=Team-URL setzen. Steht der Name NICHT auf der Seite, setze aufSeiteGefunden=false, quelle="Projektkontext" und ergänze KEINE erfundenen Kontaktdaten. Liste NICHT die ganze Belegschaft. Kein projektbezogener Name: leeres Array. '
            + 'Nichts erfinden, nicht schätzen. Fehlende Felder: leerer String.',
            `Firma: ${firma}\nProjektbezogener Name (falls vorhanden): ${a.name||'KEINER'}\n\nIMPRESSUM:\n${impScrape||'(nichts gefunden)'}\n\nTEAM-/KONTAKTSEITE:\n${teamScrape||'(nichts gefunden)'}\n\n{"firmendaten":{"geschaeftsfuehrer":"...","adresse":"...","telefon":"...","email":"...","handelsregister":"...","quelle":"Impressum-URL"},"ansprechpartner":[{"name":"...","funktion":"...","telefon":"...","email":"...","aufSeiteGefunden":true,"quelle":"Team-URL wenn gefunden, sonst Projektkontext"}]}`,
            1200
          );
          const em = exText.match(/\{[\s\S]*\}/);
          if (em) {
            const ed = JSON.parse(em[0]);
            result.firmendaten = ed.firmendaten || null;
            result.ansprechpartner = Array.isArray(ed.ansprechpartner) ? ed.ansprechpartner : [];
          }
          // LinkedIn-Icon: pro Ansprechpartner mit Namen eine Suche, nur echtes /in/-Profil zeigen
          await Promise.all((result.ansprechpartner||[]).map(async (ap) => {
            if (!ap.name) return;
            try {
              const li = await braveSearch(`"${ap.name}" ${firma} LinkedIn`, 4).catch(() => []);
              const urls = (li||[]).map(r => r.url).filter(Boolean);
              console.log('[LINKEDIN]', ap.name, '@', firma, '| Treffer-URLs:', JSON.stringify(urls));
              const hit = (li||[]).find(r => r.url && /linkedin\.com\/in\//i.test(r.url));
              if (hit) { ap.linkedin = hit.url; console.log('[LINKEDIN] -> Profil gesetzt:', hit.url); }
              else console.log('[LINKEDIN] -> kein /in/-Profil im Ergebnis');
            } catch(e) { console.log('[LINKEDIN] Fehler:', e.message); }
          }));
        } catch(e) { console.log('Beteiligten-Recherche fehlgeschlagen für', firma, e.message); }
        return result;
      }));

      parsed.beteiligte = beteiligte;
      beteiligte.forEach(b => { if (b.quellen && b.quellen.length) quellenSammlung.beteiligte[b.firma] = b.quellen; });
    }

    // ── ETAPPE 2B: Facility Manager beim Nutzer/Bauherrn suchen (ein Treffer) ──
    if (parsed) {
      // Nutzer bevorzugt (Mieter-Rolle), sonst Bauherr
      let zielFirma = '';
      if (Array.isArray(parsed.ansprechpartner)) {
        const mieter = parsed.ansprechpartner.find(a => /mieter|nutzer/i.test(a.rolle||'') && a.firma);
        if (mieter) zielFirma = mieter.firma;
        if (!zielFirma) {
          const bauherr = parsed.ansprechpartner.find(a => /bauherr/i.test(a.rolle||'') && a.firma);
          if (bauherr) zielFirma = bauherr.firma;
        }
      }
      if (zielFirma) {
        try {
          const fmRes = await braveSearch(`"${zielFirma}" Facility Manager`, 3).catch(() => []);
          // Bevorzugt echtes LinkedIn-Profil, sonst ersten plausiblen Treffer
          const fmLinkedIn = (fmRes||[]).find(r => r.url && /linkedin\.com\/in\//i.test(r.url));
          const fmHit = fmLinkedIn || (fmRes||[])[0];
          if (fmHit) {
            parsed.facilityManager = {
              firma: zielFirma,
              treffer: fmHit.title || '',
              beschreibung: fmHit.description || '',
              url: fmHit.url || '',
              istLinkedIn: !!fmLinkedIn
            };
          }
        } catch(e) { console.log('FM-Suche fehlgeschlagen:', e.message); }
      }
    }

    // Quellen dedupliziert und sortiert ans Ergebnis hängen
    const gesehenUrls = new Set();
    const dedupe = (arr) => arr.filter(q => { if (!q.url || gesehenUrls.has(q.url)) return false; gesehenUrls.add(q.url); return true; });
    parsed._quellen = {
      projekt: dedupe(quellenSammlung.projekt),
      beteiligte: Object.keys(quellenSammlung.beteiligte).map(firma => ({ firma, quellen: dedupe(quellenSammlung.beteiligte[firma]) })).filter(g => g.quellen.length)
    };

    return res.json({ _data: parsed });

  } catch (err) {
    const msg = err.message === 'overloaded' ? 'overloaded' : err.message;
    return res.json({ error: { message: msg } });
  }
});

// ── COMBINED LOG ENDPOINT ─────────────────────────────────────
app.post('/api/log', async (req, res) => {
  const { password, plz, projekte, firmen, projektnamen, firmennamen } = req.body;
  const nutzer = USERS[password] || 'unbekannt';
  await logToSheets(nutzer, 'Suchlauf', plz || '–', projekte ?? '–', firmen ?? '–',
    Array.isArray(projektnamen) ? projektnamen.join(', ') : (projektnamen || '–'),
    Array.isArray(firmennamen) ? firmennamen.join(', ') : (firmennamen || '–')
  );
  return res.json({ ok: true });
});

// ── RESEARCH/PROFILE CLICK LOGGING ────────────────────────────
app.post('/api/log-detail', async (req, res) => {
  const { password, aktion, name, plz } = req.body;
  const nutzer = USERS[password] || 'unbekannt';
  await logToSheets(nutzer, aktion || 'Detail', plz || '–', '–', '–', name || '–', '–');
  return res.json({ ok: true });
});

// ── DASHBOARD ─────────────────────────────────────────────────
const DASHBOARD_USERS = ['MW-rb7754', 'MW-wg9912', 'MW-mm3367'];

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post('/api/dashboard-data', async (req, res) => {
  const { password } = req.body;
  if (!DASHBOARD_USERS.includes(password)) {
    return res.json({ error: 'Kein Zugang.' });
  }
  if (!SHEET_ID || !SERVICE_ACCOUNT) {
    return res.json({ error: 'Google Sheets nicht konfiguriert.' });
  }
  try {
    const token = await getGoogleToken();
    if (!token) return res.json({ error: 'Google Auth fehlgeschlagen.' });
    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A:I`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await resp.json();
    const rows = (data.values || []).slice(1); // skip header
    return res.json({ rows });
  } catch(e) {
    return res.json({ error: e.message });
  }
});

// ── ANONYMES STATS-DASHBOARD ──────────────────────────────────
const ROLLOUT_DATE = new Date(2026, 5, 22); // 22.06.2026
const TEST_USERS = ['Robin', 'Walter', 'Michael']; // Testläufe, aus Statistik ausgeschlossen

app.get('/stats', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

app.post('/api/stats-data', async (req, res) => {
  const { password } = req.body;
  if (!DASHBOARD_USERS.includes(password)) return res.json({ error: 'Kein Zugang.' });
  if (!SHEET_ID || !SERVICE_ACCOUNT) return res.json({ error: 'Google Sheets nicht konfiguriert.' });
  try {
    const token = await getGoogleToken();
    if (!token) return res.json({ error: 'Google Auth fehlgeschlagen.' });
    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A:I`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await resp.json();
    const rows = (data.values || []).slice(1);

    // Parse Datum (Spalte A, Format TT.MM.JJJJ)
    const parseDate = (s) => {
      if (!s) return null;
      const p = s.split('.');
      if (p.length < 3) return null;
      return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
    };

    // Filter: ab Rollout + Testnutzer raus
    const gefiltert = rows.filter(r => {
      const d = parseDate(r[0]);
      if (!d || d < ROLLOUT_DATE) return false;
      const nutzer = (r[2] || '').trim();
      if (TEST_USERS.includes(nutzer)) return false;
      return true;
    });

    // Anonyme Tages-Aggregation: nur Summen, keine Namen
    // Struktur pro Tag: { datum, logins, suchlaeufe, projekte, firmen, detailRecherchen }
    const perDay = {};
    const dayKey = (d) => d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2);
    gefiltert.forEach(r => {
      const d = parseDate(r[0]);
      if (!d) return;
      const k = dayKey(d);
      if (!perDay[k]) perDay[k] = { datum: k, logins: 0, suchlaeufe: 0, projekte: 0, firmen: 0, detailRecherchen: 0 };
      const aktion = r[4] || '';
      if (aktion === 'Login') perDay[k].logins++;
      else if (aktion === 'Suchlauf') {
        perDay[k].suchlaeufe++;
        const pj = parseInt(r[5]); if (!isNaN(pj)) perDay[k].projekte += pj;
        const fi = parseInt(r[6]); if (!isNaN(fi)) perDay[k].firmen += fi;
      }
      else if (aktion === 'Web-Recherche' || aktion === 'Firmenprofil') perDay[k].detailRecherchen++;
    });

    const tage = Object.values(perDay).sort((a,b) => a.datum.localeCompare(b.datum));
    return res.json({ tage, rollout: dayKey(ROLLOUT_DATE) });
  } catch(e) {
    return res.json({ error: e.message });
  }
});

app.get('/api/version', (req, res) => res.json({ server: SERVER_VERSION }));

app.listen(PORT, () => console.log(`MYWORKSPACE Lead-Finder running on port ${PORT}`));
