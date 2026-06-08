const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── PLZ DATENBANK ──────────────────────────────────────────────
const PLZ_MAP = {
  '01': ['Dresden','Meißen','Radebeul','Coswig','Freital'],
  '02': ['Görlitz','Bautzen','Zittau','Hoyerswerda'],
  '03': ['Cottbus','Spremberg','Forst','Guben'],
  '04': ['Leipzig','Borna','Grimma','Markkleeberg','Torgau'],
  '06': ['Halle','Merseburg','Dessau','Köthen','Weißenfels'],
  '07': ['Erfurt','Jena','Weimar','Gera','Altenburg'],
  '08': ['Chemnitz','Zwickau','Plauen','Aue'],
  '09': ['Chemnitz','Freiberg','Mittweida','Annaberg'],
  '10': ['Berlin-Mitte','Berlin-Tiergarten','Berlin-Wedding'],
  '11': ['Berlin'],
  '12': ['Berlin-Tempelhof','Berlin-Neukölln','Berlin-Treptow'],
  '13': ['Berlin-Wedding','Berlin-Reinickendorf','Berlin-Pankow'],
  '14': ['Berlin-Spandau','Berlin-Charlottenburg','Potsdam'],
  '15': ['Potsdam','Königs Wusterhausen','Luckenwalde'],
  '16': ['Oranienburg','Neuruppin','Bernau','Eberswalde'],
  '17': ['Neubrandenburg','Waren','Neustrelitz','Greifswald'],
  '18': ['Rostock','Wismar','Güstrow','Stralsund'],
  '19': ['Schwerin','Ludwigslust','Parchim','Hagenow'],
  '20': ['Hamburg-Mitte','Hamburg-Altstadt'],
  '21': ['Hamburg-Harburg','Lüneburg','Stade','Buchholz'],
  '22': ['Hamburg-Eimsbüttel','Hamburg-Altona','Hamburg-Nord'],
  '23': ['Lübeck','Bad Schwartau','Ratzeburg'],
  '24': ['Kiel','Neumünster','Rendsburg'],
  '25': ['Heide','Itzehoe','Brunsbüttel','Husum'],
  '26': ['Oldenburg','Wilhelmshaven','Delmenhorst','Emden'],
  '27': ['Bremerhaven','Cuxhaven','Verden'],
  '28': ['Bremen','Delmenhorst'],
  '29': ['Celle','Uelzen','Soltau','Walsrode'],
  '30': ['Hannover','Langenhagen','Garbsen'],
  '31': ['Hildesheim','Hameln','Peine'],
  '32': ['Herford','Minden','Bad Oeynhausen'],
  '33': ['Bielefeld','Paderborn','Gütersloh','Detmold'],
  '34': ['Kassel','Hofgeismar','Bad Hersfeld'],
  '35': ['Marburg','Gießen','Wetzlar','Limburg'],
  '36': ['Fulda','Bad Hersfeld','Hünfeld'],
  '37': ['Göttingen','Northeim','Herzberg'],
  '38': ['Braunschweig','Wolfsburg','Salzgitter','Wolfenbüttel'],
  '39': ['Magdeburg','Halberstadt','Stendal'],
  '40': ['Düsseldorf','Ratingen','Erkrath'],
  '41': ['Mönchengladbach','Krefeld','Neuss','Grevenbroich'],
  '42': ['Wuppertal','Remscheid','Solingen','Velbert'],
  '44': ['Dortmund','Castrop-Rauxel','Lünen'],
  '45': ['Essen','Gelsenkirchen','Bottrop','Mülheim'],
  '46': ['Oberhausen','Dinslaken','Wesel','Moers'],
  '47': ['Duisburg','Krefeld','Kleve','Moers'],
  '48': ['Münster','Osnabrück','Rheine'],
  '49': ['Osnabrück','Lingen','Nordhorn'],
  '50': ['Köln','Brühl','Pulheim','Frechen','Hürth'],
  '51': ['Köln-Porz','Bergisch Gladbach','Leverkusen','Overath'],
  '52': ['Aachen','Eschweiler','Stolberg','Herzogenrath','Würselen'],
  '53': ['Bonn','Siegburg','Sankt Augustin','Troisdorf','Hennef'],
  '54': ['Trier','Bitburg','Wittlich','Bernkastel-Kues'],
  '55': ['Mainz','Worms','Bad Kreuznach','Ingelheim'],
  '56': ['Koblenz','Neuwied','Andernach','Mayen','Bad Neuenahr'],
  '57': ['Siegen','Olpe','Attendorn','Betzdorf'],
  '58': ['Hagen','Iserlohn','Lüdenscheid','Menden'],
  '59': ['Hamm','Soest','Arnsberg','Unna','Lippstadt'],
  '60': ['Frankfurt-Innenstadt','Frankfurt-Nordend','Frankfurt-Bornheim'],
  '61': ['Frankfurt-Nord','Bad Homburg','Friedberg','Oberursel'],
  '63': ['Offenbach','Aschaffenburg','Hanau'],
  '64': ['Darmstadt','Rüsselsheim','Groß-Gerau','Bensheim'],
  '65': ['Wiesbaden','Rüdesheim','Bad Schwalbach'],
  '66': ['Saarbrücken','Saarlouis','Neunkirchen','Homburg'],
  '67': ['Ludwigshafen','Mannheim','Frankenthal','Speyer'],
  '68': ['Mannheim','Heidelberg','Ladenburg'],
  '69': ['Heidelberg','Weinheim','Sinsheim'],
  '70': ['Stuttgart','Fellbach','Kernen','Remseck'],
  '71': ['Ludwigsburg','Waiblingen','Backnang','Bietigheim'],
  '72': ['Tübingen','Reutlingen','Mössingen','Hechingen'],
  '73': ['Esslingen','Göppingen','Kirchheim','Nürtingen'],
  '74': ['Heilbronn','Öhringen','Neckarsulm','Mosbach'],
  '75': ['Pforzheim','Mühlacker','Bretten'],
  '76': ['Karlsruhe','Baden-Baden','Rastatt','Bruchsal'],
  '77': ['Offenburg','Lahr','Kehl','Achern'],
  '78': ['Konstanz','Villingen-Schwenningen','Singen','Rottweil'],
  '79': ['Freiburg','Breisach','Müllheim'],
  '80': ['München-Schwabing','München-Maxvorstadt','München-Innenstadt'],
  '81': ['München-Bogenhausen','München-Berg am Laim'],
  '82': ['München-Süd','Gauting','Starnberg','Germering'],
  '83': ['Rosenheim','Wasserburg','Traunstein'],
  '84': ['Landshut','Dingolfing','Straubing'],
  '85': ['Ingolstadt','Erding','Freising','Moosburg'],
  '86': ['Augsburg','Kaufbeuren','Memmingen','Donauwörth'],
  '87': ['Kempten','Immenstadt','Füssen'],
  '88': ['Ravensburg','Friedrichshafen','Biberach'],
  '89': ['Ulm','Neu-Ulm','Günzburg','Heidenheim'],
  '90': ['Nürnberg','Fürth','Erlangen'],
  '91': ['Nürnberg-Süd','Schwabach','Ansbach','Roth'],
  '92': ['Amberg','Weiden','Cham'],
  '93': ['Regensburg','Kelheim','Straubing'],
  '94': ['Passau','Deggendorf','Freyung'],
  '95': ['Bayreuth','Hof','Kulmbach'],
  '96': ['Bamberg','Coburg','Lichtenfels'],
  '97': ['Würzburg','Schweinfurt','Bad Kissingen'],
  '98': ['Erfurt-Süd','Suhl','Meiningen'],
  '99': ['Erfurt','Gotha','Eisenach','Mühlhausen']
};

