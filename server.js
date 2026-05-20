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
    // STEP 1: Branchenanalyse mit Haiku + Web-Suche
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
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Heute ist ${dates.today}. Analysiere welche Branchen im Zeitraum ${dates.range} in der Region ${location} wirtschaftlich stark performed haben.

Beruecksichtige: DAX/MDAX/SDAX/TecDAX/Scale Boersenentwicklung, ifo-Geschaeftsklimaindex, ZEW-Index, KfW/BAFA Foerdermittelvergabe, Auftragseingangsstatistiken Destatis.

Nenne 4-6 Branchen die in dieser Region und diesem Zeitraum besonders stark waren. Fuer jede Branche:
- Name der Branche
- Staerke: "stark" oder "moderat"
- Konkrete Begruendung mit regionalem Bezug (Boersenwerte, Foerdergelder, regionale Cluster, Auftragslage)

Antworte im Format:
BRANCHE: [Name]
STAERKE: [stark/moderat]
BEGRUENDUNG: [2-3 Saetze mit konkreten Fakten und regionalem Bezug]
---`
        }]
      })
    });

    const branchenData = await branchenResp.json();
    if (branchenData.error) return res.json({ error: branchenData.error });

    const branchenText = (branchenData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\n').substring(0, 2000);

    await new Promise(r => setTimeout(r, 5000));

    // STEP 2: Lead-Suche mit Sonnet + Web-Suche
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
        max_tokens: 3000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Du bist ein Vertriebsrecherche-Assistent fuer MYWORKSPACE by Lyreco. Heute ist ${dates.today}. Finde nur Ereignisse aus dem Zeitraum ${dates.range}. Aeltere Ereignisse ignorieren.`,
        messages: [{
          role: 'user',
          content: `Suche nach inhabergefuehrten Unternehmen im Umkreis ${radius}km um ${location} die im Zeitraum ${dates.range} gewachsen sind oder expandiert haben.

Zielgruppe: Unternehmen bei denen mindestens 30-40% der Mitarbeiter an Bueroplätzen arbeiten – egal ob klassische Buerobranche oder unerwarteter Sektor. Nicht geeignet: reine Produktions- oder Lagerbetriebe ohne nennenswerte Verwaltung.

Diese Branchen performen aktuell gut in der Region:
${branchenText}

Suche auf: lokalen Wirtschaftsportalen, Unternehmenswebseiten, Pressemitteilungen, Handelsregister-Bekanntmachungen, regionalen Zeitungen.

NUR Ereignisse aus ${dates.range} beruecksichtigen.

Fuer jede Firma: Name, Ort, was gefunden, URL der Quelle, Name GF/Inhaber wenn auffindbar.`
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

    await new Promise(r => setTimeout(r, 5000));

    // STEP 3: JSON-Formatierung mit Haiku
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
        system: 'Gib NUR ein JSON-Objekt zurueck. Kein Text. Kein Markdown. Beginne sofort mit {',
        messages: [{
          role: 'user',
          content: `Erstelle ein JSON-Objekt mit zwei Feldern: "branchen" und "leads".

Branchentext:
${branchenText}

Firmentext:
${rawText}

Format:
{
  "branchen": [
    {
      "name": "Branchenname",
      "staerke": "stark oder moderat",
      "begruendung": "Konkrete Begruendung mit regionalem Bezug"
    }
  ],
  "leads": [
    {
      "name": "Firmenname",
      "branche": "Branche",
      "ort": "Stadt",
      "prioritaet": "Hoch oder Mittel",
      "triggersignale": [
        {"beschreibung": "Konkretes Signal", "quelleUrl": "https://..."},
        {"beschreibung": "Weiteres Signal", "quelleUrl": "https://..."}
      ],
      "warumJetzt": "Ausfuehrlich: Warum ist diese Firma in ${dates.today} ein guter Lead? Branchenrueckenwind benennen. Investitionsbereitschaft begruenden. Mindestens 3 Saetze.",
      "branchenrueckenwind": "Welcher Sektor boomt und wie profitiert diese Firma",
      "ansprechpartner": [
        {"name": "Name oder nicht oeffentlich", "funktion": "GF oder Inhaber", "telefon": "nicht oeffentlich", "email": "nicht oeffentlich"}
      ]
    }
  ]
}`
        }]
      })
    });

    const formatData = await formatResp.json();
    if (formatData.error) return res.json({ error: formatData.error });

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
