/* eslint-disable react-refresh/only-export-components -- Node-only SSR entry, never loaded by Vite's client dev server, Fast Refresh doesn't apply to this file */
import React from "react";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import type { NextFunction, Response } from "express";
import { renderToPipeableStream } from "react-dom/server";
import { readClientEntryAssets } from "./assetManifest";

interface StreamDocumentOptions {
  clientDist: string;
  next: NextFunction;
  res: Response;
}

interface ServerEntryModule {
  ServerApp: React.ComponentType;
}

const THEME_BOOTSTRAP_SCRIPT = `
(function () {
  try {
    var v = sessionStorage.getItem('be.darkMode');
    document.documentElement.setAttribute('data-theme', v === 'false' ? 'light' : 'dark');
  } catch (e) {}
})();
`;

let cachedServerEntry: Promise<ServerEntryModule> | null = null;

// Hides the dynamic import from the bundler so it doesn't try to statically
// resolve dist-ssr/entry-server.mjs at build time — entryUrl is built from
// process.cwd() below, never user input, so this isn't an eval-injection risk.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const importServerEntry = new Function(
  "entryUrl",
  "return import(entryUrl)"
) as (entryUrl: string) => Promise<ServerEntryModule>;

function loadServerEntry() {
  if (process.env.NODE_ENV === "production" && cachedServerEntry) {
    return cachedServerEntry;
  }

  const entryUrl = pathToFileURL(
    join(process.cwd(), "dist-ssr", "entry-server.mjs")
  ).href;
  const entryPromise = importServerEntry(entryUrl);

  if (process.env.NODE_ENV === "production") {
    cachedServerEntry = entryPromise;
  }

  return entryPromise;
}

function HtmlDocument({
  ServerApp,
  script,
  stylesheets,
}: {
  ServerApp: React.ComponentType;
  script: string;
  stylesheets: string[];
}) {
  return (
    <html lang="en">
      <head>
        <title>Butterfly Effect</title>
        <meta charSet="utf-8" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover"
        />
        <meta
          name="description"
          content="Butterfly Effect is a playful project shaped by quick questions and shared responses."
        />
        <link rel="canonical" href="https://butterflyeff3ct.online/" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f8f3ef" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#222227" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="icon" type="image/svg+xml" href="/be-icon.svg" />
        <link rel="apple-touch-icon" href="/be-icon.svg" />
        <link rel="manifest" href="/manifest.json" />
        {stylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        <div id="butterfly-effect">
          <ServerApp />
        </div>
        <script type="module" src={script} />
      </body>
    </html>
  );
}

export async function streamDocument({
  clientDist,
  next,
  res,
}: StreamDocumentOptions) {
  const [assets, { ServerApp }] = await Promise.all([
    readClientEntryAssets(clientDist),
    loadServerEntry(),
  ]);

  let didError = false;

  const stream = renderToPipeableStream(
    <HtmlDocument
      ServerApp={ServerApp}
      script={assets.script}
      stylesheets={assets.stylesheets}
    />,
    {
      onShellReady() {
        res.status(didError ? 500 : 200);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        stream.pipe(res);
      },
      onShellError(error) {
        next(error);
      },
      onError(error) {
        didError = true;
        console.error("[streamDocument] React stream error:", error);
      },
    }
  );

  setTimeout(() => {
    stream.abort();
  }, 10000);
}
