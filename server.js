const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── PLZ DATENBANK ──────────────────────────────────────────────
// Kompakte PLZ-Prefix zu Orte Zuordnung (2-3 stellig → Ortsnamen)
const PLZ_MAP = {
  '01': ['Dresden','Meißen','Radebeul','Coswig','Freital'],
  '02': ['Görlitz','Bautzen','Zittau','Hoyerswerda','Löbau'],
  '03': ['Cottbus','Spremberg','Forst','Guben'],
  '04': ['Leipzig','Borna','Grimma','Markkleeberg','Torgau'],
  '06': ['Halle','Merseburg','Dessau','Köthen','Weißenfels'],
  '07': ['Erfurt','Jena','Weimar','Gera','Altenburg'],
  '08': ['Chemnitz','Zwickau','Plauen','Aue','Stollberg'],
  '09': ['Chemnitz','Freiberg','Mittweida','Annaberg'],
  '10': ['Berlin-Mitte','Berlin-Tiergarten','Berlin-Wedding'],
  '11': ['Berlin'],
  '12': ['Berlin-Tempelhof','Berlin-Neukölln','Berlin-Treptow'],
  '13': ['Berlin-Wedding','Berlin-Reinickendorf','Berlin-Pankow'],
  '14': ['Berlin-Spandau','Berlin-Charlottenburg','Potsdam','Brandenburg'],
  '15': ['Potsdam','Königs Wusterhausen','Luckenwalde','Zossen'],
  '16': ['Oranienburg','Neuruppin','Bernau','Eberswalde'],
  '17': ['Neubrandenburg','Waren','Neustrelitz','Greifswald'],
  '18': ['Rostock','Wismar','Güstrow','Stralsund'],
  '19': ['Schwerin','Ludwigslust','Parchim','Hagenow'],
  '20': ['Hamburg-Mitte','Hamburg-Altstadt','Hamburg-Neustadt'],
  '21': ['Hamburg-Harburg','Lüneburg','Stade','Winsen','Buchholz'],
  '22': ['Hamburg-Eimsbüttel','Hamburg-Altona','Hamburg-Nord'],
  '23': ['Lübeck','Travemünde','Bad Schwartau','Ratzeburg'],
  '24': ['Kiel','Neumünster','Rendsburg','Eckernförde'],
  '25': ['Heide','Itzehoe','Brunsbüttel','Husum'],
  '26': ['Oldenburg','Wilhelmshaven','Delmenhorst','Emden'],
  '27': ['Bremen-Nord','Bremerhaven','Cuxhaven','Verden'],
  '28': ['Bremen','Delmenhorst'],
  '29': ['Celle','Uelzen','Lüneburg','Soltau','Walsrode'],
  '30': ['Hannover','Langenhagen','Garbsen'],
  '31': ['Hildesheim','Hameln','Peine','Springe'],
  '32': ['Herford','Minden','Bad Oeynhausen','Löhne'],
  '33': ['Bielefeld','Paderborn','Gütersloh','Detmold'],
  '34': ['Kassel','Hofgeismar','Bad Hersfeld','Fulda'],
  '35': ['Marburg','Gießen','Wetzlar','Limburg'],
  '36': ['Fulda','Bad Hersfeld','Hünfeld','Lauterbach'],
  '37': ['Göttingen','Northeim','Duderstadt','Herzberg'],
  '38': ['Braunschweig','Wolfsburg','Salzgitter','Wolfenbüttel'],
  '39': ['Magdeburg','Halberstadt','Stendal','Schönebeck'],
  '40': ['Düsseldorf','Ratingen','Erkrath'],
  '41': ['Mönchengladbach','Krefeld','Neuss','Grevenbroich'],
  '42': ['Wuppertal','Remscheid','Solingen','Velbert'],
  '44': ['Dortmund','Castrop-Rauxel','Lünen'],
  '45': ['Essen','Gelsenkirchen','Bottrop','Mülheim'],
  '46': ['Oberhausen','Dinslaken','Wesel','Moers'],
  '47': ['Duisburg','Krefeld','Kleve','Moers'],
  '48': ['Münster','Osnabrück','Rheine','Ibbenbüren'],
  '49': ['Osnabrück','Lingen','Nordhorn','Meppen'],
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
  '61': ['Frankfurt-Nord','Bad Homburg','Friedberg','Oberursel','Bad Vilbel'],
  '63': ['Offenbach','Aschaffenburg','Hanau','Seligenstadt'],
  '64': ['Darmstadt','Rüsselsheim','Groß-Gerau','Bensheim'],
  '65': ['Wiesbaden','Mainz-Kostheim','Rüdesheim','Bad Schwalbach'],
  '66': ['Saarbrücken','Saarlouis','Neunkirchen','Homburg'],
  '67': ['Ludwigshafen','Mannheim','Frankenthal','Speyer'],
  '68': ['Mannheim','Heidelberg','Ladenburg'],
  '69': ['Heidelberg','Weinheim','Sinsheim','Eberbach'],
  '70': ['Stuttgart','Fellbach','Kernen','Remseck'],
  '71': ['Ludwigsburg','Waiblingen','Backnang','Bietigheim'],
  '72': ['Tübingen','Reutlingen','Mössingen','Hechingen'],
  '73': ['Esslingen','Göppingen','Kirchheim','Nürtingen'],
  '74': ['Heilbronn','Öhringen','Neckarsulm','Mosbach'],
  '75': ['Pforzheim','Mühlacker','Bretten','Ettlingen'],
  '76': ['Karlsruhe','Baden-Baden','Rastatt','Bruchsal'],
  '77': ['Offenburg','Lahr','Kehl','Achern'],
  '78': ['Konstanz','Villingen-Schwenningen','Singen','Rottweil'],
  '79': ['Freiburg','Breisach','Müllheim','Bad Krozingen'],
  '80': ['München-Schwabing','München-Maxvorstadt','München-Innenstadt'],
  '81': ['München-Bogenhausen','München-Berg am Laim','München-Ramersdorf'],
  '82': ['München-Süd','Gauting','Starnberg','Weilheim','Germering'],
  '83': ['Rosenheim','Wasserburg','Traunstein','Bad Aibling'],
  '84': ['Landshut','Dingolfing','Straubing','Vilsbiburg'],
  '85': ['Ingolstadt','Erding','Freising','Moosburg','Eichstätt'],
  '86': ['Augsburg','Kaufbeuren','Memmingen','Dillingen','Donauwörth'],
  '87': ['Kempten','Kaufbeuren','Immenstadt','Sonthofen','Füssen'],
  '88': ['Ravensburg','Ulm-Süd','Friedrichshafen','Biberach','Leutkirch'],
  '89': ['Ulm','Neu-Ulm','Günzburg','Heidenheim','Blaubeuren'],
  '90': ['Nürnberg','Fürth','Erlangen'],
  '91': ['Nürnberg-Süd','Schwabach','Ansbach','Roth','Neumarkt'],
  '92': ['Amberg','Weiden','Cham','Schwandorf'],
  '93': ['Regensburg','Kelheim','Neustadt/Donau','Straubing'],
  '94': ['Passau','Deggendorf','Freyung','Zwiesel'],
  '95': ['Bayreuth','Hof','Kulmbach','Münchberg'],
  '96': ['Bamberg','Coburg','Lichtenfels','Kronach'],
  '97': ['Würzburg','Schweinfurt','Bad Kissingen','Aschaffenburg'],
  '98': ['Erfurt-Süd','Suhl','Meiningen','Hildburghausen'],
  '99': ['Erfurt','Gotha','Eisenach','Mühlhausen','Sondershausen']
};

