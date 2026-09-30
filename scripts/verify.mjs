import { createServer } from "vite";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

const { default: App } = await vite.ssrLoadModule("/src/App.jsx");
const html = renderToString(createElement(App));

const checks = [
  "News-Views",
  "Congress demands the voter-roll revision be stopped",
  "Israeli strike kills a senior Hamas commander in Gaza",
  "A morning paper for India",
  "New Delhi",
  "Gaza City",
  "Nagoya",
  "Politics",
  "Markets",
  "The biggest stories beyond India",
  "JOHNSHI RAJPOOT",
  "Neeru Dhanda",
  "Inox Clean Energy",
  "Heavy rain stays south and east",
  "Pyongyang rejects",
];

let failed = 0;
for (const text of checks) {
  if (!html.includes(text)) {
    console.error("MISSING:", text);
    failed += 1;
  } else {
    console.log("ok:", text);
  }
}

console.log(failed ? `FAILED ${failed}` : "SSR render checks passed");
await vite.close();
process.exit(failed ? 1 : 0);
