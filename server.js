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
    // STEP 1: Branchenanalyse ohne Web-Suche
    const branchenResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: `${dates.today}. Welche 4 Branchen performen aktuell stark in der Region ${location}? Format: BRANCHE: [Name] | STAERKE: stark/moderat | BEGRUENDUNG: [2 Saetze]` }]
      })
    });
    const branchenData = await branchenResp.json();
    if (branchenData.error) {
      if (branchenData.error.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
      return res.json({ error: branchenData.error });
    }
    const branchenText = (branchenData.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').substring(0, 800);

    await new Promise(r => setTimeout(r, 40000));

    // STEP 2: Lead-Suche mit Web-Suche
    const searchResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: `${dates.today}. Suche nach inhabergefuehrten Unternehmen (100-500 MA, mind. 30% Bueroanteil) im Umkreis ${radius}km um ${location} die im Zeitraum ${dates.range} gewachsen sind. Nenne max. 6 Firmen mit Name, Ort, was gefunden, URL.` }]
      })
    });
    const searchData = await searchResp.json();
    if (searchData.error) {
      if (searchData.error.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
      return res.json({ error: searchData.error });
    }
    const searchBlocks = (searchData.content || []).map(b => b.type);
    const rawText = (searchData.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').substring(0, 3000);

    await new Promise(r => setTimeout(r, 40000));

    // STEP 3: JSON-Formatierung
    const formatResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        system: 'Gib NUR ein JSON-Objekt zurueck. Kein Text. Kein Markdown. Beginne mit {',
        messages: [{ role: 'user', content: `JSON aus diesen Daten:\n\nBRANCHEN:\n${branchenText}\n\nFIRMEN:\n${rawText}\n\n{"branchen":[{"name":"...","staerke":"stark oder moderat","begruendung":"..."}],"leads":[{"name":"...","branche":"...","ort":"...","prioritaet":"Hoch oder Mittel","triggersignale":[{"beschreibung":"...","quelleUrl":"https://..."}],"warumJetzt":"Warum ist diese Firma in ${dates.today} investitionsbereit? 3 Saetze.","branchenrueckenwind":"...","ansprechpartner":[{"name":"nicht oeffentlich","funktion":"GF","telefon":"nicht oeffentlich","email":"nicht oeffentlich"}]}]}` }]
      })
    });
    const formatData = await formatResp.json();
    if (formatData.error) {
      if (formatData.error.type === 'overloaded_error') return res.json({ error: { message: 'overloaded' } });
      return res.json({ error: formatData.error });
    }
    const jsonText = (formatData.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

    return res.json({
      _jsonText: jsonText,
      _dateRange: dates.range,
      _debug: {
        step1Length: branchenText.length,
        step1Preview: branchenText.substring(0, 200),
        step2Blocks: searchBlocks,
        step2Length: rawText.length,
        step2Preview: rawText.substring(0, 300),
        step3Length: jsonText.length,
        step3Preview: jsonText.substring(0, 200)
      }
    });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => console.log(`Lead-Finder running on port ${PORT}`));
