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

// Gibt Nachbarstädte basierend auf Radius zurück
function getNearbyStadte(location, radius) {
  const stadtMap = {
    'koeln': { 10: ['Köln'], 25: ['Köln','Leverkusen','Hürth','Bergisch Gladbach'], 50: ['Köln','Leverkusen','Bonn','Düsseldorf','Wuppertal','Aachen'], 75: ['Köln','Bonn','Düsseldorf','Aachen','Wuppertal','Mönchengladbach'], 100: ['Köln','Bonn','Düsseldorf','Aachen','Wuppertal','Dortmund','Essen'] },
    'berlin': { 10: ['Berlin'], 25: ['Berlin','Potsdam'], 50: ['Berlin','Potsdam','Brandenburg'], 75: ['Berlin','Potsdam','Brandenburg','Frankfurt Oder'], 100: ['Berlin','Potsdam','Brandenburg','Frankfurt Oder','Cottbus','Magdeburg'] },
    'hamburg': { 10: ['Hamburg'], 25: ['Hamburg','Lübeck'], 50: ['Hamburg','Lübeck','Kiel','Schwerin'], 75: ['Hamburg','Lübeck','Kiel','Schwerin','Bremen'], 100: ['Hamburg','Lübeck','Kiel','Schwerin','Bremen','Hannover'] },
    'münchen': { 10: ['München'], 25: ['München','Augsburg'], 50: ['München','Augsburg','Ingolstadt','Rosenheim'], 75: ['München','Augsburg','Ingolstadt','Rosenheim','Landshut'], 100: ['München','Augsburg','Ingolstadt','Regensburg','Salzburg'] },
    'frankfurt': { 10: ['Frankfurt'], 25: ['Frankfurt','Offenbach','Darmstadt'], 50: ['Frankfurt','Offenbach','Darmstadt','Wiesbaden','Mainz'], 75: ['Frankfurt','Darmstadt','Wiesbaden','Mainz','Mannheim'], 100: ['Frankfurt','Darmstadt','Wiesbaden','Mannheim','Heidelberg','Kassel'] },
    'hannover': { 10: ['Hannover'], 25: ['Hannover','Hildesheim'], 50: ['Hannover','Hildesheim','Braunschweig','Hameln'], 75: ['Hannover','Hildesheim','Braunschweig','Hameln','Bielefeld'], 100: ['Hannover','Hildesheim','Braunschweig','Bielefeld','Wolfsburg','Paderborn'] },
    'stuttgart': { 10: ['Stuttgart'], 25: ['Stuttgart','Ludwigsburg','Esslingen'], 50: ['Stuttgart','Ludwigsburg','Esslingen','Heilbronn','Tübingen'], 75: ['Stuttgart','Heilbronn','Tübingen','Reutlingen','Karlsruhe'], 100: ['Stuttgart','Heilbronn','Karlsruhe','Mannheim','Ulm'] },
    'düsseldorf': { 10: ['Düsseldorf'], 25: ['Düsseldorf','Köln','Mönchengladbach'], 50: ['Düsseldorf','Köln','Mönchengladbach','Duisburg','Essen'], 75: ['Düsseldorf','Köln','Essen','Dortmund','Aachen'], 100: ['Düsseldorf','Köln','Essen','Dortmund','Aachen','Bonn'] },
    'leipzig': { 10: ['Leipzig'], 25: ['Leipzig','Halle'], 50: ['Leipzig','Halle','Dessau','Bitterfeld'], 75: ['Leipzig','Halle','Dresden','Chemnitz'], 100: ['Leipzig','Halle','Dresden','Chemnitz','Erfurt','Magdeburg'] },
    'dresden': { 10: ['Dresden'], 25: ['Dresden','Radebeul'], 50: ['Dresden','Chemnitz','Bautzen'], 75: ['Dresden','Chemnitz','Zwickau','Görlitz'], 100: ['Dresden','Chemnitz','Leipzig','Zwickau','Görlitz'] }
  };
  const key = location.toLowerCase().replace(/ü/g,'ü').replace(/ö/g,'ö').replace(/ä/g,'ä');
  const found = stadtMap[key] || stadtMap[Object.keys(stadtMap).find(k => location.toLowerCase().includes(k)) || ''];
  if (found) {
    const r = parseInt(radius);
    if (r <= 10) return found[10] || [location];
    if (r <= 25) return found[25] || [location];
    if (r <= 50) return found[50] || [location];
    if (r <= 75) return found[75] || [location];
    return found[100] || [location];
  }
  return [location];
}

