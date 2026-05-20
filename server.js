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

async function callClaude(apiKey, body) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05'
    },
    body: JSON.stringify(body)
  });
  return resp.json();
}

app.post('/api/search', async (req, res) => {
  const { apiKey, location, radius } = req.body;
  if (!apiKey || !location) {
    return res.status(400).json({ error: { message: 'Fehlende Parameter.' } });
  }

  const dates = getDateRange();

  try {
    // STEP 1: Branchenanalyse OHNE Web-Suche (spart Tokens)
    const branchenData = await callClaude(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `${dates.today}. Welche 4 Branchen performen aktuell stark in der Region ${location} (Deutschland)? Beziehe dich auf DAX/MDAX/TecDAX Entwicklung, ifo-Index, KfW-Foerderung der letzten 12 Monate (${dates.range}). Format pro Branche: BRANCHE: [Name] | STAERKE: stark/moderat | BEGRUENDUNG: [2 Saetze mit regionalem Bezug]`
      }]
    });

    if (branchenData.error) {
      if (branchenData.error.type === 'overloaded_error') {
        return res.json({ error: { message: 'overloaded' } });
      }
      return res.json({ error: branchenData.error });
    }

    const branchenText = (branchenData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\n').substring(0, 1000);

    await new Promise(r => setTimeout(r, 20000));

    // STEP 2: Lead-Suche MIT Web-Suche
    const searchData = await callClaude(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `${dates.today}. Suche nach inhabergefuehrten Unternehmen (100-500 MA, mind. 30% Bueroanteil) im Umkreis ${radius}km um ${location} die im Zeitraum ${dates.range} gewachsen sind. Aktuelle Boom-Branchen: ${branchenText.substring(0,300)}. Nenne max. 6 Firmen mit Name, Ort, was gefunden, URL.`
      }]
    });

    if (searchData.error) {
      if (searchData.error.type === 'overloaded_error') {
        return res.json({ error: { message: 'overloaded' } });
      }
      return res.json({ error: searchData.error });
    }

    const rawText = (searchData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\n').substring(0, 3000);

    if (!rawText || rawText.length < 50) {
      return res.json({ error: { message: 'Keine Suchergebnisse. Bitte erneut versuchen.' } });
    }

    await new Promise(r => setTimeout(r, 20000));

    // STEP 3: JSON-Formatierung OHNE Web-Suche
    const formatData = await callClaude(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system: 'Gib NUR ein JSON-Objekt zurueck. Kein Text. Kein Markdown. Beginne mit {',
      messages: [{
        role: 'user',
        content: `Erstelle JSON aus diesen Daten:\n\nBRANCHEN:\n${branchenText}\n\nFIRMEN:\n${rawText}\n\n{"branchen":[{"name":"...","staerke":"stark oder moderat","begruendung":"..."}],"leads":[{"name":"...","branche":"...","ort":"...","prioritaet":"Hoch oder Mittel","triggersignale":[{"beschreibung":"...","quelleUrl":"https://..."}],"warumJetzt":"Warum ist diese Firma in ${dates.today} investitionsbereit? 3 Saetze.","branchenrueckenwind":"...","ansprechpartner":[{"name":"nicht oeffentlich","funktion":"GF","telefon":"nicht oeffentlich","email":"nicht oeffentlich"}]}]}`
      }]
    });

    if (formatData.error) {
      if (formatData.error.type === 'overloaded_error') {
        return res.json({ error: { message: 'overloaded' } });
      }
      return res.json({ error: formatData.error });
    }

    const jsonText = (formatData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('');

    return res.json({ _jsonText: jsonText, _dateRange: dates.range });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => {
  console.log(`MYWORKSPACE Lead-Finder running on port ${PORT}`);
});
