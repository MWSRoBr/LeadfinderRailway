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

app.post('/api/search', async (req, res) => {
  const { apiKey, location, radius } = req.body;
  if (!apiKey || !location) {
    return res.status(400).json({ error: { message: 'Fehlende Parameter.' } });
  }

  const dates = getDateRange();

  try {
    // SCHRITT 1: Branchenanalyse – Sonnet ohne Web-Suche
    const branchenResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Nenne 4 Branchen die in der Region ${location} wirtschaftlich stark sind. Nutze dein allgemeines Wissen ueber deutsche Wirtschaft und regionale Staerken. Format: BRANCHE: [Name] | STAERKE: stark/moderat | BEGRUENDUNG: [1-2 Saetze] ---`
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

    // SCHRITT 2: Lead-Suche – Sonnet MIT Web-Suche
    const searchResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `WICHTIG: Du hast ein Live-Web-Such-Tool. Dein Trainingsstichtag ist IRRELEVANT – du kannst JETZT aktuelle Webseiten durchsuchen. Nutze das Tool um echte, aktuelle Firmennamen zu finden. Gib niemals an, dass Daten nicht verfuegbar sind – suche stattdessen.`,
        messages: [{
          role: 'user',
          content: `Suche mit dem Web-Such-Tool nach echten Unternehmen in ${location}. Fuehre diese Suchen jetzt durch:

Suche 1: "${location} Unternehmen neues Buero Expansion"
Suche 2: "${location} Startup Finanzierung Wachstum"  
Suche 3: "${location} Firma Umzug neue Raeume"

Fuer jeden echten Firmennamen den du findest: Name, Ort, was der Artikel sagt, URL.
Mindestens 3 echte Firmennamen. Falls eine Suche keine Firmen bringt, probiere andere Begriffe.`
        }]
      })
    });

    const searchData = await searchResp.json();
    if (searchData.error) {
      if (searchData.error.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
      return res.json({ error: searchData.error });
    }

    // Extrahiere Text aus allen Block-Typen (text + tool_result)
    const rawText = (searchData.content || []).map(b => {
      if (b.type === 'text') return b.text || '';
      if (b.type === 'tool_result') {
        return (b.content || []).map(c => c.text || '').join('\n');
      }
      return '';
    }).join('\n').substring(0, 5000);

    if (!rawText || rawText.length < 50) {
      return res.json({ error: { message: 'Keine Suchergebnisse. Bitte erneut versuchen.' } });
    }

    await new Promise(r => setTimeout(r, 8000));

    // SCHRITT 3: JSON-Formatierung – Haiku
    const formatResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: `Gib NUR ein JSON-Objekt zurueck. Beginne mit {
STRIKTE REGEL: Nur echte Unternehmen mit echtem Namen als Leads. 
NIEMALS aufnehmen: "Datenunverfuegbarkeit", "Keine Daten", "N/A", "Unbekannt", Kammern, Portale.
Wenn keine echten Firmen vorhanden: "leads": []`,
        messages: [{
          role: 'user',
          content: `BRANCHEN:\n${branchenText}\n\nWEB-SUCHERGEBNISSE:\n${rawText.substring(0,3500)}\n\n{"branchen":[{"name":"...","staerke":"stark/moderat","begruendung":"..."}],"leads":[{"name":"ECHTER Firmenname","branche":"...","ort":"...","prioritaet":"Hoch/Mittel","triggersignale":[{"beschreibung":"Was der Artikel sagt","quelleUrl":"https://..."}],"warumJetzt":"Warum ist diese Firma in ${dates.today} relevant fuer MYWORKSPACE? 3 Saetze.","branchenrueckenwind":"...","ansprechpartner":[{"name":"nicht oeffentlich","funktion":"GF","telefon":"nicht oeffentlich","email":"nicht oeffentlich"}]}]}`
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

    return res.json({ _jsonText: jsonText, _dateRange: dates.range });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => console.log(`MYWORKSPACE Lead-Finder running on port ${PORT}`));