function getOrteFromPlzPrefix(prefix) {
  const orte = new Set();
  const key2 = prefix.substring(0, 2);
  if (PLZ_MAP[key2]) PLZ_MAP[key2].forEach(o => orte.add(o));
  return [...orte];
}

function parsePlzInput(input) {
  input = input.trim();
  const prefixes = new Set();
  const parts = input.split(/[,\s]+/);
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-');
      const s = parseInt(start.substring(0, 2));
      const e = parseInt(end.substring(0, 2));
      if (!isNaN(s) && !isNaN(e)) {
        for (let i = s; i <= e; i++) prefixes.add(String(i).padStart(2, '0'));
      }
    } else if (part.match(/^\d+$/)) {
      prefixes.add(part.substring(0, 2).padStart(2, '0'));
    }
  }
  const orte = new Set();
  prefixes.forEach(p => getOrteFromPlzPrefix(p).forEach(o => orte.add(o)));
  return { prefixes: [...prefixes], orte: [...orte] };
}

function getDateRange() {
  const now = new Date();
  const from12 = new Date(now); from12.setMonth(from12.getMonth() - 12);
  const from10 = new Date(now); from10.setMonth(from10.getMonth() - 10);
  const plus6 = new Date(now); plus6.setMonth(plus6.getMonth() + 6);
  const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  return {
    today: `${months[now.getMonth()]} ${now.getFullYear()}`,
    from12: `${months[from12.getMonth()]} ${from12.getFullYear()}`,
    from10: `${months[from10.getMonth()]} ${from10.getFullYear()}`,
    plus6: `${months[plus6.getMonth()]} ${plus6.getFullYear()}`,
    range12: `${months[from12.getMonth()]} ${from12.getFullYear()} bis ${months[now.getMonth()]} ${now.getFullYear()}`,
    range10: `${months[from10.getMonth()]} ${from10.getFullYear()} bis ${months[now.getMonth()]} ${now.getFullYear()}`
  };
}

