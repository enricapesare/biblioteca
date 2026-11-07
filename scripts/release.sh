#!/usr/bin/env bash
# Uso: scripts/release.sh 1.1.0
# Aggiorna la versione in app.js e sw.js, committa e crea il tag. Va lanciato dal ramo main, con CHANGELOG.md già aggiornato.
set -euo pipefail
V="${1:?Indica la versione, es. 1.1.0}"
[[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Versione non valida (usa X.Y.Z)"; exit 1; }
[[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]] || { echo "Passa al ramo main"; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "Ci sono modifiche non committate"; exit 1; }
grep -q "## \[$V\]" CHANGELOG.md || { echo "Aggiungi la sezione [$V] in CHANGELOG.md"; exit 1; }
sed -i.bak "s/^const APP_VERSION = '[^']*'/const APP_VERSION = '$V'/" app.js
sed -i.bak "s/^const VERSION = 'biblioteca-[^']*'/const VERSION = 'biblioteca-$V'/" sw.js
rm -f app.js.bak sw.js.bak
git add app.js sw.js
git commit -m "Release $V"
git tag -a "v$V" -m "Versione $V"
echo "Fatto. Pubblica con: git push origin main --tags"
