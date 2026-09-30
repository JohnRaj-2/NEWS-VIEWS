# NEWS-VIEWS
A morning paper for India and the biggest stories from the rest of the world. Stories are taken from live publisher feeds, change with the date, and can be read in English or Hindi.

Made by JOHNSHI RAJPOOT.

## What you can do

- Read today’s desk, or step back through the last seven days (Asia/Kolkata).
- Switch between English and Hindi. The choice is remembered in the browser.
- Search by city, topic, or name, then narrow the desk by India or world, region, place, and topic.
- Open a story for a short brief and a link to the original report.
- See the photo that came with the wire, when the publisher included one.

Each brief is a short reading of someone else’s report. The full piece stays on the publisher’s site.

## Requirements

- Node.js 20 or newer
- A network connection, so the desk can reach the publisher feeds

The dev and build scripts start Node with `--use-system-ca`, so the process trusts the operating system’s certificate store. That matters on networks that inspect HTTPS.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the site and the news API on port 5173 |
| `npm run build` | Writes a production build to `dist/` |
| `npm run preview` | Serves the production build, with the same news API |

The first load of a day can take a little while. The server fetches the feeds, then keeps that edition in memory for about eight minutes. The page asks again on that same interval.

If the wires do not answer and nothing is on screen yet, the page falls back to a saved edition from 30 September 2026 and says so.

## Keyboard

- `/` focuses search
- `Esc` closes the open story
- Left and right arrows move through the stories you have open

## API

These routes are part of the Vite server. They are not a separate process.

`GET /api/news?lang=en&day=YYYY-MM-DD`

`lang` is `en` or `hi`. If `day` is omitted, the server uses today’s date in Asia/Kolkata.

The response includes the selected day, today’s date, when the desk was updated, the recent days, and the stories. A story has a title, a short dek, a brief, coverage (`india` or `world`), regions, a location, a topic, the source, a link to the original, a time, and an image URL when one was found.

`GET /api/image?url=`

Fetches a publisher image and returns the bytes. Only `https` URLs are allowed. Local and private hosts are refused, and the response must be an image under 4 MB.

## Where the news comes from

English: The Indian Express, BBC News, and The Hindu.

Hindi: BBC Hindi and Google News (`hi-IN`).

Photos are taken from the feed (`media:content`, `media:thumbnail`, `enclosure`, or an image in the item). If a top story has no picture, the server may read `og:image` from the article page.

## Project layout

```
index.html          Page shell and title
src/App.jsx         Desk, search, filters, and story reader
src/copy.js         English and Hindi interface text
src/dates.js        Asia/Kolkata dates
src/data.js         Saved edition used only when the live wire fails
src/hindi.js        Hindi text for that saved edition
src/server/news.js  Feed fetching, story shaping, and the image proxy
vite.config.js      Dev server and the /api routes
public/favicon.svg  Tab icon
```

## Stack

React 19 and Vite 7. Feeds are parsed in `src/server/news.js`. There is no database and no extra news SDK.
