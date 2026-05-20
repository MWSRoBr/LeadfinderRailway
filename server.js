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

function handleError(err, res) {
  if (err && err.type === 'overloaded_error') {
    return res.json({ error: { message: 'overloaded' } });
  }
  return res.json({ error: err });
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
        max_tokens: 1200,
        system: `Du bist ein Wirtschaftsanalyst mit tiefem Wissen ueber deutsche Maerkte, Boersenentwicklungen und regionale Wirtschaftsstrukturen. Heute ist ${dates.today}.`,
        messages: [{
          role: 'user',
          content: `Analysiere welche Branchen im Zeitraum ${dates.range} in der Region ${location} wirtschaftlich besonders stark performed haben.

Beziehe dich auf: DAX/MDAX/SDAX/TecDAX/Scale/Basic Board Entwicklungen, ifo-Geschaeftsklimaindex, ZEW-Index, KfW- und BAFA-Foerderungen, Auftragseingangsstatistiken Destatis.

Nenne 5 Branchen mit je:
- Name der Branche
- Staerke: "stark" oder "moderat"  
- Konkrete Begruendung mit regionalem Bezug (Boersenwerte, Foerdergelder, lokale Cluster, Auftragslage) – 3 praezise Saetze

Format:
BRANCHE: [Name]
STAERKE: [stark/moderat]
BEGRUENDUNG: [3 Saetze]
---`
        }]
      })
    });

    const branchenData = await branchenResp.json();
    if (branchenData.error) return handleError(branchenData.error, res);

    const branchenText = (branchenData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\n').substring(0, 1500);

    await new Promise(r => setTimeout(r, 8000));

    // SCHRITT 2: Lead-Suche – Sonnet mit Web-Suche
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
        system: `Du bist ein praeziser Vertriebsrecherche-Assistent fuer MYWORKSPACE by Lyreco (360-Grad-Bueroloesungen Deutschland). Heute ist ${dates.today}. Suche nur nach Ereignissen aus ${dates.range}. Nenne ausschliesslich echte, verifiable Firmennamen.`,
        messages: [{
          role: 'user',
          content: `Suche nach max. 8 inhabergefuehrten Unternehmen (100-500 Mitarbeiter, mind. 30-40% Bueroanteil) im Umkreis von ${radius}km um ${location}, die im Zeitraum ${dates.range} gewachsen sind oder expandiert haben.

Aktuelle Boom-Branchen in der Region:
${branchenText.substring(0, 600)}

Suche gezielt nach:
- Pressemitteilungen zu Expansion, neuem Standort, Wachstum
- Handelsregister-Bekanntmachungen (Kapitalerhoehungen, neue Eintraege)
- Wirtschaftsnachrichten der Region
- Stellenausschreibungen die auf strukturelles Wachstum hinweisen

Fuer jede Firma: Name, Ort, Branche, konkretes Signal mit Datum, URL der Quelle, GF/Inhaber-Name falls im Impressum oder LinkedIn auffindbar.`
        }]
      })
    });

    const searchData = await searchResp.json();
    if (searchData.error) return handleError(searchData.error, res);

    const rawText = (searchData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\n').substring(0, 5000);

    if (!rawText || rawText.length < 80) {
      return res.json({ error: { message: 'Keine Suchergebnisse. Bitte erneut versuchen.' } });
    }

    await new Promise(r => setTimeout(r, 8000));

    // SCHRITT 3: JSON-Formatierung – Haiku ohne Web-Suche
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
        system: 'Gib NUR ein JSON-Objekt zurueck. Kein Text. Kein Markdown. Beginne sofort mit {',
        messages: [{
          role: 'user',
          content: `Erstelle ein JSON-Objekt mit "branchen" und "leads" aus diesen Daten. Heute: ${dates.today}.

BRANCHENDATEN:
${branchenText}

FIRMENDATEN:
${rawText.substring(0, 3500)}

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
        {
          "beschreibung": "Konkretes Signal mit Datum falls bekannt",
          "quelleUrl": "https://quelleurl.de"
        }
      ],
      "warumJetzt": "Ausfuehrliche Begruendung warum diese Firma in ${dates.today} investitionsbereit ist. Branchenrueckenwind benennen. Wirtschaftliche Lage der Firma erklaeren. Warum jetzt der richtige Moment fuer MYWORKSPACE ist. Mindestens 4 Saetze.",
      "branchenrueckenwind": "Welcher Boom-Sektor und wie profitiert diese Firma konkret davon",
      "ansprechpartner": [
        {
          "name": "Name GF/Inhaber oder nicht oeffentlich",
          "funktion": "Inhaber, GF, Geschaeftsfuehrer etc.",
          "telefon": "nicht oeffentlich",
          "email": "nicht oeffentlich"
        }
      ]
    }
  ]
}`
        }]
      })
    });

    const formatData = await formatResp.json();
    if (formatData.error) return handleError(formatData.error, res);

    const jsonText = (formatData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('');

    return res.json({ _jsonText: jsonText, _dateRange: dates.range });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(PORT, () => console.log(`MYWORKSPACE Lead-Finder running on port ${PORT}`));
