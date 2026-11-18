import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Uploaded files go to a fresh temporary folder, never local-files/.
    env: { FILES_DIR: mkdtempSync(join(tmpdir(), 'motis-test-files-')) },
  },
})
