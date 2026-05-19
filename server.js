const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/search', async (req, res) => {
  const { apiKey, location, radius } = req.body;
  if (!apiKey || !location) {
    return res.status(400).json({ error: { message: 'Fehlende Parameter.' } });
  }

  try {
    // STEP 1: Branchenanalyse mit Haiku (guenstig, schnell)
    const branchenResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: 'Mai 2026: Welche 4 Branchen performen aktuell stark an deutschen Boersen (DAX, MDAX, SDAX, TecDAX) und laut ifo/ZEW? Je eine Zeile mit Branche und Grund. Kurz und praezise.'
        }]
      })
    });

    const branchenData = await branchenResp.json();
    if (branchenData.error) return res.json({ error: branchenData.error });

    const branchenText = (branchenData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\n').substring(0, 600);

    // Pause um Rate-Limit zu respektieren
    await new Promise(r => setTimeout(r, 8000));

    // STEP 2: Leads suchen mit Sonnet
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
        system: 'Du bist ein Vertriebsrecherche-Assistent. Finde reale Firmennamen mit konkreten Belegen und URLs. Keine Jobportale als Ergebnisse.',
        messages: [{
          role: 'user',
          content: `Mai 2026. Boom-Branchen aktuell:\n${branchenText}\n\nSuche inhabergefuehrte Mittelstaendler (100-500 MA) im Umkreis ${radius}km um ${location}. Kriterien: Boom-Branche ODER Zulieferer davon, plus konkretes Wachstumssignal. Branchen: Kanzleien, Agenturen, Beratungen, IT, Ingenieurbüros, Pflegefachschulen, Bildungstraeger. Fuer jede Firma: Name, Ort, was gefunden, URL, GF/Inhaber-Name wenn auffindbar.`
        }]
      })
    });

    const searchData = await searchResp.json();
    if (searchData.error) return res.json({ error: searchData.error });

    const rawText = (searchData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\n').substring(0, 4000);

    if (!rawText || rawText.length < 80) {
      return res.json({ error: { message: 'Keine Suchergebnisse. Bitte erneut versuchen.' } });
    }

    await new Promise(r => setTimeout(r, 8000));

    // STEP 3: JSON mit Haiku
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
        system: 'Gib NUR ein JSON-Array zurueck. Kein Text. Kein Markdown. Nur echte Firmen.',
        messages: [{
          role: 'user',
          content: `Text:\n${rawText}\n\nBoom-Branchen:\n${branchenText}\n\nJSON-Array (nur echte Firmen, keine Portale):\n[{"name":"...","branche":"...","ort":"...","prioritaet":"Hoch oder Mittel","triggersignale":[{"beschreibung":"Signal 1","quelleUrl":"https://..."},{"beschreibung":"Signal 2","quelleUrl":"https://..."}],"warumJetzt":"Ausfuehrlich: Warum ist diese Firma im Mai 2026 ein guter Lead? Branchenrueckenwind + konkrete Signale + wirtschaftliche Lage. Mindestens 3 Saetze.","branchenrueckenwind":"Welcher Boom-Sektor und warum profitiert diese Firma","ansprechpartner":[{"name":"...","funktion":"...","telefon":"nicht oeffentlich","email":"nicht oeffentlich"}]}]`
        }]
      })
    });

    const formatData = await formatResp.json();
    if (formatData.error) return res.json({ error: formatData.error });

    const jsonText = (formatData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('');

    return res.json({ _jsonText: jsonText });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => {
  console.log(`MYWORKSPACE Lead-Finder running on port ${PORT}`);
});
