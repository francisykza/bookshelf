# 1.59 (SPEC §59): análisis de qa-report/qa-telemetry.json. Recorre TODOS los estados auditados (los que guardan las
# pruebas con `auditState`: e2e/v159 y e2e-community/v159) y resume por apartado: overflowElements, backgroundCheck,
# overlappingInteractive, brokenOrUncroppedAssets y consoleErrors; además, los errores de página y de consola de todas
# las pruebas. Uso: python -I -X utf8 scripts/analyze-telemetry.py [ruta] > informe.md
import json
import sys
from collections import Counter, defaultdict

path = sys.argv[1] if len(sys.argv) > 1 else 'qa-report/qa-telemetry.json'
data = json.load(open(path, encoding='utf8'))
runs = data.get('runs', [])

KEYS = ['overflowElements', 'backgroundCheck', 'overlappingInteractive', 'brokenOrUncroppedAssets', 'consoleErrors']
states = [(r.get('project', '?'), s) for r in runs for s in r.get('states', []) or []]

print(f'# Análisis de {path}')
print()
print(f'- Generado: {data.get("generatedAt")}')
print(f'- Ejecuciones: {len(runs)} · estados auditados: {len(states)}')
print(f'- Nota del informe: {data.get("note", "")}')
print()

# Resumen por apartado
print('## Estados auditados')
print()
print('| Apartado | Estados con hallazgos | Hallazgos (total) |')
print('| --- | ---: | ---: |')
findings = defaultdict(list)
for project, s in states:
    for k in KEYS:
        v = s.get(k)
        if k == 'backgroundCheck':
            bad = [] if (v or {}).get('ok', False) else [f'sin pintar en {(v or {}).get("unpainted")}']
        else:
            bad = v or []
        if bad:
            findings[k].append((project, s.get('state'), bad))
for k in KEYS:
    print(f'| `{k}` | {len(findings[k])} de {len(states)} | {sum(len(b) for _, _, b in findings[k])} |')
print()

for k in KEYS:
    if not findings[k]:
        continue
    print(f'### `{k}`')
    print()
    grouped = Counter()
    where = defaultdict(set)
    for project, state, bad in findings[k]:
        for item in bad:
            grouped[item] += 1
            where[item].add(f'{project} · {state}')
    for item, n in grouped.most_common(15):
        print(f'- {item} — {n} vez/veces ({", ".join(sorted(where[item])[:4])}{"…" if len(where[item]) > 4 else ""})')
    print()

# Estados por proyecto
print('## Estados por proyecto')
print()
per = defaultdict(list)
for project, s in states:
    per[project].append(s.get('state'))
for project in sorted(per):
    print(f'- {project}: {", ".join(per[project])}')
print()

# Errores de toda la QA (no solo de los estados auditados)
page_errors = [(r.get('project'), e) for r in runs for e in (r.get('pageErrors') or [])]
console = []
for r in runs:
    for e in r.get('consoleErrors') or []:
        console.append((r.get('project'), e if isinstance(e, str) else e.get('text', str(e))))
    for e in r.get('console') or []:
        if isinstance(e, dict) and e.get('type') == 'error':
            console.append((r.get('project'), e.get('text', '')))
print('## Errores de página y de consola de toda la QA')
print()
print(f'- Errores de página: {len(page_errors)}')
for project, e in page_errors[:20]:
    print(f'  - {project}: {e.get("text", e) if isinstance(e, dict) else e}')
print(f'- Errores de consola: {len(console)}')
kinds = Counter()
for _, text in console:
    t = str(text)
    if 'openlibrary' in t.lower() or 'covers.' in t.lower():
        kinds['portadas externas (Open Library) sin red'] += 1
    elif 'Failed to load resource' in t:
        kinds['recurso que no carga (red de la prueba)'] += 1
    else:
        kinds[t[:140]] += 1
for k, n in kinds.most_common(20):
    print(f'  - {k}: {n}')
