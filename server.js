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
    // STEP 1: Branchenanalyse
    const branchenResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: 'Du bist ein Finanzmarkt-Analyst. Antworte praezise und faktenbasiert.',
        messages: [{
          role: 'user',
          content: `Heute ist Mai 2026. Welche Branchen und Sektoren haben in den letzten 12-18 Monaten an der Frankfurter Boerse (DAX, MDAX, SDAX, TecDAX, Scale, Basic Board, Xetra) stark performed? Beruecksichtige auch: ifo-Geschaeftsklimaindex, ZEW-Index, Auftragseingangsstatistiken Destatis, KfW/BAFA Foerdermittelvergabe. Nenne die Top 5 Branchen mit je einem Satz Begruendung und einer Quellen-URL.`
        }]
      })
    });

    const branchenData = await branchenResp.json();
    if (branchenData.error) return res.json({ error: branchenData.error });

    const branchenText = (branchenData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\n').substring(0, 1500);

    await new Promise(r => setTimeout(r, 1500));

    // STEP 2: Leads suchen
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
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: 'Du bist ein Vertriebsrecherche-Assistent. Finde reale Firmennamen mit konkreten Belegen. Keine Jobportale oder Netzwerke als Ergebnisse.',
        messages: [{
          role: 'user',
          content: `Heute ist Mai 2026. Diese Branchen haben aktuell wirtschaftlichen Rueckenwind:\n${branchenText}\n\nSuche nach echten inhabergefuehrten Mittelstaendlern (100-500 Mitarbeiter) im Umkreis von ${radius} km um ${location} Deutschland, die:\na) In einer der oben genannten Boom-Branchen taetig sind ODER als Zulieferer davon profitieren\nb) Konkrete Veraenderungssignale zeigen: Wachstum, neuer Standort, Expansion, Reorganisation, neue Stellen\n\nSuche auf: lokalen Wirtschaftsportalen, Unternehmenswebseiten, Pressemitteilungen, Handelsregister-Bekanntmachungen, regionalen Zeitungen.\n\nFuer jede Firma: sammle MEHRERE Belege mit URLs. Suche auch Impressum fuer GF/Inhaber-Namen.\n\nBranchen: Kanzleien, Agenturen, Beratungen, Finanzdienstleister, IT-Unternehmen, Ingenieurbüros, Pflegefachschulen, Bildungstraeger, Sozialdienste.\n\nListe alle gefundenen Firmen mit saemtlichen Details und URLs.`
        }]
      })
    });

    const searchData = await searchResp.json();
    if (searchData.error) return res.json({ error: searchData.error });

    const rawText = (searchData.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\n').substring(0, 5000);

    if (!rawText || rawText.length < 80) {
      return res.json({ error: { message: 'Keine Suchergebnisse. Bitte erneut versuchen.' } });
    }

    await new Promise(r => setTimeout(r, 1500));

    // STEP 3: JSON formatieren
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
        system: 'Gib NUR ein JSON-Array zurueck. Kein Text. Kein Markdown. Nur echte Firmen – NICHT: Jobportale, LinkedIn, IHK, Kammern, Zeitschriften.',
        messages: [{
          role: 'user',
          content: `Extrahiere echte Unternehmen aus diesem Text als JSON-Array. Heute ist Mai 2026.\n\nText:\n${rawText}\n\nWichtig fuer "triggersignale": Liste ALLE gefundenen Signale als Array mit je "beschreibung" und "quelleUrl".\nWichtig fuer "warumJetzt": Erklaere ausfuehrlich warum diese Firma HEUTE IM MAI 2026 relevant ist - beziehe dich auf den Branchenrueckenwind und die konkreten Signale. Mindestens 3 Saetze.\n\n[{"name":"Firmenname","branche":"Branche","ort":"Stadt","prioritaet":"Hoch oder Mittel","triggersignale":[{"beschreibung":"Konkretes Signal 1","quelleUrl":"https://..."},{"beschreibung":"Konkretes Signal 2","quelleUrl":"https://..."}],"warumJetzt":"Ausfuehrliche Begruendung warum genau jetzt Mai 2026 der richtige Zeitpunkt ist - Branchenrueckenwind, wirtschaftliche Lage, konkreter Investitionsbedarf","branchenrueckenwind":"Verbindung zum boomenden Sektor","ansprechpartner":[{"name":"Name GF/Inhaber oder nicht oeffentlich","funktion":"Inhaber oder GF","telefon":"nicht oeffentlich","email":"nicht oeffentlich"}]}]`
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
