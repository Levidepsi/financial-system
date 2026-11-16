const { build } = require("esbuild");
const { mkdir, copyFile, cp, rm } = require("node:fs/promises");
const path = require("node:path");

async function buildApp() {
  const root = path.resolve(__dirname, "..");
  const output = path.join(root, "dist");
  await mkdir(output, { recursive: true });
  // Dashboard HTML is served only by the server page gate, never as a public artifact.
  await rm(path.join(output, "index.html"), { force: true });
  await Promise.all([
    cp(path.join(root, "public"), path.join(output, "public"), { recursive: true }),
    ...["offline.html", "access.css", "about.html", "about.css", "about.js", "pricing.html", "category-policy.js", "app.js", "perfi-extras.js", "styles.css", "favicon.svg", "manifest.webmanifest", "service-worker.js"]
      .map((file) => copyFile(path.join(root, file), path.join(output, file))),
    build({
      entryPoints: [path.join(root, "client/access.js")],
      outfile: path.join(output, "access.js"), bundle: true, minify: true, platform: "browser", target: ["es2022"],
    }),
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
