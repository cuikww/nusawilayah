// Server-side client: reads the copied data from disk, for both routers.
import { createWilayah } from '@nusawilayah/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const server = createWilayah({
  fetcher: async (path) => JSON.parse(await readFile(join(/* turbopackIgnore: true */ process.cwd(), 'public/wilayah', path), 'utf8')),
});