app.post('/api/search', async (req, res) => {
  const { apiKey, location, radius } = req.body;
  if (!apiKey || !location) {
    return res.status(400).json({ error: { message: 'Fehlende Parameter.' } });
  }

  const dates = getDateRange();
  const staedte = getNearbyStadte(location, radius);
  const stadteListe = staedte.join(', ');

  try {
    // SCHRITT 1: Branchenanalyse – Sonnet ohne Web-Suche
    const branchenResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Nenne 5 wirtschaftlich starke Branchen in der Region ${location} (${stadteListe}). Nutze dein Wissen ueber regionale Wirtschaftscluster, DAX/MDAX-Entwicklungen, ifo-Index. Format: BRANCHE: [Name] | STAERKE: stark/moderat | BEGRUENDUNG: [2 Saetze] ---`
        }]
      })
    });

    const branchenData = await branchenResp.json();
    if (branchenData.error) {
      if (branchenData.error.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
      return res.json({ error: branchenData.error });
    }
    const branchenText = (branchenData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\n').substring(0, 1000);

    await new Promise(r => setTimeout(r, 8000));

    // SCHRITT 2: Lead-Suche – Sonnet mit Web-Suche, mehrere Staedte + Signaltypen
    const suchbegriffe = staedte.slice(0, 3).flatMap(s => [
      `"${s}" Unternehmen neues Buero Expansion 2025 2026`,
      `"${s}" GmbH Startup Finanzierung Wachstum 2025`,
      `"${s}" Firma Umzug neue Raeume Mitarbeiter 2025`
    ]).slice(0, 6).join('\n- ');

    const searchResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Du hast ein Live-Web-Such-Tool. Dein Trainingsstichtag ist IRRELEVANT – du kannst JETZT aktuelle Webseiten durchsuchen. Fuehre alle Suchen aktiv durch und liste echte Firmennamen.`,
        messages: [{
          role: 'user',
          content: `Fuehre diese Web-Suchen durch und liste ALLE echten Firmennamen die du findest:\n- ${suchbegriffe}\n\nZiel: mindestens 8-10 verschiedene echte Firmennamen. Falls eine Suche wenig bringt, variiere die Begriffe und suche weiter. Fuer jeden Firmennamen: Name, Ort, was du gefunden hast, URL. Suche danach das Impressum der Firma fuer GF/Inhaber-Name. Nur echte Firmen – keine Portale, Kammern oder Netzwerke.`
        }]
      })
    });

    const searchData = await searchResp.json();
    if (searchData.error) {
      if (searchData.error.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
      return res.json({ error: searchData.error });
    }

    // Extrahiere Text aus allen Block-Typen
    const rawText = (searchData.content || []).map(b => {
      if (b.type === 'text') return b.text || '';
      if (b.type === 'web_search_tool_result') {
        if (Array.isArray(b.content)) {
          return b.content.map(c => {
            if (typeof c === 'string') return c;
            if (c.type === 'document') return (c.document && c.document.text) || '';
            if (c.type === 'text') return c.text || '';
            return JSON.stringify(c).substring(0, 300);
          }).join('\n');
        }
        return JSON.stringify(b.content || '').substring(0, 1000);
      }
      if (b.type === 'tool_result') {
        return (b.content || []).map(c => c.text || '').join('\n');
      }
      return '';
    }).filter(Boolean).join('\n').substring(0, 6000);

    if (!rawText || rawText.length < 80) {
      const debugBlocks = (searchData.content || []).map(b => ({ type: b.type, preview: JSON.stringify(b).substring(0, 150) }));
      return res.json({ error: { message: 'Keine Suchergebnisse.' }, _debug: { blocks: debugBlocks } });
    }

    await new Promise(r => setTimeout(r, 8000));

    // SCHRITT 3: JSON-Formatierung – Haiku
    const formatResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: `Gib NUR ein JSON-Objekt zurueck. Beginne mit {
STRIKTE REGEL: Nur echte Unternehmen. NIEMALS: "Keine Daten", "N/A", Burovermietungen, Coworking-Anbieter, Kammern, Jobportale.
Wenn keine echten Firmen: "leads": []`,
        messages: [{
          role: 'user',
          content: `BRANCHEN:\n${branchenText}\n\nSUCHERGEBNISSE:\n${rawText.substring(0,4000)}\n\n{"branchen":[{"name":"...","staerke":"stark/moderat","begruendung":"..."}],"leads":[/* bis zu 10 echte Firmen */{"name":"Echter Firmenname","branche":"...","ort":"...","prioritaet":"Hoch/Mittel","triggersignale":[{"beschreibung":"Konkretes Signal","quelleUrl":"https://..."}],"warumJetzt":"Warum ist diese Firma in ${dates.today} investitionsbereit? 3-4 Saetze mit Branchenrueckenwind.","branchenrueckenwind":"...","ansprechpartner":[{"name":"Name falls bekannt sonst nicht oeffentlich","funktion":"GF/Inhaber","telefon":"nicht oeffentlich","email":"nicht oeffentlich"}]}]}`
        }]
      })
    });

    const formatData = await formatResp.json();
    if (formatData.error) {
      if (formatData.error.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
      return res.json({ error: formatData.error });
    }

    const jsonText = (formatData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('');

    return res.json({ _jsonText: jsonText, _dateRange: dates.range, _staedte: stadteListe });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => console.log(`MYWORKSPACE Lead-Finder running on port ${PORT}`));
