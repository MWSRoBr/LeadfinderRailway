const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const FIRECRAWL_KEY = process.env.FIRECRAWL_KEY;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── PLZ DATENBANK ──────────────────────────────────────────────
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

// ── FIRECRAWL SEARCH ────────────────────────────────────────────
async function firecrawlSearch(query, limit = 5) {
  const resp = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_KEY}`
    },
    body: JSON.stringify({
      query,
      limit,
      lang: 'de',
      country: 'de',
      scrapeOptions: { formats: ['markdown'] }
    })
  });
  const data = await resp.json();
  if (!data.success) throw new Error(data.error || 'Firecrawl error');
  return (data.data || []).map(r => `[${r.title||''}](${r.url||''})\n${r.markdown||r.description||''}`).join('\n\n---\n\n').substring(0, 6000);
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
  const key = FIRECRAWL_KEY;
  if (!key) return res.json({ status: 'ERROR', message: 'FIRECRAWL_KEY not set' });
  try {
    const result = await firecrawlSearch('Köln GmbH Büro 2026', 2);
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
  const { plz, apiKey } = req.body;
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

  return res.json({ orte: result.orte, prefixes: result.prefixes, regionData });
});

// ── PROJECT SEARCH ───────────────────────────────────────────────
app.post('/api/projects', async (req, res) => {
  const { apiKey, orte, plzPrefixes } = req.body;
  if (!apiKey || !orte?.length) return res.status(400).json({ error: 'Missing params' });
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
    const y1 = new Date().getFullYear();
    const y2 = y1+1, y3 = y1+2;
    const queries = [
      `${region} Bürogebäude Neubau Projektentwickler Fertigstellung ${y2} ${y3}`,
      `${top_staedte[0]} Büroimmobilie Neubau Baugenehmigung ${y1} ${y2}`,
      `${top_staedte[1]||top_staedte[0]} Bürokomplex Revitalisierung Umbau ${y2} ${y3}`,
      `${top_staedte[2]||top_staedte[0]} Bürogebäude Projektentwicklung ${y2}`,
      `${hidden_champion} Büro Neubau Wachstum ${y1} ${y2}`
    ].filter(q => q.trim());

    console.log('Project queries:', queries);
    const results = await Promise.all(queries.map(q => firecrawlSearch(q, 4).catch(err => { console.log('Firecrawl error:', err.message); return ''; })));
    console.log('Project results lengths:', results.map(r => r.length));
    const rawText = results.join('\n\n===\n\n').substring(0, 8000);

    if (!rawText || rawText.length < 50) return res.json({ projects: [], _range: dates.range10 });

    console.log('Raw project text preview:', rawText.substring(0,500));
    const jsonText = await claudeSonnet(apiKey,
      `Gib NUR ein JSON-Array zurück. Beginne mit [ Alle Strings einzeilig. Sei SEHR großzügig – nimm jedes Bauprojekt auf das irgendwie mit Büros zu tun hat, auch wenn Daten fehlen. Nur ausschließen: Wohngebäude, Infrastruktur (Straßen, Bahnhöfe), bereits fertiggestellte Gebäude.`,
      `Extrahiere ALLE Büro-Bauprojekte aus diesen Texten. Auch wenn nur Projektname und Stadt bekannt sind – aufnehmen. Auch Umbauten, Revitalisierungen, Sanierungen von Bürogebäuden.\n\n${rawText}\n\n[{"projektname":"...","beschreibung":"...","standort":"...","plz":"unbekannt wenn nicht gefunden","bueroflaeche":"unbekannt wenn nicht gefunden","arbeitsplaetze":"unbekannt","fertigstellung":"unbekannt wenn nicht gefunden","projekttyp":"Neubau oder Umbau","moebelbedarfEinschaetzung":"hoch oder mittel","ausschreibungsstatus":"unbekannt","kontakte":[{"rolle":"Auftraggeber oder Architekt","firma":"...","ansprechpartner":"unbekannt","adresse":"unbekannt","telefon":"unbekannt","email":"unbekannt","url":"..."}],"quelleUrl":"https://..."}]`,
      2000
    );

    console.log('Project JSON preview:', jsonText.substring(0, 300));
    const match = jsonText.match(/\[[\s\S]*\]/);
    let projects = [];
    if (match) { try { projects = JSON.parse(match[0]); } catch(e) { console.log('JSON parse error:', e.message); } }
    console.log('Projects found:', projects.length);
    return res.json({ projects, _range: dates.range10 });

  } catch (err) {
    const msg = err.message === 'overloaded' ? 'overloaded' : err.message;
    return res.status(500).json({ error: { message: msg }, projects: [] });
  }
});

// ── COMPANY SEARCH ───────────────────────────────────────────────
app.post('/api/search', async (req, res) => {
  const { apiKey, orte, plzPrefixes, strictness } = req.body;
  if (!apiKey || !orte?.length) return res.status(400).json({ error: 'Missing params' });
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
    const cy = new Date().getFullYear();
    const py = cy-1;
    const queries = [
      `${topS[0]} Unternehmen expandiert neues Büro ${cy}`,
      `${topS[0]} GmbH Pressemitteilung Expansion Standort ${py} ${cy}`,
      `${topS[1]||topS[0]} inhabergeführt Wachstum neuer Standort ${cy}`,
      `${hc||topS[2]||topS[0]} GmbH expandiert Büro Mitarbeiter ${cy}`
    ].filter(q => q.trim());

    console.log('Project queries:', queries);
    const results = await Promise.all(queries.map(q => firecrawlSearch(q, 4).catch(err => { console.log('Firecrawl error:', err.message); return ''; })));
    console.log('Project results lengths:', results.map(r => r.length));
    const rawText = results.join('\n\n===\n\n').substring(0, 6000);

    if (!rawText || rawText.length < 30) {
      return res.json({ error: { message: 'no_results' }, _debug: { rawLen: rawText.length, preview: rawText.substring(0,200), firecrawlKey: FIRECRAWL_KEY ? 'set' : 'MISSING' } });
    }

    const signaleHoch = 'Neubau, Umbau, Erweiterungsbau, Baugenehmigung, Finanzierungsrunde, Kapitalerhöhung, KfW-Förderung';
    const signaleMittel = 'Expansion, neuer Standort, Mitarbeiterwachstum, Fusion, New Work, Führungswechsel, Generationswechsel';

    const jsonText = await claudeSonnet(apiKey,
      `Gib NUR ein JSON-Objekt zurück. Beginne mit {
${strictRule}
NICHT: DAX-Konzerne, VW, Continental, Siemens, BMW, BASF, Bayer, Allianz, Bürovermietungen, Kammern, Portale.
Nur inhabergeführte Unternehmen ab 50 MA, Rechtsform egal.
Priorität HOCH: starkes Signal (${signaleHoch})
Priorität MITTEL: schwächeres Signal (${signaleMittel})`,
      `BRANCHEN:\n${branchenText}\n\nSUCHERGEBNISSE:\n${rawText}\n\n{"branchen":[{"name":"...","staerke":"stark/moderat","begruendung":"..."}],"leads":[{"name":"Firmenname","branche":"...","ort":"...","plz":"...","prioritaet":"Hoch oder Mittel","signale":[{"text":"Konkretes Signal","url":"https://..."}],"warumJetzt":"Warum in ${dates.today} relevant? Projektzeitraum nennen. 2-3 Saetze.","ansprechpartner":{"name":"GF/Inhaber oder nicht oeffentlich","funktion":"Inhaber oder GF"}}]}`,
      2000
    );

    return res.json({ _jsonText: jsonText, _dateRange: dates.range12, _orte: region, _regionData: regionData });

  } catch (err) {
    const msg = err.message === 'overloaded' ? 'overloaded' : err.message;
    return res.json({ error: { message: msg } });
  }
});

// ── COMPANY PROFILE ──────────────────────────────────────────────
app.post('/api/company', async (req, res) => {
  const { apiKey, name, ort, branche } = req.body;
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
    // Firecrawl: search for company details
    const rawText = await firecrawlSearch(`"${name}" ${ort} Impressum Geschäftsführer Mitarbeiter`, 5);

    const jsonText = await claudeSonnet(apiKey,
      'Gib NUR ein JSON-Objekt zurück. Beginne mit { Alle Strings einzeilig.',
      `Firmendaten aus Suchergebnissen:\n\n${rawText}\n\n{"basis":{"adresse":"...","telefon":"...","email":"...","website":"...","gruendung":"...","mitarbeiter":"..."},"ansprechpartner":[{"name":"...","funktion":"GF oder Inhaber oder Office Manager oder Facility Manager","telefon":"...","email":"..."}],"bueroplanung":{"arbeitskultur":"...","raumbedarf":"...","new_work_affinitaet":"hoch/mittel/gering","new_work_begruendung":"..."},"design_reife":{"stufe":2,"stufe_label":"...","begruendung":"..."},"linkedin":{"groesse":"...","wachstumstrend":"steigend/stabil/sinkend","offene_stellen":"..."},"pressespiegel":[{"datum":"...","titel":"...","zusammenfassung":"...","vertriebsrelevanz":"..."}],"budget":{"umsatz_schaetzung":"...","cluster":"Einstieg/Mid/Premium","produktempfehlung":"..."},"quellen":[{"label":"...","url":"..."}]}`,
      2000
    );

    const match = jsonText.match(/\{[\s\S]*\}/);
    let parsed = null;
    if (match) { try { parsed = JSON.parse(match[0]); } catch(e) {} }
    return res.json({ _data: parsed, _vorlagen: vorlagen });

  } catch (err) {
    const msg = err.message === 'overloaded' ? 'overloaded' : err.message;
    return res.json({ error: { message: msg } });
  }
});

app.listen(PORT, () => console.log(`MYWORKSPACE Lead-Finder running on port ${PORT}`));
