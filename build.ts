// Build the SlicerRAD-IDC static site into _site/:
//   _site/bir.js    — the pinned SlicerLive BIR reader (vendor submodule), bundled with esbuild
//   _site/index.html — the read-only IDC viewer page (measurements off, Share/Download on)
//   _site/config.js  — deployment settings (the Google OAuth client id, from the environment)
//
// The whole app is the SlicerLive Basic Image Review reader, pinned via the vendor/SlicerLive
// git submodule so this deployment does NOT float with SlicerLive main. To take an update,
// bump the submodule (see README) and let the deploy Action rebuild.
//
//   deno task build      # or: deno run -A build.ts

const OUT = "_site";
const ENTRY = "vendor/SlicerLive/render/demos/bir-browser.ts";

try {
  Deno.statSync(ENTRY);
} catch {
  console.error(`missing ${ENTRY} — run: git submodule update --init --recursive`);
  Deno.exit(1);
}

await Deno.mkdir(OUT, { recursive: true });

const esbuild = new Deno.Command("deno", {
  args: ["run", "-A", "npm:esbuild@0.21.5", ENTRY, "--bundle", "--format=esm", `--outfile=${OUT}/bir.js`],
  stdout: "inherit",
  stderr: "inherit",
});
const { code } = await esbuild.output();
if (code !== 0) Deno.exit(code);

await Deno.copyFile("index.html", `${OUT}/index.html`);
// Deployment settings the page reads before bir.js runs. GOOGLE_OAUTH_CLIENT_ID is the OAuth
// client the "Sign in with Google" button uses to reach a `?gcp=` store (a GitHub Actions repo
// variable in deploy.yml). Unset → the button explains that sign-in isn't configured, and
// `&token=` still works for testing.
const config = { googleClientId: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "" };
await Deno.writeTextFile(`${OUT}/config.js`, `window.__SLICERRAD_CONFIG = ${JSON.stringify(config)};\n`);
// The idc_tools loader spawns a classic Web Worker resolved as ./idc-worker.js next to the
// bundle, so it must sit beside bir.js in _site.
await Deno.copyFile("vendor/SlicerLive/render/vendor/idc_tools/idc-worker.js", `${OUT}/idc-worker.js`);
// The worker importScripts ./dicom-volume.js — the shared DICOM->volume core (multi-frame /
// 3D-ultrasound assembly) it shares with the ReMINDer worker, so it must sit beside it.
await Deno.copyFile("vendor/SlicerLive/render/vendor/idc_tools/dicom-volume.js", `${OUT}/dicom-volume.js`);
// ...and ./dcmjs.min.js, SlicerLive's vendored dcmjs, before it falls back to a CDN copy.
await Deno.copyFile("vendor/SlicerLive/render/vendor/dcmjs/dcmjs.min.js", `${OUT}/dcmjs.min.js`);
// SlicerLive favicon (index.html links favicon.ico + apple-touch-icon.png).
await Deno.copyFile("favicon.ico", `${OUT}/favicon.ico`);
await Deno.copyFile("apple-touch-icon.png", `${OUT}/apple-touch-icon.png`);
console.log(
  `built ${OUT}/ (bir.js + index.html + config.js + idc-worker.js + dcmjs + favicon)` +
    (config.googleClientId ? "" : " — no GOOGLE_OAUTH_CLIENT_ID, so Google sign-in is off"),
);
