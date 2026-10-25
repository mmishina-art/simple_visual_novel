import { defineConfig, devices } from '@playwright/test';

// Safari（WebKit）での表示確認専用。選択肢の見切れチェックだけを iPhone 相当の環境で回す。
// 通常の test:e2e（Chromium）とは別に、CI で実行する。
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'choices-layout.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['iPhone 13'],
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
