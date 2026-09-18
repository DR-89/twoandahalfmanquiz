# Two and a Half Men Quiz Club

Zweisprachiges Fan-Quiz nach dem Spielprinzip des South Park Quiz Club, mit Solo-Modus und gemeinsamen Quizräumen. Die Veröffentlichung auf GitHub und Sites wurde am 18. September 2026 ausdrücklich freigegeben.

Quellcode: [DR-89/twoandahalfmanquiz](https://github.com/DR-89/twoandahalfmanquiz).

Site-Adresse: [Two and a Half Men Quiz Club](https://twoandahalfmanquiz.droessler89.chatgpt.site).

## Spielen

Lokale Vorschau: http://localhost:5174/ – nur auf diesem Rechner erreichbar.

- Solo oder gemeinsame Räume für bis zu acht Spieler, Nicknames und Einladungslinks.
- Deutsch / English, gespeicherte Sprachwahl. Gemeinsame Spiele auch mit verschiedenen Sprachen.
- Alle 262 Folgen aus 12 Staffeln: **je 4 leichte, 4 mittlere und 5 schwere Fragen**, insgesamt 3.406 Episodenfragen plus 36 Charakterfragen = **3.442 Fragen**. Deutsche und englische Folgentitel. Das Finale wird als zwei Folgen gezählt.
- 84 ursprünglich formulierte Fragen bleiben erhalten. Die Erweiterung um 3.358 Fragen enthält automatisch erzeugte Lückentexte aus Quellen, Übersetzungen sowie Fragen zu Titelzitaten und Produktion. Fakten, Übersetzungen und Schwierigkeitsgrade sind **noch nicht vollständig redaktionell geprüft**; der Bearbeitungsstand wird in der Oberfläche angezeigt.
- Drei Schwierigkeiten. Namen immer als Charakterauswahl; manche schwere Detailfragen als Freitext. Quellen erscheinen nach der Auflösung.
- Folgen-, Staffel- und Schwierigkeitsfilter, 4/5/10/13/15/20 Fragen sowie 15/20/30/45/60 Sekunden pro Frage. Der verfügbare Umfang wird angezeigt; zu kleine Pools können nicht gestartet werden. Für eine ganze Folge: „Nur Folgen“, Folge auswählen, gemischte Schwierigkeit und 13 Fragen.
- 100/200/300 Punkte je richtiger Antwort plus bis zu 100 Zeitpunkte. Eine Antwort je Frage. Gemeinsame Auflösung nach Ablauf der Zeit.
- Gesamtpunkte bleiben zwischen Spielen erhalten. Neue Fragen werden bevorzugt, bis der Pool erschöpft ist.
- Sessions verfallen nach 24 Stunden ohne Spielaktion. Polling verlängert die Frist nicht. Abgelaufene Räume sind unzugänglich und werden bei API-Aufrufen entfernt. Kein Hintergrund-Scheduler für eine garantierte physische Löschung ohne weitere Zugriffe.

## Lokal starten

Node >=22.13, npm ci, dann npm run dev. Standardport: 5174.

Die Quizräume liegen in einer eigenen lokalen D1-Datenbank unter .wrangler/state. Migration vor dem ersten Spiel:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config wrangler.local.json --persist-to .wrangler/state --file drizzle/0000_mixed_patriot.sql
```

npm run build erstellt den Produktionsbuild. `node scripts/build-questions.mjs` erzeugt den Katalog offline aus `data/authored.json`, `data/expanded-questions.json` und `data/episode-source-data.json`. Vor dem Schreiben werden die exakte Verteilung 4/4/5, Übersetzungen, Antwortmöglichkeiten und IDs geprüft. Fragen und Lösungen werden serverseitig geladen. Laufende Spiele speichern vollständige Fragen-Snapshots und behalten deshalb ihren bisherigen Bestand bis zum nächsten Spiel.

## Prüfungen

```powershell
node scripts/test-game.mjs
node scripts/test-api.mjs
node scripts/test-session.mjs
node scripts/test-language.mjs
node scripts/test-catalog.mjs
node node_modules/typescript/bin/tsc --noEmit
```

API- und Sessiontests erwarten die lokale Vorschau auf Port 5174. Der Sessiontest verändert nur seinen eigenen frisch erstellten lokalen Testraum, um Spielende und Ablauf ohne 24-stündiges Warten zu prüfen.

## Quellen und Gestaltung

Faktenquellen sind überwiegend Wikipedia und das Two and a Half Men Wiki. Konkrete Quellen stehen an jeder Frage. Die automatisch erzeugten Lückentexte und Erläuterungen sind Bearbeitungen der Wiki-Handlungsbeschreibungen, teilweise gekürzt und übersetzt. Quellen-, Autoren- und Lizenzhinweise stehen unter `/quellen.html`. Wikipedia: CC BY-SA 4.0; Fandom: CC BY-SA 3.0; Bearbeitungen und Übersetzungen der Wiki-Texte: CC BY-SA 4.0. Quellenangaben ersetzen keine vollständige redaktionelle Prüfung.

Recherche- und Übersetzungsskripte unter `scripts/` verwenden einen ignorierten lokalen `.source-cache`. Sie sind für den normalen Start und den Offline-Neuaufbau nicht erforderlich. Die finale Zusammenstellung verwendet englische Quellen; maschinell ins Englische übersetzte italienische Handlungen wurden wegen Übersetzungsfehlern aus der automatischen Auswahl ausgeschlossen.

public/malibu-banner.png ist eine originale KI-Illustration, kein Serienfoto. Serienname und Figuren gehören ihren jeweiligen Rechteinhabern. Inoffizielles Fanprojekt.

Die `.openai/hosting.json` ordnet dieses Projekt seiner eigenen Sites-Instanz mit dem Datenbank-Binding `DB` zu. Lokale Quizräume, Zugangstokens, Recherche-Caches und Build-Ausgaben sind vom Git-Repository ausgeschlossen. Produktionsdaten werden nicht aus der lokalen Datenbank übernommen. Zugangsdaten für Veröffentlichungen gehören ausschließlich in die jeweilige Laufzeitumgebung, nicht in den Quellcode.
