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
    // SCHRITT 1: Branchenanalyse + Lead-Suche in EINEM Web-Such-Aufruf
    const searchResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Heute ist ${dates.today}. Ich brauche zwei Dinge fuer die Region ${location} (Umkreis ${radius}km), Zeitraum ${dates.range}:

TEIL A - BRANCHEN: Welche 4 Branchen performen aktuell stark in dieser Region? Je Branche: Name, Staerke (stark/moderat), 2 Saetze Begruendung mit regionalem Bezug.

TEIL B - FIRMEN: Suche nach max. 6 inhabergefuehrten Unternehmen (100-500 MA, mind. 30% Bueroanteil) die in diesem Zeitraum gewachsen sind oder expandiert haben. Je Firma: Name, Ort, Branche, was gefunden, URL, GF/Inhaber falls bekannt.

Trenne die beiden Teile klar mit "=== BRANCHEN ===" und "=== FIRMEN ===".`
        }]
      })
    });

    const searchData = await searchResp.json();

    if (searchData.error) {
      if (searchData.error.type === 'overloaded_error') {
        return res.json({ error: { message: 'overloaded' } });
      }
      return res.json({ error: searchData.error });
    }

    const rawText = (searchData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\n');

    if (!rawText || rawText.length < 50) {
      return res.json({ error: { message: 'Keine Suchergebnisse. Bitte erneut versuchen.' } });
    }

    await new Promise(r => setTimeout(r, 30000));

    // SCHRITT 2: JSON-Formatierung OHNE Web-Suche
    const formatResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        system: 'Gib NUR ein JSON-Objekt zurueck. Kein Text davor oder danach. Kein Markdown. Beginne sofort mit {',
        messages: [{
          role: 'user',
          content: `Wandle diesen Text in JSON um:\n\n${rawText.substring(0, 3000)}\n\nFormat:\n{"branchen":[{"name":"...","staerke":"stark oder moderat","begruendung":"..."}],"leads":[{"name":"...","branche":"...","ort":"...","prioritaet":"Hoch oder Mittel","triggersignale":[{"beschreibung":"...","quelleUrl":"https://..."}],"warumJetzt":"Warum ist diese Firma in ${dates.today} investitionsbereit? 3 Saetze.","branchenrueckenwind":"...","ansprechpartner":[{"name":"nicht oeffentlich","funktion":"GF","telefon":"nicht oeffentlich","email":"nicht oeffentlich"}]}]}`
        }]
      })
    });

    const formatData = await formatResp.json();

    if (formatData.error) {
      if (formatData.error.type === 'overloaded_error') {
        return res.json({ error: { message: 'overloaded' } });
      }
      return res.json({ error: formatData.error });
    }

    const jsonText = (formatData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('');

    return res.json({
      _jsonText: jsonText,
      _dateRange: dates.range,
      _debug: {
        step1Length: rawText.length,
        step1Preview: rawText.substring(0, 400),
        step2Length: jsonText.length,
        step2Preview: jsonText.substring(0, 300)
      }
    });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => console.log(`Lead-Finder running on port ${PORT}`));
