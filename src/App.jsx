import { useEffect, useMemo, useRef, useState } from "react";
import { COPY, LABELS } from "./copy.js";
import { PLACES, REGIONS, STORIES, TOPICS } from "./data.js";
import { addDays, istDay, recentDays } from "./dates.js";
import { HINDI } from "./hindi.js";

const SIGNAL_RANK = { Breaking: 0, Developing: 1, Result: 2, Desk: 3 };

function initialLang() {
  try {
    return localStorage.getItem("meridian-lang") === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
}

function textOf(story, lang, key) {
  if (lang === "hi" && HINDI[story.id]?.[key]) return HINDI[story.id][key];
  return story[key];
}

function storyMatches(story, filters) {
  if (filters.coverage !== "all" && story.coverage !== filters.coverage) return false;
  if (filters.region !== "all" && !story.regions.includes(filters.region)) return false;
  if (filters.location !== "all" && !story.places.includes(filters.location)) return false;
  if (filters.topic !== "all" && story.topic !== filters.topic) return false;
  const q = filters.query.trim().toLowerCase();
  if (!q) return true;
  const hi = HINDI[story.id] || {};
  const hay = [
    story.title,
    story.dek,
    story.topic,
    story.location,
    story.source,
    ...story.places,
    ...story.regions,
    ...story.body,
    hi.title,
    hi.dek,
    ...(hi.body || []),
  ]
    .join("\n")
    .toLowerCase();
  return hay.includes(q);
}

function formatWhen(iso, now, lang) {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (lang === "hi") {
    if (mins < 1) return "अभी";
    if (mins < 60) return `${mins} मि`;
    const hours = Math.round(mins / 60);
    if (hours < 36) return `${hours} घं`;
    return `${Math.round(hours / 24)} दि`;
  }
  if (mins < 1) return "Just in";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatClock(now) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

function formatEdition(day, lang) {
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${day}T12:00:00+05:30`));
}

function formatDayChip(day, today, lang, ui) {
  if (day === today) return ui.today;
  if (day === addDays(today, -1)) return ui.yesterday;
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T12:00:00+05:30`));
}

function readMinutes(story, lang) {
  const body = textOf(story, lang, "body");
  const words = body.join(" ").trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / (lang === "hi" ? 180 : 220)));
}

function Signal({ value, lang }) {
  if (!value || value === "Desk") return null;
  return <span className={`flag flag-${value.toLowerCase()}`}>{LABELS[lang].signals[value]}</span>;
}

