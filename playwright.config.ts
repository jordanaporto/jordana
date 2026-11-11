import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_ENV = {
  DATABASE_ADMIN_URL: process.env.E2E_DATABASE_ADMIN_URL ?? "postgres://postgres:postgres@localhost:5432/injecar_e2e",
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://injecar_app:dev-app-password-123@localhost:5432/injecar_e2e",
  APP_URL: `http://localhost:${PORT}`,
  STORAGE_DRIVER: "local",
  STORAGE_LOCAL_DIR: "./storage-e2e",
  CRON_SECRET: "e2e-cron-secret-0123456789",
  ENABLE_BACKGROUND_WORKER: "false",
  WHATSAPP_APP_SECRET: "e2e-app-secret",
  WHATSAPP_VERIFY_TOKEN: "e2e-verify-token",
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    screenshot: "only-on-failure",
    ...devices["Pixel 7"],
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: E2E_ENV,
  },
});
