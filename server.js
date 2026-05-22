const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getDateRange() {
  const now = new Date();
  const from = new Date(now);
  from.setFullYear(from.getFullYear() - 1);
  const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  return {
    today: `${months[now.getMonth()]} ${now.getFullYear()}`,
    from: `${months[from.getMonth()]} ${from.getFullYear()}`,
    range: `${months[from.getMonth()]} ${from.getFullYear()} bis ${months[now.getMonth()]} ${now.getFullYear()}`
  };
}

// Region suggestion endpoint
app.post('/api/region', async (req, res) => {
  const { apiKey, city } = req.body;
  if (!apiKey || !city) return res.status(400).json({ error: 'Missing params' });

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: 'Antworte NUR mit einem JSON-Array aus 4-6 Städtenamen. Kein Text.',
        messages: [{ role: 'user', content: `Welche 4-6 Städte gehören zur Wirtschaftsregion von ${city} in Deutschland? Nur die wichtigsten, wirtschaftlich relevanten Städte im unmittelbaren Umkreis. JSON-Array: ["Stadt1","Stadt2",...]` }]
      })
    });
    const data = await resp.json();
    if (data.error) return res.json({ error: data.error });
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const match = text.match(/\[[\s\S]*\]/);
    const cities = match ? JSON.parse(match[0]) : [city];
    return res.json({ cities });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Main search endpoint