function getOrteFromPlzPrefix(prefix) {
  prefix = prefix.trim();
  const orte = new Set();
  // Try 2-digit prefix
  const key2 = prefix.substring(0, 2);
  if (PLZ_MAP[key2]) PLZ_MAP[key2].forEach(o => orte.add(o));
  // Also check adjacent prefixes if 3 digits given
  if (prefix.length >= 3) {
    const key3base = prefix.substring(0, 2);
    if (PLZ_MAP[key3base]) PLZ_MAP[key3base].forEach(o => orte.add(o));
  }
  return [...orte];
}

function parsePlzInput(input) {
  // Parse input like "50", "50-53", "504", "50,51,52", "50-52 56"
  input = input.trim();
  const prefixes = new Set();
  // Split by comma, space
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
  // Get all orte
  const orte = new Set();
  prefixes.forEach(p => getOrteFromPlzPrefix(p).forEach(o => orte.add(o)));
  return { prefixes: [...prefixes], orte: [...orte] };
}

function getDateRange() {
  const now = new Date();
  const from12 = new Date(now); from12.setMonth(from12.getMonth() - 12);
  const from10 = new Date(now); from10.setMonth(from10.getMonth() - 10);
  const plus6 = new Date(now);  plus6.setMonth(plus6.getMonth() + 6);
  const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  return {
    today: `${months[now.getMonth()]} ${now.getFullYear()}`,
    from12: `${months[from12.getMonth()]} ${from12.getFullYear()}`,
    from10: `${months[from10.getMonth()]} ${from10.getFullYear()}`,
    plus6:  `${months[plus6.getMonth()]} ${plus6.getFullYear()}`,
    range12: `${months[from12.getMonth()]} ${from12.getFullYear()} bis ${months[now.getMonth()]} ${now.getFullYear()}`,
    range10: `${months[from10.getMonth()]} ${from10.getFullYear()} bis ${months[now.getMonth()]} ${now.getFullYear()}`
  };
}

