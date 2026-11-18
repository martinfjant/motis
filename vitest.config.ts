import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Tests that create users or log in hash passwords at full cost (about
    // 0.1 s each here, several times that on CI machines).
    testTimeout: 30_000,
    // Uploaded files go to a fresh temporary folder, never local-files/.
    env: { FILES_DIR: mkdtempSync(join(tmpdir(), 'motis-test-files-')) },
  },
})