app.post('/api/search', async (req, res) => {
  const { apiKey, cities, modus, strictness } = req.body;
  if (!apiKey || !cities || !cities.length) return res.status(400).json({ error: 'Missing params' });

  const dates = getDateRange();
  const stadteListe = cities.join(', ');

  // Strictness settings
  const strictMap = {
    streng:      { label: 'nur klare GmbH, starke Signale, inhabergeführt', minSignals: 'starke' },
    ausgewogen:  { label: 'GmbH bevorzugt, mittlere Signale reichen, überwiegend inhabergeführt', minSignals: 'mittlere' },
    breit:       { label: 'auch kleine AGs, schwächere Signale werden aufgenommen, mehr Treffer aber auch vagere', minSignals: 'auch schwächere' }
  };
  const strict = strictMap[strictness] || strictMap.ausgewogen;

  // Modus settings
  const modusMap = {
    mittelstand: {
      size: '100–500 Mitarbeiter, inhabergeführt',
      signals: 'Stellenanzeigen für Bürojobs/Office Manager, Pressemeldungen neuer Standort, Handelsregistereintrag, Finanzierungsrunde, Umzugsmeldung',
      contact: 'Inhaber oder Geschäftsführer',
      goal: 'direkter Auftrag beim Entscheider'
    },
    grosskunde: {
      size: 'ab 500 Mitarbeiter, auch nicht inhabergeführt',
      signals: 'Reorganisation, neue Niederlassung, Pilotprojekt New Work, Wechsel im Facility Management, Abteilungsumzug, Digitalisierungsoffensive',
      contact: 'Facility Manager, Office Manager, Abteilungsleiter – jemand mit lokaler Entscheidungskompetenz',
      goal: 'Einstieg über Teilprojekt als Türöffner für Rahmenvertrag'
    }
  };
  const mod = modusMap[modus] || modusMap.mittelstand;

  try {
    // STEP 1: Branchenanalyse (Sonnet, kein Web-Search)
    const branchenResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: `Nenne 5 wirtschaftlich starke Branchen in der Region ${stadteListe}. Format: BRANCHE: [Name] | STAERKE: stark/moderat | BEGRUENDUNG: [2 Saetze mit regionalem Bezug] ---` }]
      })
    });
    const branchenData = await branchenResp.json();
    if (branchenData.error?.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
    if (branchenData.error) return res.json({ error: branchenData.error });
    const branchenText = (branchenData.content || []).filter(b => b.type === 'text').map(b => b.text).join('').substring(0, 1000);

    await new Promise(r => setTimeout(r, 8000));

    // STEP 2: Lead-Suche (Sonnet + Web-Search, breitere Signale)
    const searchResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Du hast Live-Web-Suche. Nutze sie aktiv. Dein Trainingsstichtag ist irrelevant – du kannst JETZT suchen.`,
        messages: [{ role: 'user', content: `Suche nach Unternehmen (${mod.size}) in ${stadteListe} die sich verändern. Signale: ${mod.signals}. Zeitraum: ${dates.range}. Ziel: 8-10 Firmennamen.

Fuehre mehrere Suchen durch:
- "${stadteListe.split(',')[0]} GmbH expandiert Büro 2025 2026"
- "${stadteListe.split(',')[0]} Unternehmen neuer Standort Mitarbeiter 2025"
- "${stadteListe.split(',')[0]} GmbH Finanzierung Wachstum 2025"
- "${stadteListe.split(',')[0]} Firma Umzug Büro 2025 2026"
- "${stadteListe.split(',')[0]} Office Manager Stellenanzeige 2025"

Für jede Firma: Name, Ort, was gefunden, URL, Ansprechpartner (${mod.contact}) falls im Impressum auffindbar. Keine Konzerne, keine DAX-Unternehmen.` }]
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

    if (!rawText || rawText.length < 50) return res.json({ error: { message: 'no_results' } });

    await new Promise(r => setTimeout(r, 8000));

    // STEP 3: JSON-Formatierung (Haiku, kein Web-Search)
    const formatResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: `Gib NUR ein JSON-Objekt zurueck. Beginne mit {
Filter (${strict.label}):
- NICHT: DAX/MDAX-Konzerne, boersennotierte Unternehmen, Siemens, VW, Continental, TUI, Deutsche Messe, Hannover Rueck, Talanx, Allianz, BMW, BASF, Bayer und aehnliche Grosskonzerne
- NICHT: Burovermietungen, Coworking, Kammern, Jobportale
- NICHT: Phantomeintraege wie "Keine Daten"
- Prioritaet HOCH: ${strict.minSignals} Signale + klar zur Zielgruppe passend
- Prioritaet MITTEL: schwaecher oder nur vage passend
- Wenn keine Firmen: "leads":[]`,
        messages: [{ role: 'user', content: `BRANCHEN:\n${branchenText}\n\nSUCHERGEBNISSE:\n${rawText.substring(0, 3500)}\n\n{"branchen":[{"name":"...","staerke":"stark/moderat","begruendung":"..."}],"leads":[{"name":"Firmenname","branche":"...","ort":"...","prioritaet":"Hoch oder Mittel","signale":[{"text":"Konkretes Signal","url":"https://..."}],"warumJetzt":"Warum jetzt relevant? 2-3 Saetze ohne Fachbegriffe.","ansprechpartner":{"name":"nicht oeffentlich","funktion":"${mod.contact.split(',')[0]}"}}]}` }]
      })
    });
    const formatData = await formatResp.json();
    if (formatData.error?.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
    if (formatData.error) return res.json({ error: formatData.error });

    const jsonText = (formatData.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return res.json({ _jsonText: jsonText, _dateRange: dates.range, _staedte: stadteListe });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

// Company profile endpoint (Client Screening) - two-step
app.post('/api/company', async (req, res) => {
  const { apiKey, name, ort, branche, modus } = req.body;
  if (!apiKey || !name) return res.status(400).json({ error: 'Missing params' });

  const contactFocus = modus === 'grosskunde'
    ? 'Facility Manager, Office Manager und Abteilungsleiter'
    : 'Geschaeftsfuehrer und Inhaber';

  try {
    // STEP 1: Recherche mit Web-Suche (Freitext)
    const searchResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: `Recherchiere alle verfuegbaren Informationen ueber die Firma "${name}" in ${ort} (Branche: ${branche}). Suche: Impressum (Adresse, Telefon, Email, GF-Name), Unternehmenswebsite, LinkedIn-Profil, aktuelle Pressemitteilungen. Beschreibe Unternehmenskultur, Design-Erscheinung, Wachstum und aktuelle News.` }]
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

    // STEP 2: JSON-Formatierung ohne Web-Suche
    const formatResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        system: 'Gib NUR ein JSON-Objekt zurueck. Beginne mit { Kein Text. Kein Markdown. Alle Strings muessen valides JSON sein (keine Zeilenumbrueche in Strings).',
        messages: [{ role: 'user', content: `Erstelle ein JSON-Objekt aus diesen Firmendaten. Alle Texte in einer Zeile (keine \n in Strings):\n\n${rawText}\n\n{"basis":{"adresse":"...","telefon":"...","email":"...","website":"...","gruendung":"...","mitarbeiter":"..."},"selbstbild":{"farben":{"beschreibung":"...","hex_codes":[]},"typografie":"...","bildwelt":"...","tonalitaet":"...","keywords":[]},"fremdbild":{"bewertungen":"...","medien":"...","recruiting":"..."},"wettbewerb":{"positionierung":"...","differenzierung":"...","segment":"Premium oder Mitte oder Budget","awards":"..."},"design_reife":{"stufe":2,"stufe_label":"...","begruendung":"..."},"bueroplanung":{"arbeitskultur":"...","raumbedarf":"...","aesthetik_praeferenz":"...","new_work_affinitaet":"mittel","new_work_begruendung":"..."},"linkedin":{"groesse":"...","wachstumstrend":"steigend","wachstum_begruendung":"...","offene_stellen":"...","expansion_indikator":"..."},"pressespiegel":[{"datum":"...","titel":"...","zusammenfassung":"...","relevanz_vertrieb":"..."}],"budget":{"umsatz_schaetzung":"...","mitarbeiterzahl":"...","cluster":"Mid","cluster_begruendung":"...","produktempfehlung":"..."},"ansprechpartner":[{"name":"...","funktion":"${contactFocus}","telefon":"nicht oeffentlich","email":"nicht oeffentlich"}],"empfehlung":"Konkreter Einstiegssatz fuer MYWORKSPACE","quellen":[{"label":"...","url":"..."}]}` }]
      })
    });
    const formatData = await formatResp.json();
    if (formatData.error?.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
    if (formatData.error) return res.json({ error: formatData.error });

    const jsonText = (formatData.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const match = jsonText.match(/\{[\s\S]*\}/);
    let parsed = null;
    if (match) { try { parsed = JSON.parse(match[0]); } catch(e) {} }

    return res.json({ _data: parsed, _raw: jsonText });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => console.log(`MYWORKSPACE Lead-Finder running on port ${PORT}`));
