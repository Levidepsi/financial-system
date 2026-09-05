const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://127.0.0.1:5510", channel: "chrome", headless: true, serviceWorkers: "block" },
  webServer: { command: "npm run dev", url: "http://127.0.0.1:5510", env: { PORT: "5510" }, reuseExistingServer: false },
});
