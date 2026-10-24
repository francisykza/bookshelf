// Une la telemetría de cada proyecto en `qa-report/qa-telemetry.json` (SPEC §16.10).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default function teardown() {
  const dir = join('qa-report', 'telemetry');
  mkdirSync(dir, { recursive: true });
  const runs = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
  const summary = {
    generatedAt: new Date().toISOString(),
    note: 'WebKit automatizado no equivale a Safari en un iPhone real. La geometría comprueba consistencia, no que las coordenadas coincidan con lo pintado.',
    runs,
  };
  writeFileSync(join('qa-report', 'qa-telemetry.json'), JSON.stringify(summary, null, 2));
}
