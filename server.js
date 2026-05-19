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
    // STEP 1: Web search with Sonnet
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
        system: 'Du bist ein Recherche-Assistent. Finde reale Firmennamen mit Standort und Quelle. Keine Jobportale, keine Netzwerke als Ergebnisse.',
        messages: [{
          role: 'user',
          content: `Suche nach echten Unternehmen im Umkreis von ${radius} km um ${location} Deutschland die gerade wachsen oder expandieren. Fuehre diese Suchen durch:
1. "${location} Unternehmen neuer Standort expandiert 2024 2025"
2. "${location} Mittelstand Buero waechst neue Mitarbeiter 2025"
3. "${location} Firma zieht um neues Buero Gewerbe 2025"
Fuer jede echte Firma: Name, Ort, Branche, was gefunden, URL. Suche auch Impressum fuer GF/Inhaber. Nur echte Firmennamen, keine Portale.`
        }]
      })
    });

    const searchData = await searchResp.json();
    if (searchData.error) return res.json({ error: searchData.error });

    const rawText = (searchData.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .substring(0, 4000);

    if (!rawText || rawText.length < 80) {
      return res.json({ error: { message: 'Keine Suchergebnisse. Bitte erneut versuchen.' } });
    }

    // Brief pause between calls
    await new Promise(r => setTimeout(r, 1500));

    // STEP 2: Format as JSON with Haiku
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
        system: 'Gib NUR ein JSON-Array zurueck. Kein Text. Kein Markdown. Nur echte Unternehmen – NICHT: StepStone, Indeed, LinkedIn, IHK, Jobportale, Kammern.',
        messages: [{
          role: 'user',
          content: `Extrahiere echte Unternehmen aus diesem Text als JSON-Array:\n\n${rawText}\n\n[{"name":"Firmenname","branche":"Branche","ort":"Stadt","prioritaet":"Hoch oder Mittel","trigger":"Konkretes Signal","triggerQuelle":"URL","warumJetzt":"Warum jetzt fuer MYWORKSPACE relevant","ansprechpartner":[{"name":"Name GF/Inhaber oder nicht oeffentlich","funktion":"Inhaber oder GF","telefon":"nicht oeffentlich","email":"nicht oeffentlich"}],"erstansprache":"Konkreter Einstiegssatz fuer MYWORKSPACE Kaltanruf"}]`
        }]
      })
    });

    const formatData = await formatResp.json();
    if (formatData.error) return res.json({ error: formatData.error });

    const jsonText = (formatData.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    return res.json({ _jsonText: jsonText });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => {
  console.log(`MYWORKSPACE Lead-Finder running on port ${PORT}`);
});
