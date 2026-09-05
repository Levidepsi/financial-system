const { build } = require("esbuild");
const { mkdir, copyFile } = require("node:fs/promises");
const path = require("node:path");

async function buildApp() {
  const root = path.resolve(__dirname, "..");
  const output = path.join(root, "dist");
  await mkdir(output, { recursive: true });
  await Promise.all([
    ...["index.html", "pricing.html", "category-policy.js", "app.js", "styles.css", "favicon.svg", "manifest.webmanifest", "service-worker.js"]
      .map((file) => copyFile(path.join(root, file), path.join(output, file))),
    build({
      entryPoints: [path.join(root, "client/account.js")],
      outfile: path.join(output, "account.js"),
      bundle: true,
      minify: true,
      platform: "browser",
      target: ["es2022"],
    }),
  ]);
}

if (require.main === module) buildApp().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { buildApp };
