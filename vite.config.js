import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { imageHandler, newsHandler } from "./src/server/news.js";

function newsApi() {
  const attach = (server) => {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url || "";
      if (url.startsWith("/api/image")) {
        try {
          const query = new URL(url, "http://meridian.local").searchParams;
          const image = await imageHandler(query.get("url") || "");
          if (!image) {
            res.statusCode = 404;
            res.end();
            return;
          }
          res.setHeader("Content-Type", image.type);
          res.setHeader("Cache-Control", "public, max-age=86400");
          res.end(image.body);
        } catch {
          res.statusCode = 404;
          res.end();
        }
        return;
      }
      if (!url.startsWith("/api/news")) return next();
      try {
        const query = new URL(url, "http://meridian.local").searchParams;
        const payload = await newsHandler({
          lang: query.get("lang") || "en",
          day: query.get("day") || "",
        });
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=120");
        res.end(JSON.stringify(payload));
      } catch {
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "The wires did not answer." }));
      }
    });
  };
  return {
    name: "meridian-news",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  plugins: [react(), newsApi()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
