import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: ["browser.spec.js", "assets.spec.js", "crowd.spec.js"],
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: process.env.GAME_URL || "http://127.0.0.1:5187",
    viewport: { width: 1440, height: 900 },
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    launchOptions: {
      args: [
        "--enable-webgl",
        "--use-gl=angle",
        process.platform === "darwin"
          ? "--use-angle=metal"
          : "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: process.env.GAME_URL
    ? undefined
    : {
        command: "npm run dev -- --port 5187 --strictPort",
        url: "http://127.0.0.1:5187",
        reuseExistingServer: true,
      },
});
