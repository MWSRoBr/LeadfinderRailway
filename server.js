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
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Du bist ein Vertriebsrecherche-Assistent fuer MYWORKSPACE by Lyreco (360-Grad-Bueroloesungen Deutschland).
Deine Antwort besteht AUSSCHLIESSLICH aus einem JSON-Array. Kein Text davor oder danach. Kein Markdown. Nur das Array.
Wenn du keine Firmen findest, gib ein leeres Array zurueck: []
Niemals Jobportale (StepStone, Indeed), Netzwerke (LinkedIn) oder Kammern (IHK) als Leads aufnehmen.`,
        messages: [{
          role: 'user',
          content: `Heute ist Mai 2026. Suche nach echten inhabergefuehrten Mittelstaendlern im Umkreis ${radius}km um ${location} Deutschland.

Suche nach:
- Unternehmen die 2024-2026 expandiert haben oder wachsen
- Firmen in Branchen mit aktuellem Boersenrueckenwind (Technologie, Verteidigung, Energie, Gesundheit)
- Kanzleien, Agenturen, Beratungen, IT-Firmen, Ingenieurbüros, Pflegefachschulen, Bildungstraeger

Fuer jede Firma: suche mehrere Belege (Presseartikel, Unternehmenswebseite, Handelsregister) und den Namen des GF/Inhabers.

Erklaere bei "warumJetzt" ausfuehrlich warum diese Firma im Mai 2026 investitionsbereit ist: Branchenrueckenwind, wirtschaftliche Lage der Firma, konkrete Signale.

Antworte NUR mit diesem JSON-Array:
[{"name":"Firmenname","branche":"Branche","ort":"Stadt","prioritaet":"Hoch oder Mittel","triggersignale":[{"beschreibung":"Konkretes Signal mit Details","quelleUrl":"https://quelleurl.de"},{"beschreibung":"Weiteres Signal","quelleUrl":"https://quelleurl2.de"}],"warumJetzt":"Ausfuehrliche Begruendung warum Mai 2026 der richtige Zeitpunkt ist. Branchenrueckenwind benennen. Wirtschaftliche Lage erklaeren. Mindestens 3 Saetze.","branchenrueckenwind":"Welcher Sektor boomt und wie profitiert diese Firma","ansprechpartner":[{"name":"Name GF/Inhaber","funktion":"Inhaber oder GF","telefon":"nicht oeffentlich","email":"nicht oeffentlich"}]}]`
        }]
      })
    });

    const data = await resp.json();
    if (data.error) return res.json({ error: data.error });

    const rawText = (data.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('');

    return res.json({ _jsonText: rawText });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => {
  console.log(`MYWORKSPACE Lead-Finder running on port ${PORT}`);
});
