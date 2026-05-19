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
    // Step 1: Haiku sucht im Web (Freitext)
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
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Suche nach Unternehmen die 2024-2026 in ${location} expandiert haben oder gewachsen sind. Nenne konkrete Firmennamen, Ort, was du gefunden hast und die URL. Maximal 6 Firmen.`
        }]
      })
    });

    const searchData = await searchResp.json();
    if (searchData.error) return res.json({ error: searchData.error });

    const blockTypes = (searchData.content || []).map(b => b.type);
    const rawText = (searchData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\n');

    if (!rawText || rawText.length < 50) {
      return res.json({
        error: { message: 'Keine Suchergebnisse.' },
        _debug: { blockTypes, rawTextLength: rawText.length, preview: rawText.substring(0, 200) }
      });
    }

    await new Promise(r => setTimeout(r, 5000));

    // Step 2: Haiku formatiert als JSON
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
        system: 'Antworte NUR mit einem JSON-Array. Kein Text. Kein Markdown. Beginne sofort mit [',
        messages: [{
          role: 'user',
          content: `Wandle diese Firmenliste in JSON um:\n\n${rawText.substring(0, 2000)}\n\n[{"name":"...","branche":"...","ort":"...","prioritaet":"Hoch","triggersignale":[{"beschreibung":"...","quelleUrl":"https://..."}],"warumJetzt":"Warum ist diese Firma im Mai 2026 ein guter Lead fuer Bueroausstattung? 3 Saetze.","branchenrueckenwind":"...","ansprechpartner":[{"name":"nicht oeffentlich","funktion":"GF","telefon":"nicht oeffentlich","email":"nicht oeffentlich"}]}]`
        }]
      })
    });

    const formatData = await formatResp.json();
    if (formatData.error) return res.json({ error: formatData.error });

    const jsonText = (formatData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('');

    return res.json({
      _jsonText: jsonText,
      _debug: {
        step1Blocks: blockTypes,
        step1Length: rawText.length,
        step1Preview: rawText.substring(0, 400),
        step2Length: jsonText.length,
        step2Preview: jsonText.substring(0, 200)
      }
    });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => {
  console.log(`MYWORKSPACE Lead-Finder running on port ${PORT}`);
});