// ── API: PLZ RESOLVE ────────────────────────────────────────────
app.post('/api/plz', (req, res) => {
  const { plz } = req.body;
  if (!plz) return res.status(400).json({ error: 'Missing plz' });
  const result = parsePlzInput(plz);
  if (!result.orte.length) return res.json({ error: 'PLZ-Bereich nicht erkannt. Bitte 2-3 stellige PLZ eingeben (z.B. 50 oder 50-53).' });
  return res.json({ orte: result.orte, prefixes: result.prefixes });
});

// ── API: SEARCH ─────────────────────────────────────────────────
app.post('/api/search', async (req, res) => {
  const { apiKey, orte, plzPrefixes, strictness } = req.body;
  if (!apiKey || !orte || !orte.length) return res.status(400).json({ error: 'Missing params' });

  const dates = getDateRange();
  const orteListe = orte.slice(0, 8).join(', ');
  const plzListe = plzPrefixes ? plzPrefixes.map(p => p + 'xxx').join(', ') : '';

  const strictMap = {
    streng:     'Nur starke Signale: direkte Raum- und Investitionssignale (Neubau, Baugenehmigung, Finanzierungsrunde). Nur klare GmbH, inhabergeführt.',
    ausgewogen: 'Mittlere Signale reichen: Expansion, neuer Standort, Führungswechsel, Fördergelder. GmbH bevorzugt.',
    breit:      'Auch schwächere Signale aufnehmen: Wachstum, Zertifizierung, neue Stellen. Mehr Treffer, auch vagere.'
  };
  const strictRule = strictMap[strictness] || strictMap.ausgewogen;

  // Prioritätsgruppen für Signale
  const signaleHoch = 'Neubau, Umbau, Erweiterungsbau, Baugenehmigung, neue Gewerbefläche, Bürogebäude geplant, Firmensitz verlegt, Einzug geplant, Finanzierungsrunde, Kapitalerhöhung, KfW-Förderung, BAFA-Förderung';
  const signaleMittel = 'Expansion, neuer Standort, Niederlassung, Tochtergesellschaft, Mitarbeiterwachstum, Rekordumsatz, Fusion, Übernahme, Ausgründung, New Work Einführung, neuer Geschäftsführer, Inhaberwechsel, Generationswechsel, Nachfolge, Restrukturierung, Spin-off';
  const signaleHiddenGem = 'Zertifizierung erhalten, Akkreditierung, Neuzulassung, Pflegefachschule eröffnet, Bildungsträger zugelassen, Vergabeausschreibung Büromöbel';

  try {
    // SCHRITT 1: Branchenanalyse (Sonnet, kein Web-Search)
    const branchenResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: `Welche 4 Branchen sind wirtschaftlich stark in der Region ${orteListe}? Nutze dein Wissen über DAX/MDAX/TecDAX, ifo-Index, KfW-Förderungen, regionale Cluster. Format: BRANCHE: [Name] | STAERKE: stark/moderat | BEGRUENDUNG: [2 Saetze] ---` }]
      })
    });
    const branchenData = await branchenResp.json();
    if (branchenData.error?.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
    if (branchenData.error) return res.json({ error: branchenData.error });
    const branchenText = (branchenData.content || []).filter(b => b.type === 'text').map(b => b.text).join('').substring(0, 1000);

    await new Promise(r => setTimeout(r, 8000));

    // SCHRITT 2: Lead-Suche (Sonnet + Web-Search)
    const searchResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Du hast Live-Web-Suche. Heute ist ${dates.today}. Suche aktiv im Web. Dein Trainingsstichtag ist irrelevant.`,
        messages: [{ role: 'user', content: `Suche nach inhabergeführten Mittelständlern (100-500 MA, mind. 30-40% Büroanteil) in diesen Orten: ${orteListe}${plzListe ? ` (PLZ-Bereiche: ${plzListe})` : ''}.

Suche PARALLEL nach Ortsnamen UND PLZ-Bereichen.

KRITISCHE ZEITLOGIK – sehr wichtig:
- Artikel/Meldungen erschienen: ${dates.from} bis ${dates.today} (letzte 12 Monate)
- Projektfertigstellung muss NOCH IN DER ZUKUNFT liegen: nach ${dates.today}
- Ideal: Projekte geplant für 2026, 2027, 2028, 2029
- AUSSCHLIESSEN: Projekte die bereits abgeschlossen, bezogen oder eingeweiht wurden
- AUSSCHLIESSEN: "bereits fertiggestellt", "wurde bezogen", "ist eröffnet", "abgeschlossen 2024/2025"
- Wir suchen Firmen die sich GERADE VORBEREITEN – nicht die bereits eingezogen sind

Bevorzugte Signale (Projekt noch offen):
- Baugenehmigung beantragt oder erteilt
- Spatenstich erfolgt, Bau läuft
- Neubau/Umbau geplant für 2026-2029
- Finanzierungsrunde für Expansion
- Neue Niederlassung angekündigt aber noch nicht eröffnet
- Mietvertrag für neue Fläche unterzeichnet

Signale mit HOHER Priorität: ${signaleHoch}
Signale mit MITTLERER Priorität: ${signaleMittel}
Hidden Gems: ${signaleHiddenGem}

Suche auch auf:
- Städtischen Bauprojektlisten (stadtname.de/bauprojekte oder ähnlich)
- vergabepilot.ai (Ausschreibungen Büromöbel)
- Lokalen Wirtschaftszeitungen und Handelsregister-Bekanntmachungen

${strictRule}
Keine Konzerne, keine DAX-Unternehmen. Nur GmbH oder kleine inhabergeführte AGs.

Für jede Firma: Name, Ort, PLZ falls bekannt, Branche, konkretes Signal mit Datum und geplantem Fertigstellungstermin, URL, GF/Inhaber-Name falls auffindbar.
Ziel: 8-10 konkrete Firmennamen mit offenen, zukünftigen Projekten.` }]
      })
    });
    const searchData = await searchResp.json();
    if (searchData.error?.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
    if (searchData.error) return res.json({ error: searchData.error });

    const rawText = (searchData.content || []).map(b => {
      if (b.type === 'text') return b.text || '';
      if (b.type === 'web_search_tool_result') return (b.content || []).map(c => c.text || c.document?.text || '').join('\n');
      return '';
    }).filter(Boolean).join('\n').substring(0, 5000);

    if (!rawText || rawText.length < 30) {
      return res.json({ error: { message: 'no_results' }, _debug: {
        blocks: (searchData.content||[]).map(b=>b.type),
        rawLen: rawText.length,
        preview: rawText.substring(0,300),
        apiError: searchData.error||null
      }});
    }

    await new Promise(r => setTimeout(r, 8000));

    // SCHRITT 3: JSON-Formatierung (Haiku)
    const formatResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2500,
        system: `Gib NUR ein JSON-Objekt zurück. Beginne mit {
FILTER: ${strictRule}
NIEMALS aufnehmen: DAX/MDAX-Konzerne, VW, Continental, TUI, Siemens, Deutsche Messe, Hannover Rück, Talanx, Allianz, BMW, BASF, Bayer, Bürovermietungen, Coworking, Kammern, Portale, Phantomeinträge.
NIEMALS aufnehmen: Firmen deren Projekt bereits abgeschlossen, bezogen oder eröffnet ist. Nur Projekte die noch IN DER ZUKUNFT liegen.
Priorität HOCH: Projekt geplant 2026-2029 + starkes Signal (Baugenehmigung, Spatenstich, Finanzierungsrunde)
Priorität MITTEL: Projekt noch offen aber schwächeres Signal oder Datum unklar
Wenn keine echten offenen Projekte: "leads":[]`,
        messages: [{ role: 'user', content: `BRANCHEN:\n${branchenText}\n\nSUCHERGEBNISSE:\n${rawText.substring(0, 3500)}\n\n{"branchen":[{"name":"...","staerke":"stark/moderat","begruendung":"..."}],"leads":[{"name":"Firmenname GmbH","branche":"...","ort":"...","plz":"...","prioritaet":"Hoch oder Mittel","signalGruppe":"Hoch oder Mittel oder Hidden Gem","signale":[{"text":"Konkretes Signal mit Datum und Projektinhalt","url":"https://..."}],"warumJetzt":"Warum in ${dates.today} relevant? Trigger-Zeitpunkt nennen. Projektzeitraum nennen falls bekannt. 2-3 Saetze ohne Fachbegriffe.","ansprechpartner":{"name":"nicht oeffentlich","funktion":"Inhaber oder GF"}}]}` }]
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

// ── API: COMPANY PROFILE ────────────────────────────────────────
app.post('/api/company', async (req, res) => {
  const { apiKey, name, ort, branche } = req.body;
  if (!apiKey || !name) return res.status(400).json({ error: 'Missing params' });

  // Textbausteine Vorlagen (MYWORKSPACE Tonalität)
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
    // STEP 1: Recherche mit Web-Suche
    const searchResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: `Recherchiere Informationen über "${name}" in ${ort} (${branche}). Suche: Impressum (Adresse, Telefon, E-Mail, GF-Name), Website, LinkedIn, aktuelle Pressemitteilungen, Mitarbeiterzahl, Kerngeschäft, aktuelle News und Wachstumssignale.` }]
      })
    });
    const searchData = await searchResp.json();
    if (searchData.error?.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
    if (searchData.error) return res.json({ error: searchData.error });

    const rawText = (searchData.content || []).map(b => {
      if (b.type === 'text') return b.text || '';
      if (b.type === 'web_search_tool_result') return (b.content || []).map(c => c.text || c.document?.text || '').join(' ');
      return '';
    }).filter(Boolean).join('\n').substring(0, 4000);

    await new Promise(r => setTimeout(r, 8000));

    // STEP 2: JSON-Formatierung
    const formatResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: 'Gib NUR ein JSON-Objekt zurück. Beginne mit { Alle Strings einzeilig (kein \\n in Strings).',
        messages: [{ role: 'user', content: `Erstelle JSON aus diesen Firmendaten:\n\n${rawText}\n\n{"basis":{"adresse":"...","telefon":"...","email":"...","website":"...","gruendung":"...","mitarbeiter":"..."},"wettbewerb":{"positionierung":"...","segment":"Premium/Mitte/Budget","differenzierung":"..."},"design_reife":{"stufe":2,"stufe_label":"Design-bewusst","begruendung":"..."},"bueroplanung":{"arbeitskultur":"...","raumbedarf":"...","new_work_affinitaet":"hoch/mittel/gering","new_work_begruendung":"..."},"linkedin":{"groesse":"...","wachstumstrend":"steigend/stabil/sinkend","offene_stellen":"...","expansion_indikator":"..."},"pressespiegel":[{"datum":"...","titel":"...","zusammenfassung":"...","vertriebsrelevanz":"..."}],"budget":{"umsatz_schaetzung":"...","cluster":"Einstieg/Mid/Premium","produktempfehlung":"..."},"ansprechpartner":[{"name":"...","funktion":"GF oder Inhaber","telefon":"nicht oeffentlich","email":"nicht oeffentlich"}],"quellen":[{"label":"...","url":"..."}]}` }]
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

// ── API: PROJECT SEARCH ─────────────────────────────────────────
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
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Du hast Live-Web-Suche. Heute ist ${dates.today}. Suche aktiv.`,
        messages: [{ role: 'user', content: `Suche nach konkreten Büro-Bauprojekten (Neubau oder Umbau) in dieser Region: ${orteListe}${plzListe ? ` (PLZ: ${plzListe})` : ''}.

Zeitlogik:
- Artikel/Meldungen erschienen: ${dates.from10} bis ${dates.today} (letzte 10 Monate)
- Fertigstellung des Projekts: frühestens ${dates.plus6} (mind. 6 Monate in der Zukunft), nach oben offen
- NUR Projekte die noch NICHT fertiggestellt sind

Mindestgröße: ab 500 m² Bürofläche

Suche auf folgenden Quellen:
- blachreport.de
- immobilienzeitung.de
- Städtische Bauprojektlisten (z.B. stadtname.de/bauprojekte)
- Pressemitteilungen von Projektentwicklern
- vergabepilot.ai
- Lokale Wirtschaftsmedien

Für jedes Projekt sammle ALLE verfügbaren Infos:
- Projektname und Beschreibung
- Standort und PLZ
- Bürofläche m² und Arbeitsplätze
- Fertigstellungstermin
- Projekttyp (Neubau / Umbau)
- Möbelbedarf-Einschätzung
- Ausschreibungsstatus
- Auftraggeber: Firmenname, Adresse, Telefon, E-Mail, Ansprechpartner
- Architekturbüro: Firmenname, Adresse, Telefon, E-Mail, Ansprechpartner
- Interieur-Verantwortlicher: Firmenname, Adresse, Telefon, E-Mail, Ansprechpartner
- Geplanter Mieter/Nutzer falls bekannt: Firmenname, Kontakt
- URL der Quelle

Ziel: 3-6 konkrete Projekte mit möglichst vollständigen Kontaktdaten.` }]
      })
    });

    const searchData = await searchResp.json();
    if (searchData.error?.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
    if (searchData.error) return res.json({ error: searchData.error });

    const rawText = (searchData.content || []).map(b => {
      if (b.type === 'text') return b.text || '';
      if (b.type === 'web_search_tool_result') return (b.content || []).map(c => c.text || (c.document && c.document.text) || '').join(' ');
      return '';
    }).filter(Boolean).join('\n').substring(0, 5000);

    if (!rawText || rawText.length < 30) return res.json({ error: { message: 'no_results' } });

    await new Promise(r => setTimeout(r, 8000));

    // Format as JSON
    const formatResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: `Gib NUR ein JSON-Array zurück. Beginne mit [ Kein Text. Kein Markdown. Alle Strings einzeilig. STRIKT AUSSCHLIESSEN: Jedes Projekt mit Fertigstellung vor ${dates.plus6} – diese nicht aufnehmen, auch nicht mit Hinweis. Nur Projekte mit Fertigstellung nach ${dates.plus6}.`,
        messages: [{ role: 'user', content: `Extrahiere Bauprojekte aus diesem Text als JSON-Array. Nur Projekte mit Fertigstellung nach ${dates.plus6}. Nur Büroprojekte ab 500m².

${rawText.substring(0,3500)}

[{"projektname":"...","beschreibung":"...","standort":"...","plz":"...","bueroflaeche":"z.B. 2.500 m²","arbeitsplaetze":"z.B. 100","fertigstellung":"z.B. Q2 2027","projekttyp":"Neubau oder Umbau","moebelbedarfEinschaetzung":"hoch oder mittel","ausschreibungsstatus":"Geplant oder Offen oder Vergeben","auftraggeber":{"firma":"...","adresse":"...","telefon":"...","email":"...","ansprechpartner":"..."},"architekt":{"firma":"...","adresse":"...","telefon":"...","email":"...","ansprechpartner":"..."},"interieur":{"firma":"...","adresse":"...","telefon":"...","email":"...","ansprechpartner":"..."},"mieter":{"firma":"...","kontakt":"..."},"quelleUrl":"https://..."}]` }]
      })
    });

    const formatData = await formatResp.json();
    if (formatData.error?.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
    if (formatData.error) return res.json({ error: formatData.error });

    const jsonText = (formatData.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const match = jsonText.match(/\[[\s\S]*\]/);
    let projects = [];
    if (match) { try { projects = JSON.parse(match[0]); } catch(e) {} }

    return res.json({ projects, _range: dates.range10 });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => console.log(`MYWORKSPACE Lead-Finder running on port ${PORT}`));
