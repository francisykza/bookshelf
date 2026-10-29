// Worker del lector de Goodreads (SPEC §52.3): decodifica y analiza el CSV fuera del hilo principal. Solo se crea al
// elegir un archivo en el panel de importación; PapaParse viaja en este fragmento, nunca en el arranque de la app.
import Papa from 'papaparse';
import { decodeUtf8, parseGoodreadsCsv } from './goodreadsParser';

self.onmessage = (event) => {
  try {
    const result = parseGoodreadsCsv(Papa, decodeUtf8(event.data));
    self.postMessage({ ok: true, ...result });
  } catch (error) {
    self.postMessage({ ok: false, code: error.code ?? 'unknown', message: error.code ? error.message : 'No hemos podido leer el archivo.' });
  }
};