export default function App() {
  const [lang, setLang] = useState(initialLang);
  const [query, setQuery] = useState("");
  const [coverage, setCoverage] = useState("all");
  const [region, setRegion] = useState("all");
  const [location, setLocation] = useState("all");
  const [topic, setTopic] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [day, setDay] = useState(() => istDay(new Date()));
  const followToday = useRef(true);
  const [desk, setDesk] = useState({ status: "loading", stories: [], updatedAt: null });

  const ui = COPY[lang];
  const labels = LABELS[lang];
  const filters = { query, coverage, region, location, topic };
  const isHome =
    coverage === "all" && region === "all" && location === "all" && topic === "all" && query.trim() === "";
  const pool = desk.stories;

  const results = useMemo(() => {
    return pool.filter((story) => storyMatches(story, filters)).sort((a, b) => {
      const bySignal = (SIGNAL_RANK[a.signal] ?? 9) - (SIGNAL_RANK[b.signal] ?? 9);
      if (bySignal) return bySignal;
      return new Date(b.time) - new Date(a.time);
    });
  }, [pool, query, coverage, region, location, topic]);

  const today = istDay(now);
  const homeLead = pool.find((story) => story.coverage === "india") || pool[0];
  const lead = isHome ? homeLead : results[0];
  const sideStories = isHome
    ? pool.filter((story) => story.coverage === "world").slice(0, 4)
    : results.filter((story) => story.id !== lead?.id).slice(0, 4);
  const worldStories = pool.filter((story) => story.coverage === "world" && story.id !== lead?.id);
  const indiaStories = pool.filter((story) => story.coverage === "india" && story.id !== lead?.id);
  const rest = isHome ? [] : results.filter((story) => story.id !== lead?.id).slice(4);
  const regionNames = useMemo(() => {
    const extra = pool.flatMap((story) => story.regions).filter((name) => !REGIONS.includes(name));
    return [...REGIONS, ...new Set(extra)];
  }, [pool]);
  const placeNames = useMemo(() => {
    const base = PLACES.map((place) => place.name);
    const extra = pool.map((story) => story.location).filter((name) => name && !base.includes(name));
    return [...base, ...new Set(extra)];
  }, [pool]);
  const openStory = pool.find((story) => story.id === openId) || null;
  const sequence = results.length ? results : pool;
  const related = openStory
    ? pool.filter(
        (story) =>
          story.id !== openStory.id &&
          (story.topic === openStory.topic || story.places.some((place) => openStory.places.includes(place)))
      ).slice(0, 3)
    : [];

  useEffect(() => {
    const clock = setInterval(() => {
      const next = new Date();
      setNow(next);
      if (followToday.current) setDay(istDay(next));
    }, 30000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    let ignore = false;
    async function load() {
      try {
        const response = await fetch(`/api/news?lang=${lang}&day=${day}`, { signal: ctrl.signal });
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json();
        if (ignore) return;
        setDesk({
          status: data.stories?.length ? "live" : "empty",
          stories: data.stories || [],
          updatedAt: data.updatedAt || null,
        });
      } catch (error) {
        if (ignore || error.name === "AbortError") return;
        setDesk((prev) =>
          prev.stories.length ? prev : { status: "saved", stories: STORIES, updatedAt: null }
        );
      }
    }
    load();
    const poll = setInterval(load, 8 * 60 * 1000);
    return () => {
      ignore = true;
      ctrl.abort();
      clearInterval(poll);
    };
  }, [lang, day]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === "hi" ? "News-Views — भारत और दुनिया" : "News-Views — India & the world";
    try {
      localStorage.setItem("meridian-lang", lang);
    } catch {
      /* ignore private mode */
    }
  }, [lang]);

  useEffect(() => {
    document.body.classList.toggle("locked", Boolean(openId));
    return () => document.body.classList.remove("locked");
  }, [openId]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && pool.some((story) => story.id === hash)) setOpenId(hash);
  }, [pool]);

  useEffect(() => {
    const next = openId ? `#${openId}` : `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", next);
  }, [openId]);

  useEffect(() => {
    function onKey(event) {
      const tag = document.activeElement?.tagName;
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        event.preventDefault();
        document.getElementById("desk-search")?.focus();
      }
      if (event.key === "Escape") setOpenId(null);
      if (!openId || tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    }
    function step(direction) {
      const index = sequence.findIndex((story) => story.id === openId);
      if (index < 0) return;
      const next = sequence[(index + direction + sequence.length) % sequence.length];
      setOpenId(next.id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, sequence]);

  function toggle(setter, current, value) {
    setter(current === value ? "all" : value);
  }

  function clearFilters() {
    setQuery("");
    setCoverage("all");
    setRegion("all");
    setLocation("all");
    setTopic("all");
  }

  function goHome(event) {
    event.preventDefault();
    clearFilters();
    setOpenId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseDay(next) {
    followToday.current = next === istDay(new Date());
    setDay(next);
    setOpenId(null);
  }

  function countWhere(patch, test) {
    return pool.filter((story) => storyMatches(story, { ...filters, ...patch }) && test(story)).length;
  }

  function openStep(direction) {
    const index = sequence.findIndex((story) => story.id === openId);
    if (index < 0) return;
    const next = sequence[(index + direction + sequence.length) % sequence.length];
    setOpenId(next.id);
  }

  return (
    <>
      <header className="mast">
        <div className="wrap mast-bar">
          <a className="wordmark" href="#top" onClick={goHome}>
            News-Views
          </a>
          <form
            className="search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              document.getElementById("stories")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <label className="sr-only" htmlFor="desk-search">
              {ui.searchGo}
            </label>
            <input
              id="desk-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={ui.search}
              autoComplete="off"
            />
            {query && (
              <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label={ui.clear}>
                ×
              </button>
            )}
            <button type="submit" className="search-go">
              {ui.searchGo}
            </button>
          </form>
          <div className="mast-tools">
            <p className="date-line">
              {formatEdition(day, lang)}
              <span className="dot" aria-hidden="true" />
              {formatClock(now)} IST
            </p>
            <div className="lang" role="group" aria-label={lang === "hi" ? "भाषा" : "Language"}>
              <button type="button" className={lang === "en" ? "on" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>
                EN
              </button>
              <button type="button" className={lang === "hi" ? "on" : ""} aria-pressed={lang === "hi"} onClick={() => setLang("hi")}>
                हिं
              </button>
            </div>
          </div>
        </div>
      </header>

      <main id="top" className="wrap">
        <div className="days" role="group" aria-label={ui.edition}>
          {recentDays(today, 7).map((date) => (
            <button
              key={date}
              type="button"
              className={date === day ? "on" : ""}
              aria-pressed={date === day}
              onClick={() => chooseDay(date)}
            >
              {formatDayChip(date, today, lang, ui)}
            </button>
          ))}
        </div>
        <p className="wire-note">
          {desk.status === "loading" && ui.settingTitle}
          {desk.status === "live" && (
            <>
              {ui.liveWire}
              {desk.updatedAt ? ` · ${formatClock(new Date(desk.updatedAt))} IST` : ""}
            </>
          )}
          {desk.status === "saved" && ui.savedWire}
          {desk.status === "empty" && ui.emptyDay}
        </p>
        <div className="filters">
          <div className="seg" role="group" aria-label={ui.all}>
            {[
              ["all", ui.all],
              ["india", ui.india],
              ["world", ui.world],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={coverage === value ? "on" : ""}
                aria-pressed={coverage === value}
                onClick={() => setCoverage(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <FilterRow label={ui.region}>
            <FilterButton on={region === "all"} onClick={() => setRegion("all")}>
              {ui.everywhere}
            </FilterButton>
            {regionNames.map((name) => (
              <FilterButton
                key={name}
                on={region === name}
                count={countWhere({ region: "all" }, (story) => story.regions.includes(name))}
                disabled={countWhere({ region: "all" }, (story) => story.regions.includes(name)) === 0 && region !== name}
                onClick={() => toggle(setRegion, region, name)}
              >
                {labels.regions[name] || name}
              </FilterButton>
            ))}
          </FilterRow>

          <FilterRow label={ui.place}>
            <FilterButton on={location === "all"} onClick={() => setLocation("all")}>
              {ui.allPlaces}
            </FilterButton>
            {placeNames.map((name) => {
              const count = countWhere({ location: "all" }, (story) => story.places.includes(name));
              return (
                <FilterButton
                  key={name}
                  on={location === name}
                  count={count}
                  disabled={count === 0 && location !== name}
                  onClick={() => toggle(setLocation, location, name)}
                >
                  {labels.places[name] || name}
                </FilterButton>
              );
            })}
          </FilterRow>

          <FilterRow label={ui.topic}>
            <FilterButton on={topic === "all"} onClick={() => setTopic("all")}>
              {ui.allTopics}
            </FilterButton>
            {TOPICS.map((name) => {
              const count = countWhere({ topic: "all" }, (story) => story.topic === name);
              return (
                <FilterButton
                  key={name}
                  on={topic === name}
                  count={count}
                  disabled={count === 0 && topic !== name}
                  onClick={() => toggle(setTopic, topic, name)}
                >
                  {labels.topics[name]}
                </FilterButton>
              );
            })}
          </FilterRow>

          {!isHome && (
            <p className="status">
              <strong>{results.length}</strong> {results.length === 1 ? ui.matchOne : ui.matchMany}
              <button type="button" className="text-btn" onClick={clearFilters}>
                {ui.clear}
              </button>
            </p>
          )}
        </div>

        <section className="front" id="stories">
          <Lead
            story={lead}
            status={desk.status}
            lang={lang}
            ui={ui}
            labels={labels}
            now={now}
            onOpen={setOpenId}
          />
          <aside className="rail" aria-label={ui.latest}>
            <p className="rail-label">{ui.latest}</p>
            {sideStories.map((story) => (
              <button key={story.id} type="button" className="rail-item" onClick={() => setOpenId(story.id)}>
                <Photo src={story.image} className="rail-photo" />
                <span className="rail-copy">
                  <span className="rail-meta">
                    {labels.topics[story.topic]} · {labels.places[story.location] || story.location}
                  </span>
                  {textOf(story, lang, "title")}
                </span>
              </button>
            ))}
            {!sideStories.length && <p className="quiet">{lead ? ui.onlyPiece : ui.nothingBody}</p>}
          </aside>
        </section>

        {isHome ? (
          <>
            <Section
              kicker={ui.worldKicker}
              title={ui.worldTitle}
              note={ui.worldNote}
              stories={worldStories}
              lang={lang}
              labels={labels}
              ui={ui}
              now={now}
              onOpen={setOpenId}
            />
            <Section
              kicker={ui.indiaKicker}
              title={ui.indiaTitle}
              note={ui.indiaNote}
              stories={indiaStories}
              lang={lang}
              labels={labels}
              ui={ui}
              now={now}
              onOpen={setOpenId}
            />
          </>
        ) : (
          rest.length > 0 && (
            <Section
              kicker={ui.resultsKicker}
              title={ui.resultsTitle}
              note={ui.resultsNote}
              stories={rest}
              lang={lang}
              labels={labels}
              ui={ui}
              now={now}
              onOpen={setOpenId}
            />
          )
        )}
      </main>

      <footer className="colophon">
        <div className="wrap">
          <p>{ui.footerBlurb}</p>
          <p className="hint">{ui.footerHint}</p>
          <p className="made">{ui.madeBy}</p>
          <p className="credit">JOHNSHI RAJPOOT</p>
        </div>
      </footer>

      {openStory && (
        <Reader
          story={openStory}
          related={related}
          lang={lang}
          labels={labels}
          ui={ui}
          now={now}
          onClose={() => setOpenId(null)}
          onOpen={setOpenId}
          onStep={openStep}
        />
      )}
    </>
  );
}

function FilterRow({ label, children }) {
  return (
    <div className="filter-row">
      <span>{label}</span>
      <div className="choices">{children}</div>
    </div>
  );
}

function photoSrc(image) {
  return `/api/image?url=${encodeURIComponent(image)}`;
}

function Photo({ src, className }) {
  const [mode, setMode] = useState(src ? "proxy" : "none");
  if (!src || mode === "none") return null;
  return (
    <img
      className={`shot ${className}`}
      src={mode === "proxy" ? photoSrc(src) : src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setMode(mode === "proxy" ? "direct" : "none")}
    />
  );
}

function FilterButton({ on, count, disabled, onClick, children }) {
  return (
    <button type="button" className={on ? "choice on" : "choice"} aria-pressed={on} disabled={disabled} onClick={onClick}>
      {children}
      {typeof count === "number" && <small>{count}</small>}
    </button>
  );
}

function Lead({ story, status, lang, ui, labels, now, onOpen }) {
  if (!story) {
    const loading = status === "loading";
    return (
      <div className="lead empty">
        <p className="kicker">{loading ? ui.setting : ui.nothingKicker}</p>
        <h2>{loading ? ui.settingTitle : status === "empty" ? ui.emptyDay : ui.nothingTitle}</h2>
        {!loading && status !== "empty" && <p>{ui.nothingBody}</p>}
      </div>
    );
  }
  return (
    <article className="lead">
      <Photo src={story.image} className="lead-photo" />
      <p className="dateline">
        <Signal value={story.signal} lang={lang} />
        <span>{labels.topics[story.topic]}</span>
        <span>{labels.places[story.location] || story.location}</span>
        <span>{formatWhen(story.time, now, lang)}</span>
      </p>
      <h2>{textOf(story, lang, "title")}</h2>
      <p className="standfirst">{textOf(story, lang, "dek")}</p>
      <div className="lead-actions">
        <button type="button" className="read" onClick={() => onOpen(story.id)}>
          {ui.read}
        </button>
        <span>{story.source}</span>
      </div>
    </article>
  );
}

function Section({ kicker, title, note, stories, lang, labels, ui, now, onOpen }) {
  return (
    <section className="desk">
      <div className="section-head">
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
        <p className="note">{note}</p>
      </div>
      <div className="grid">
        {stories.map((story) => (
          <article key={story.id} className="card">
            <button type="button" onClick={() => onOpen(story.id)}>
              <Photo src={story.image} className="card-photo" />
              <p>
                <Signal value={story.signal} lang={lang} />
                {labels.topics[story.topic]}
                <span> · {labels.places[story.location] || story.location}</span>
              </p>
              <h3>{textOf(story, lang, "title")}</h3>
              <p className="dek">{textOf(story, lang, "dek")}</p>
              <p className="meta">
                <span>{formatWhen(story.time, now, lang)}</span>
                <span>{story.source}</span>
              </p>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Reader({ story, related, lang, labels, ui, now, onClose, onOpen, onStep }) {
  useEffect(() => {
    document.getElementById("close-reader")?.focus();
  }, [story.id]);

  const body = textOf(story, lang, "body");

  return (
    <div className="reader-root">
      <button type="button" className="reader-backdrop" aria-label={ui.close} onClick={onClose} />
      <article className="reader" role="dialog" aria-modal="true" aria-labelledby="reader-title">
        <header className="reader-bar">
          <button type="button" id="close-reader" className="text-btn" onClick={onClose}>
            {ui.close}
          </button>
          <div>
            <button type="button" className="text-btn" onClick={() => onStep(-1)}>
              {ui.prev}
            </button>
            <button type="button" className="text-btn" onClick={() => onStep(1)}>
              {ui.next}
            </button>
          </div>
        </header>
        <p className="dateline">
          <Signal value={story.signal} lang={lang} />
          <span>{labels.topics[story.topic]}</span>
          <span>{story.coverage === "india" ? ui.indiaDesk : ui.worldDesk}</span>
        </p>
        <h2 id="reader-title">{textOf(story, lang, "title")}</h2>
        <p className="standfirst">{textOf(story, lang, "dek")}</p>
        <Photo src={story.image} className="reader-photo" />
        <p className="byline">
          {labels.places[story.location] || story.location}
          {" · "}
          {story.regions.map((region) => labels.regions[region] || region).join(" · ")}
          {" · "}
          {formatWhen(story.time, now, lang)}
          {" · "}
          {readMinutes(story, lang)} {ui.minute}
        </p>
        <div className="reader-body">
          {body.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </div>
        <a className="source-card" href={story.url} target="_blank" rel="noreferrer">
          <span>
            {ui.reported} {story.source}
          </span>
          <strong>{ui.original}</strong>
        </a>
        {related.length > 0 && (
          <div className="related">
            <h3>{ui.related}</h3>
            <ul>
              {related.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onOpen(item.id)}>
                    <span>{labels.topics[item.topic]}</span>
                    {textOf(item, lang, "title")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </div>
  );
}
