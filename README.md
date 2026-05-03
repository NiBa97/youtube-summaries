# Youtube Summaries

Placeholder...

## Repo Struktur
- frontend/
- backend/
- database/
- docker-compose.yaml
- CLAUDE.md
- README.md 

## Technischer Stack
- Pocketbase: Lebt im database folder, ist aber jetzt erstmal nur ein Platzhalter für das pb_data directory (auch hier nur die Ordner nicht die Dateien)
- Vite und Chakra fürs Frontend: https://chakra-ui.com/docs/get-started/frameworks/vite
- Coolify für das deployment
- Backend FastAPI wrapped die Youtube Abfrage. Bekommt also eine Video URL und gibt als Ergebnis die Transktipte zurück- im Hintegrund läuft https://github.com/jdepoix/youtube-transcript-api

## Technische Grundlagen
- Datenbank erstmal komplett ohne Auth / gleiches gilt für den FastAPI Server - gehe einfach mal davon aus, dass es nur genau einen user gibt
- Poketbase Änderungen sollten alle über die Migrationen gemanaged werden
- Die FastAPI returned nur Statusmeldungen, speichert die Ergebnisse direkt in der Datenbank und das Frontend fetcht die Ergebnisse dann über die Datenbank erneut nachdem der Status eingegangen ist 
- Arbeitsstruktur erfolgt über Worktree's und Claude soll sich für jeden neuen Worktree die `pb_data` und `.env` in den Worktree kopieren. 
