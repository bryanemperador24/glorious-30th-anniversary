// Prints an HTML file to PDF using the headless Chrome that Remotion manages.
// Usage: node scripts/html-to-pdf.mjs <in.html> <out.pdf>
import { openBrowser } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const [input, output] = process.argv.slice(2);
const browser = await openBrowser("chrome");
const page = await browser.newPage({ context: () => null, logLevel: "error", indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => {} });
await page.goto({ url: `file://${path.resolve(input)}`, timeout: 30000 });
const res = await page._client().send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
fs.writeFileSync(output, Buffer.from((res.value ?? res).data, "base64"));
await browser.close({ silent: true });
console.log(`PDF written to ${output}`);
