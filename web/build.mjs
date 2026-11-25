import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(WEB_DIR, "..");
const DIST_DIR = join(ROOT_DIR, "dist");

async function main() {
  mkdirSync(DIST_DIR, { recursive: true });

  const jsResult = await build({
    entryPoints: [join(WEB_DIR, "app.ts")],
    bundle: true,
    minify: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    write: false,
  });

  const cssResult = await build({
    entryPoints: [join(WEB_DIR, "styles.css")],
    bundle: true,
    minify: true,
    write: false,
  });

  const jsCode = jsResult.outputFiles[0].text;
  const cssCode = cssResult.outputFiles[0].text;
  const template = readFileSync(join(WEB_DIR, "index.html"), "utf8");

  const finalHtml = template
    .replace("/*__INLINE_CSS__*/", () => cssCode)
    .replace("/*__INLINE_JS__*/", () => jsCode.replace(/<\/script>/gi, "<\\/script>"));

  const outPath = join(DIST_DIR, "app.html");
  writeFileSync(outPath, finalHtml, "utf8");
  const kb = (Buffer.byteLength(finalHtml, "utf8") / 1024).toFixed(1);
  console.log(`Built ${outPath} (${kb} KiB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