// ── PLZ RESOLVE ─────────────────────────────────────────────────
app.post('/api/plz', (req, res) => {
  const { plz } = req.body;
  if (!plz) return res.status(400).json({ error: 'Missing plz' });
  const result = parsePlzInput(plz);
  if (!result.orte.length) return res.json({ error: 'PLZ-Bereich nicht erkannt. Bitte 2-stellige PLZ eingeben (z.B. 50 oder 50-53).' });
  return res.json({ orte: result.orte, prefixes: result.prefixes });
});

// ── PROJECT SEARCH ───────────────────────────────────────────────
app.post('/api/projects', async (req, res) => {
  const { apiKey, orte, plzPrefixes } = req.body;
  if (!apiKey || !orte || !orte.length) return res.status(400).json({ error: 'Missing params' });

  const dates = getDateRange();
  const orteListe = orte.slice(0, 8).join(', ');
  const plzListe = plzPrefixes ? plzPrefixes.map(p => p + 'xxx').join(', ') : '';

  try {
    const searchResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Du hast Live-Web-Suche. Heute ist ${dates.today}. Suche aktiv.`,
        messages: [{ role: 'user', content: `Suche nach geplanten Büro-Bauprojekten (Neubau oder Umbau) in: ${orteListe}${plzListe ? ` (PLZ: ${plzListe})` : ''}.

Zeitlogik:
- Artikel erschienen: ${dates.from10} bis ${dates.today}
- Fertigstellung: nach ${dates.plus6} – ältere Projekte NICHT aufnehmen
- Mindestgröße: 500 m² Bürofläche

Quellen: blachreport.de, immobilienzeitung.de, städtische Bauprojektlisten, vergabepilot.ai, Pressemitteilungen von Projektentwicklern, lokale Wirtschaftsmedien

Pro Projekt sammle: Projektname, Standort, PLZ, Bürofläche m², Arbeitsplätze, Fertigstellung, Projekttyp, Ausschreibungsstatus.

Ansprechpartner in dieser Priorität:
1. Innenarchitekt / Interieur-Designer (wichtigster Kontakt für Möbel)
2. Geplanter Mieter/Nutzer
3. Auftraggeber/Projektentwickler
4. Hochbauarchitekt (nur wenn kein Innenarchitekt bekannt)

Pro Kontakt: Firma, Name Ansprechpartner, Adresse, Telefon, E-Mail, URL

Ziel: 3-8 Projekte mit möglichst vollständigen Kontaktdaten.` }]
      })
    });

    const searchData = await searchResp.json();
    if (searchData.error?.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' }, projects: [] });
    if (searchData.error) return res.json({ error: searchData.error, projects: [] });

    const rawText = (searchData.content || []).map(b => {
      if (b.type === 'text') return b.text || '';
      if (b.type === 'web_search_tool_result') return (b.content || []).map(c => c.text || (c.document && c.document.text) || '').join('\n');
      return '';
    }).filter(Boolean).join('\n').substring(0, 5000);

    if (!rawText || rawText.length < 30) return res.json({ projects: [], _range: dates.range10 });

    await new Promise(r => setTimeout(r, 8000));

    const formatResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: `Gib NUR ein JSON-Array zurück. Beginne mit [ Kein Text. Kein Markdown. Alle Strings einzeilig. AUSSCHLIESSEN: Projekte mit Fertigstellung vor ${dates.plus6}.`,
        messages: [{ role: 'user', content: `Extrahiere Bauprojekte als JSON. Nur Fertigstellung nach ${dates.plus6}, nur ab 500m²:\n\n${rawText.substring(0, 3500)}\n\n[{"projektname":"...","beschreibung":"...","standort":"...","plz":"...","bueroflaeche":"...","arbeitsplaetze":"...","fertigstellung":"...","projekttyp":"Neubau oder Umbau","moebelbedarfEinschaetzung":"hoch oder mittel","ausschreibungsstatus":"...","kontakte":[{"rolle":"Innenarchitekt oder Interieur-Designer oder Auftraggeber oder Architekt oder Mieter","firma":"...","ansprechpartner":"...","adresse":"...","telefon":"...","email":"...","url":"..."}],"quelleUrl":"https://...","alleDaten":{}}]` }]
      })
    });

    const formatData = await formatResp.json();
    if (formatData.error?.type === 'overloaded_error') return res.json({ projects: [], _range: dates.range10 });

    const jsonText = (formatData.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const match = jsonText.match(/\[[\s\S]*\]/);
    let projects = [];
    if (match) { try { projects = JSON.parse(match[0]); } catch(e) {} }

    return res.json({ projects, _range: dates.range10, _raw: rawText.substring(0, 500) });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message }, projects: [] });
  }
});

// ── COMPANY SEARCH ───────────────────────────────────────────────
app.post('/api/search', async (req, res) => {
  const { apiKey, orte, plzPrefixes, strictness } = req.body;
  if (!apiKey || !orte || !orte.length) return res.status(400).json({ error: 'Missing params' });

  const dates = getDateRange();
  const orteListe = orte.slice(0, 8).join(', ');
  const plzListe = plzPrefixes ? plzPrefixes.map(p => p + 'xxx').join(', ') : '';

  const strictMap = {
    streng:     'Nur starke Signale (Neubau, Baugenehmigung, Finanzierungsrunde). Nur klare inhabergeführte Unternehmen.',
    ausgewogen: 'Mittlere Signale reichen. Inhabergeführt bevorzugt.',
    breit:      'Auch schwächere Signale. Mehr Treffer, auch vagere.'
  };
  const strictRule = strictMap[strictness] || strictMap.ausgewogen;

  const signaleHoch = 'Neubau, Umbau, Erweiterungsbau, Baugenehmigung, neue Gewerbefläche, Bürogebäude geplant, Firmensitz verlegt, Einzug geplant, Finanzierungsrunde, Kapitalerhöhung, KfW-Förderung, BAFA-Förderung';
  const signaleMittel = 'Expansion, neuer Standort, Niederlassung, Mitarbeiterwachstum, Rekordumsatz, Fusion, Übernahme, New Work Einführung, neuer Geschäftsführer, Inhaberwechsel, Generationswechsel, Nachfolge, Restrukturierung';
  const signaleHiddenGem = 'Zertifizierung, Akkreditierung, Pflegefachschule eröffnet, Bildungsträger zugelassen, Spin-off, Vergabeausschreibung Büromöbel';

  try {
    // Branchenanalyse
    const branchenResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: `Nenne 4 wirtschaftlich starke Branchen in der Region ${orteListe}. Format: BRANCHE: [Name] | STAERKE: stark/moderat | BEGRUENDUNG: [2 Saetze] ---` }]
      })
    });
    const branchenData = await branchenResp.json();
    if (branchenData.error?.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
    if (branchenData.error) return res.json({ error: branchenData.error });
    const branchenText = (branchenData.content || []).filter(b => b.type === 'text').map(b => b.text).join('').substring(0, 800);

    await new Promise(r => setTimeout(r, 8000));

    // Lead-Suche
    const searchResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Du hast Live-Web-Suche. Heute ist ${dates.today}. Dein Trainingsstichtag ist irrelevant.`,
        messages: [{ role: 'user', content: `Suche nach inhabergeführten Unternehmen ab 50 Mitarbeitern in: ${orteListe}${plzListe ? ` (PLZ: ${plzListe})` : ''}.

Suche PARALLEL nach Ortsnamen UND PLZ-Bereichen.

ZEITLOGIK:
- Artikel erschienen: ${dates.from12} bis ${dates.today}
- Projektfertigstellung darf bis ${dates.today} +48 Monate liegen
- NUR Projekte die noch NICHT abgeschlossen sind

SIGNALE HOCH: ${signaleHoch}
SIGNALE MITTEL: ${signaleMittel}
HIDDEN GEMS: ${signaleHiddenGem}

Suche auf: städtischen Bauprojektlisten, vergabepilot.ai, lokalen Wirtschaftsmedien, Handelsregister

${strictRule}
Rechtsform egal (GmbH, AG, KG, e.K., etc.) – Hauptsache inhabergeführt.
NICHT aufnehmen: DAX-Konzerne, reine Konzernzentralen ohne lokalen Entscheider.

Pro Firma: Name, Ort, PLZ, Branche, Signal mit Datum und URL, GF/Inhaber-Name falls bekannt.
Ziel: 6-10 Firmennamen.` }]
      })
    });

    const searchData = await searchResp.json();
    if (searchData.error?.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
    if (searchData.error) return res.json({ error: searchData.error });

    const rawText = (searchData.content || []).map(b => {
      if (b.type === 'text') return b.text || '';
      if (b.type === 'web_search_tool_result') return (b.content || []).map(c => c.text || (c.document && c.document.text) || '').join('\n');
      return '';
    }).filter(Boolean).join('\n').substring(0, 5000);

    if (!rawText || rawText.length < 30) {
      return res.json({ error: { message: 'no_results' }, _debug: { rawLen: rawText.length } });
    }

    await new Promise(r => setTimeout(r, 8000));

    // JSON-Formatierung
    const formatResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: `Gib NUR ein JSON-Objekt zurück. Beginne mit {
${strictRule}
NICHT aufnehmen: DAX-Konzerne (VW, Continental, TUI, Siemens, BMW, BASF, Bayer, Allianz, Lufthansa etc.), Bürovermietungen, Coworking, Kammern, Portale, Phantomeinträge.
Projekte die bereits abgeschlossen sind: NICHT aufnehmen.
Priorität HOCH: starkes Signal (Neubau, Baugenehmigung, Finanzierungsrunde) + klar inhabergeführt
Priorität MITTEL: schwächeres Signal oder nur vage passend
Wenn keine Firmen: "leads":[]`,
        messages: [{ role: 'user', content: `BRANCHEN:\n${branchenText}\n\nSUCHERGEBNISSE:\n${rawText.substring(0, 3500)}\n\n{"branchen":[{"name":"...","staerke":"stark/moderat","begruendung":"..."}],"leads":[{"name":"Firmenname","branche":"...","ort":"...","plz":"...","prioritaet":"Hoch oder Mittel","signale":[{"text":"Konkretes Signal mit Datum","url":"https://..."}],"warumJetzt":"Warum in ${dates.today} relevant? Projektzeitraum nennen. 2-3 Saetze.","ansprechpartner":{"name":"GF/Inhaber Name oder nicht oeffentlich","funktion":"Inhaber oder GF"}}]}` }]
      })
    });

    const formatData = await formatResp.json();
    if (formatData.error?.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
    if (formatData.error) return res.json({ error: formatData.error });

    const jsonText = (formatData.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return res.json({ _jsonText: jsonText, _dateRange: dates.range12, _orte: orteListe });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

// ── COMPANY PROFILE ──────────────────────────────────────────────
app.post('/api/company', async (req, res) => {
  const { apiKey, name, ort, branche } = req.body;
  if (!apiKey || !name) return res.status(400).json({ error: 'Missing params' });

  const vorlagen = {
    einstieg: [
      `Wir sind verliebt in das Konzept des perfekten Büros – und [TRIGGER] hat unser Interesse an [FIRMENNAME] geweckt.`,
      `[TRIGGER] – das ist genau der Moment, in dem wir als MYWORKSPACE gerne ins Gespräch kommen.`,
      `Glückwunsch zu [TRIGGER]! Solche Veränderungen sind der ideale Zeitpunkt, die Arbeitswelt neu zu denken.`
    ],
    positionierung: `Als 360-Grad-Partner für Bürolösungen begleiten wir Unternehmen von der ersten Planung bis zur fertigen Einrichtung – Licht, Akustik, Ergonomie, Zonen und Design aus einer Hand.`,
    bruecke: [
      `Gerade in der frühen Planungsphase entstehen die wichtigsten Weichen für eine motivierende Arbeitsumgebung.`,
      `Moderne Arbeitswelten sind mehr als Tische und Stühle – sie formen Kultur, Zusammenarbeit und Produktivität.`,
      `Der richtige Zeitpunkt für eine ganzheitliche Bürolösung ist jetzt – bevor Entscheidungen getroffen sind.`
    ],
    cta: `Ich würde mich freuen, Ihnen in einem kurzen, unverbindlichen Gespräch zu zeigen, was für Ihr Unternehmen möglich ist.`
  };

  try {
    const searchResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: `Recherchiere alle verfügbaren Infos über "${name}" in ${ort} (${branche}). Suche: Impressum (Adresse, Telefon, E-Mail), Website, LinkedIn, Pressemitteilungen, Mitarbeiterzahl, Kerngeschäft, News. Suche auch nach: Geschäftsführer, Inhaber, Office Manager, Facility Manager, Assistenz der Geschäftsleitung – alle Namen und Kontaktdaten die öffentlich zugänglich sind.` }]
      })
    });
    const searchData = await searchResp.json();
    if (searchData.error?.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
    if (searchData.error) return res.json({ error: searchData.error });

    const rawText = (searchData.content || []).map(b => {
      if (b.type === 'text') return b.text || '';
      if (b.type === 'web_search_tool_result') return (b.content || []).map(c => c.text || (c.document && c.document.text) || '').join(' ');
      return '';
    }).filter(Boolean).join('\n').substring(0, 4000);

    await new Promise(r => setTimeout(r, 8000));

    const formatResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: 'Gib NUR ein JSON-Objekt zurück. Beginne mit { Alle Strings einzeilig.',
        messages: [{ role: 'user', content: `JSON aus Firmendaten:\n\n${rawText}\n\n{"basis":{"adresse":"...","telefon":"...","email":"...","website":"...","gruendung":"...","mitarbeiter":"..."},"ansprechpartner":[{"name":"...","funktion":"GF oder Inhaber oder Office Manager oder Facility Manager oder Assistenz GF","telefon":"...","email":"..."}],"wettbewerb":{"positionierung":"...","segment":"Premium/Mitte/Budget"},"design_reife":{"stufe":2,"stufe_label":"...","begruendung":"..."},"bueroplanung":{"arbeitskultur":"...","raumbedarf":"...","new_work_affinitaet":"hoch/mittel/gering","new_work_begruendung":"..."},"linkedin":{"groesse":"...","wachstumstrend":"steigend/stabil/sinkend","offene_stellen":"...","expansion_indikator":"..."},"pressespiegel":[{"datum":"...","titel":"...","zusammenfassung":"...","vertriebsrelevanz":"..."}],"budget":{"umsatz_schaetzung":"...","cluster":"Einstieg/Mid/Premium","produktempfehlung":"..."},"quellen":[{"label":"...","url":"..."}]}` }]
      })
    });
    const formatData = await formatResp.json();
    if (formatData.error?.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
    if (formatData.error) return res.json({ error: formatData.error });

    const jsonText = (formatData.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const match = jsonText.match(/\{[\s\S]*\}/);
    let parsed = null;
    if (match) { try { parsed = JSON.parse(match[0]); } catch(e) {} }
    return res.json({ _data: parsed, _vorlagen: vorlagen });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => console.log(`MYWORKSPACE Lead-Finder running on port ${PORT}`));
