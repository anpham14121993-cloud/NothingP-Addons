/**
 * Nothing-P • Fiml4K — Online Local Stremio Addon for Aio-Stream
 *
 * Runs directly on the user's device via QuickJS + LocalProxyHttpServer,
 * using the user's residential IP and emitting `localProxy` `hls-rewrite`
 * hints so disguised `.image` fMP4 segments are unwrapped locally.
 */

const DEFAULT_API_BASE = "https://fiml4k.fun";
const DEFAULT_TMDB_BASE = "https://api.themoviedb.org/3";
const API_PAGE_SIZE = 24;
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36";

const manifest = {
  id: "community.fiml4k.local",
  version: "1.0.3",
  name: "Nothing-P • Fiml4K",
  description:
    "Phim 4K & Phim Bộ Vietsub (tải online từ GitHub, chạy trực tiếp bằng IP thiết bị qua Local Proxy)",
  resources: [
    "catalog",
    { name: "meta", types: ["movie", "series"], idPrefixes: ["fiml4k"] },
    {
      name: "stream",
      types: ["movie", "series"],
      idPrefixes: ["fiml4k", "tmdb", "imdb", "tt"],
    },
  ],
  types: ["movie", "series"],
  catalogs: [
    {
      type: "movie",
      id: "fiml4k_movies",
      name: "Fiml4K • Phim Lẻ",
      extra: [
        { name: "search", isRequired: false },
        { name: "skip", isRequired: false },
      ],
    },
    {
      type: "series",
      id: "fiml4k_series",
      name: "Fiml4K • Phim Bộ",
      extra: [
        { name: "search", isRequired: false },
        { name: "skip", isRequired: false },
      ],
    },
  ],
};

const VI_ASCII_MAP = {
  à: "a", á: "a", ạ: "a", ả: "a", ã: "a",
  â: "a", ầ: "a", ấ: "a", ậ: "a", ẩ: "a", ẫ: "a",
  ă: "a", ằ: "a", ắ: "a", ặ: "a", ẳ: "a", ẵ: "a",
  è: "e", é: "e", ẹ: "e", ẻ: "e", ẽ: "e",
  ê: "e", ề: "e", ế: "e", ệ: "e", ể: "e", ễ: "e",
  ì: "i", í: "i", ị: "i", ỉ: "i", ĩ: "i",
  ò: "o", ó: "o", ọ: "o", ỏ: "o", õ: "o",
  ô: "o", ồ: "o", ố: "o", ộ: "o", ổ: "o", ỗ: "o",
  ơ: "o", ờ: "o", ớ: "o", ợ: "o", ở: "o", ỡ: "o",
  ù: "u", ú: "u", ụ: "u", ủ: "u", ũ: "u",
  ư: "u", ừ: "u", ứ: "u", ự: "u", ử: "u", ữ: "u",
  ỳ: "y", ý: "y", ỵ: "y", ỷ: "y", ỹ: "y",
  đ: "d",
};

function slugifyFiml4k(title) {
  let s = String(title || "").toLowerCase();
  try {
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch (_) {
    // Fallback below handles Vietnamese chars if runtime lacks NFD.
  }
  let folded = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    folded += Object.prototype.hasOwnProperty.call(VI_ASCII_MAP, ch)
      ? VI_ASCII_MAP[ch]
      : ch;
  }
  return folded
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getApiBase(env) {
  return ((env && env.apiBaseUrl) || DEFAULT_API_BASE).replace(/\/+$/, "");
}

function getTmdbBase(env) {
  return ((env && env.tmdbBaseUrl) || DEFAULT_TMDB_BASE).replace(/\/+$/, "");
}

function fiml4kTypeToStremio(raw) {
  const t = String(raw || "").trim().toLowerCase();
  return t === "tv" || t === "series" ? "series" : "movie";
}

function resolveUpstreamUrl(rawPath, apiBase) {
  const s = String(rawPath || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return "https:" + s;
  return apiBase + (s.startsWith("/") ? s : "/" + s);
}

function resolveOptionalUrl(rawPath, apiBase) {
  const s = String(rawPath || "").trim();
  return s ? resolveUpstreamUrl(s, apiBase) : "";
}

function preferVi(obj, key) {
  if (!obj || typeof obj !== "object") return "";
  const camel = obj[key + "Vi"];
  if (typeof camel === "string" && camel.trim()) return camel;
  const snake = obj[key + "_vi"];
  if (typeof snake === "string" && snake.trim()) return snake;
  const v = obj[key];
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  if (typeof v === "object") {
    if (typeof v.vi === "string" && v.vi.trim()) return v.vi;
    if (typeof v.en === "string" && v.en.trim()) return v.en;
    const keys = Object.keys(v);
    for (let i = 0; i < keys.length; i++) {
      const candidate = v[keys[i]];
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
  }
  return "";
}

function extractGenres(obj) {
  const g = obj && obj.genres;
  if (!g) return [];
  let arr = null;
  if (Array.isArray(g)) {
    arr = g;
  } else if (typeof g === "object") {
    if (Array.isArray(g.vi)) arr = g.vi;
    else if (Array.isArray(g.en)) arr = g.en;
    else {
      const keys = Object.keys(g);
      for (let i = 0; i < keys.length; i++) {
        if (Array.isArray(g[keys[i]])) {
          arr = g[keys[i]];
          break;
        }
      }
    }
  }
  if (!arr) return [];
  return arr.filter((x) => typeof x === "string" && x.trim().length > 0);
}

function parseJsonSafe(raw) {
  const txt = String(raw || "").trim();
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch (_) {
    const first = txt.indexOf("{");
    const last = txt.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(txt.slice(first, last + 1));
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

async function fetchText(url, apiBase) {
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": MOBILE_USER_AGENT,
        Referer: apiBase + "/",
        Origin: apiBase,
        Accept: "*/*",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
        Cookie: "locale=vi",
      },
    });
    if (!resp || !resp.ok) return null;
    return await resp.text();
  } catch (_) {
    return null;
  }
}

async function fetchJsonObject(url, apiBase) {
  const txt = await fetchText(url, apiBase);
  const parsed = parseJsonSafe(txt);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed
    : null;
}

async function fetchTmdbJson(urlWithoutKey, env) {
  const primary = (env && env.tmdbPrimaryKey) || "";
  const fallback = (env && env.tmdbFallbackKey) || "";
  const sep = urlWithoutKey.indexOf("?") >= 0 ? "&" : "?";

  if (primary) {
    try {
      const r1 = await fetch(
        urlWithoutKey + sep + "api_key=" + encodeURIComponent(primary),
        { method: "GET" }
      );
      if (r1 && r1.ok) return parseJsonSafe(await r1.text());
      if (!r1 || (r1.status !== 401 && r1.status !== 429) || !fallback || fallback === primary) {
        return null;
      }
    } catch (_) {
      if (!fallback || fallback === primary) return null;
    }
  }
  if (fallback) {
    try {
      const r2 = await fetch(
        urlWithoutKey + sep + "api_key=" + encodeURIComponent(fallback),
        { method: "GET" }
      );
      if (r2 && r2.ok) return parseJsonSafe(await r2.text());
    } catch (_) {
      return null;
    }
  }
  return null;
}

function itemToMeta(item, forcedType, apiBase) {
  if (!item || typeof item !== "object" || !item.slug) return null;
  const slug = String(item.slug);
  const type = forcedType || fiml4kTypeToStremio(item.mediaType || item.type);
  const meta = {
    id: "fiml4k:" + slug,
    type,
    name: preferVi(item, "title") || slug,
    poster: resolveOptionalUrl(preferVi(item, "poster"), apiBase),
    posterShape: "poster",
    background: resolveOptionalUrl(item.backdrop || "", apiBase),
    description: preferVi(item, "overview"),
    releaseInfo: item.year != null ? String(item.year) : "",
    imdbRating: item.score != null ? String(item.score) : "",
    genres: extractGenres(item),
  };
  if (item.imdbId) meta.imdb_id = String(item.imdbId);
  if (item.tmdbId != null && !isNaN(Number(item.tmdbId))) {
    meta.tmdb_id = Number(item.tmdbId);
  }
  return meta;
}

async function fetchHomePage(apiType, page, apiBase) {
  const data = await fetchJsonObject(
    apiBase + "/api/home?type=" + encodeURIComponent(apiType) + "&page=" + page,
    apiBase
  );
  return data && Array.isArray(data.list) ? data.list : [];
}

async function searchSuggest(query, apiBase) {
  const data = await fetchJsonObject(
    apiBase + "/api/search/suggest?q=" + encodeURIComponent(query),
    apiBase
  );
  return data && Array.isArray(data.list) ? data.list : [];
}

function extractMovieObject(data) {
  if (!data || typeof data !== "object") return null;
  if (data.movie && typeof data.movie === "object") return data.movie;
  if (data.result && typeof data.result === "object") return data.result;
  if (data.slug || data.title || data.titleVi) return data;
  return null;
}

function extractSources(data) {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.sources) && data.sources.length > 0) return data.sources;
  if (data.movie && Array.isArray(data.movie.sources)) return data.movie.sources;
  return [];
}

function extractEpisodes(data) {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.episodes) && data.episodes.length > 0) return data.episodes;
  if (data.movie && Array.isArray(data.movie.episodes) && data.movie.episodes.length > 0) {
    return data.movie.episodes;
  }
  const found = [];
  function walk(node, depth) {
    if (depth > 5 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) walk(node[i], depth + 1);
      return;
    }
    const hasEp =
      node.episode != null ||
      node.ep != null ||
      node.episodeNumber != null ||
      node.episode_number != null;
    const hasSeason =
      node.season != null ||
      node.seasonNumber != null ||
      node.season_number != null;
    if (hasEp || hasSeason) {
      found.push(node);
    }
    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] !== "related") walk(node[keys[i]], depth + 1);
    }
  }
  walk(data, 0);
  return found;
}

function toIntOr(val, fallback) {
  const n = Number(val);
  return Number.isFinite(n) && val !== "" && val != null ? Math.trunc(n) : fallback;
}

function findMatchingEpisode(episodes, season, episode) {
  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i];
    if (!ep || typeof ep !== "object") continue;
    const s = toIntOr(ep.season ?? ep.seasonNumber ?? ep.season_number, 1);
    const e = toIntOr(ep.episode ?? ep.ep ?? ep.episodeNumber ?? ep.episode_number, 0);
    if (s === season && e === episode) return ep;
  }
  return null;
}

async function fetchTitleData(slug, apiBase) {
  return await fetchJsonObject(
    apiBase + "/api/title/" + encodeURIComponent(slug),
    apiBase
  );
}

function matchesTmdbEntry(movie, tmdbId, stremioType) {
  if (!movie) return false;
  if (movie.tmdbId != null && Number(movie.tmdbId) !== Number(tmdbId)) return false;
  if (movie.mediaType && fiml4kTypeToStremio(movie.mediaType) !== stremioType) return false;
  return true;
}

async function resolveTmdbToFiml4k(tmdbId, stremioType, env) {
  const apiBase = getApiBase(env);
  const tmdbBase = getTmdbBase(env);
  const kind = stremioType === "series" ? "tv" : "movie";
  const tmdbData = await fetchTmdbJson(
    tmdbBase + "/" + kind + "/" + tmdbId + "?language=en-US",
    env
  );
  if (!tmdbData) return null;

  const title = stremioType === "series" ? tmdbData.name : tmdbData.title;
  if (!title) return null;
  const year = String(
    (stremioType === "series" ? tmdbData.first_air_date : tmdbData.release_date) || ""
  ).slice(0, 4);

  const slug = slugifyFiml4k(title);
  if (slug) {
    const titleData = await fetchTitleData(slug, apiBase);
    const movie = extractMovieObject(titleData);
    if (movie && matchesTmdbEntry(movie, tmdbId, stremioType)) {
      return { slug: movie.slug || slug, title, year, titleData };
    }
  }

  const candidates = await searchSuggest(title, apiBase);
  for (let i = 0; i < Math.min(candidates.length, 6); i++) {
    const item = candidates[i];
    if (!item || !item.slug) continue;
    const candType = fiml4kTypeToStremio(item.mediaType || item.type);
    if (candType !== stremioType) continue;
    const candData = await fetchTitleData(item.slug, apiBase);
    const movie = extractMovieObject(candData);
    if (movie && Number(movie.tmdbId) === Number(tmdbId)) {
      return { slug: movie.slug || item.slug, title, year, titleData: candData };
    }
  }
  return null;
}

async function resolveImdbToFiml4k(imdbId, stremioType, env) {
  const cleanImdb = String(imdbId || "").trim().replace(/^imdb:/i, "");
  if (!/^tt\d+$/i.test(cleanImdb)) return null;
  const tmdbBase = getTmdbBase(env);
  const findData = await fetchTmdbJson(
    tmdbBase + "/find/" + encodeURIComponent(cleanImdb) + "?external_source=imdb_id",
    env
  );
  if (!findData) return null;
  const arr = findData[stremioType === "series" ? "tv_results" : "movie_results"];
  const tmdbId = Array.isArray(arr) && arr[0] ? arr[0].id : null;
  if (tmdbId == null) return null;
  const resolved = await resolveTmdbToFiml4k(tmdbId, stremioType, env);
  if (!resolved) return null;
  const movie = extractMovieObject(resolved.titleData);
  if (movie && movie.imdbId && String(movie.imdbId).toLowerCase() !== cleanImdb.toLowerCase()) {
    return null;
  }
  return resolved;
}

async function inspectMasterVariants(masterUrl, apiBase) {
  const text = await fetchText(masterUrl, apiBase);
  if (!text) return [];
  const variants = [];
  const seen = {};
  const lines = text.split(/\r?\n/);
  const rank = { "4k": 4, "1080": 3, "720": 2, "480": 1 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.toUpperCase().startsWith("#EXT-X-STREAM-INF:")) continue;
    const rm = line.match(/RESOLUTION=(\d+)x(\d+)/i);
    const bm = line.match(/BANDWIDTH=(\d+)/i);
    const w = rm ? parseInt(rm[1], 10) : 0;
    const h = rm ? parseInt(rm[2], 10) : 0;
    const bw = bm ? parseInt(bm[1], 10) : 0;
    const maxDim = Math.max(w, h);
    const minDim = Math.min(w, h);
    let qKey = "480";
    if (maxDim >= 3840 || minDim >= 1500) qKey = "4k";
    else if (maxDim >= 1920 || minDim >= 800) qKey = "1080";
    else if (maxDim >= 1200 || minDim >= 650) qKey = "720";
    if (!seen[qKey]) {
      seen[qKey] = true;
      variants.push({ quality: qKey, width: w, height: h, bandwidth: bw });
    }
  }
  variants.sort((a, b) => (rank[b.quality] || 0) - (rank[a.quality] || 0));
  return variants;
}

function formatStreamDisplay(opts) {
  const cleanText = String(opts.filename || "").replace(
    /fiml4k(\.fun)?|film4k(\.net)?/gi,
    " "
  );
  let resBadge = "1080p FHD";
  let resText = "1080p Full HD";
  if (opts.lockQuality === "4k" || opts.realHeight >= 1500 || opts.realWidth >= 3840) {
    resBadge = "4K UHD";
    resText =
      opts.realWidth > 0 && opts.realHeight > 0
        ? "4K UHD (" + opts.realWidth + "x" + opts.realHeight + ")"
        : "4K UHD (2160p)";
  } else if (
    opts.lockQuality === "1080" ||
    opts.realHeight >= 800 ||
    opts.realWidth >= 1920
  ) {
    resBadge = "1080p FHD";
    resText =
      opts.realWidth > 0 && opts.realHeight > 0
        ? "1080p Full HD (" + opts.realWidth + "x" + opts.realHeight + ")"
        : "1080p Full HD";
  } else if (
    opts.lockQuality === "720" ||
    opts.realHeight >= 650 ||
    opts.realWidth >= 1200
  ) {
    resBadge = "720p HD";
    resText =
      opts.realWidth > 0 && opts.realHeight > 0
        ? "720p HD (" + opts.realWidth + "x" + opts.realHeight + ")"
        : "720p HD";
  } else if (/4k|2160p/i.test(String(opts.maxRes || ""))) {
    resBadge = "4K UHD";
    resText = "4K UHD (2160p)";
  }

  const isDV = /\b(dv|dovi|dolby\s*vision)\b/i.test(cleanText);
  const isHDR = /\b(hdr|hdr10|hdr10\+)\b/i.test(cleanText);
  let hdrBadge = "";
  if (isDV && isHDR) hdrBadge = "DV • HDR";
  else if (isDV) hdrBadge = "Dolby Vision";
  else if (isHDR) hdrBadge = "HDR";

  const voices = [];
  if (opts.viDub) voices.push("🎙️ Thuyết minh");
  if (opts.viSubs) voices.push("💬 Phụ đề Vietsub");
  if (voices.length === 0) voices.push("🌐 Âm thanh gốc");

  let sizeStr = "";
  if (opts.sizeBytes > 0) {
    sizeStr =
      opts.sizeBytes >= 1024 * 1024 * 1024
        ? (opts.sizeBytes / (1024 * 1024 * 1024)).toFixed(2) + " GB"
        : Math.round(opts.sizeBytes / (1024 * 1024)) + " MB";
  }

  const yearTag = opts.year ? " • " + opts.year : "";
  const lineTitle =
    opts.isSeries && opts.season != null && opts.episode != null
      ? "🎬 " +
        opts.movieTitle +
        " • Mùa " +
        opts.season +
        " - Tập " +
        opts.episode +
        " (S" +
        String(opts.season).padStart(2, "0") +
        "E" +
        String(opts.episode).padStart(2, "0") +
        ")" +
        yearTag
      : "🎬 " + opts.movieTitle + yearTag;

  const videoDetails = [resText || resBadge, hdrBadge].filter(Boolean).join(" • ");
  const extraParts = [
    sizeStr ? "💾 " + sizeStr : "",
    "⚡ " + (opts.serverLabel || "Fiml4K CDN") + " (Local Proxy)",
  ]
    .filter(Boolean)
    .join(" • ");

  const name = hdrBadge
    ? manifest.name + "\n[" + resBadge + " • " + hdrBadge + "]"
    : manifest.name + "\n[" + resBadge + "]";
  const title = [lineTitle, "📺 " + videoDetails, voices.join(" • "), extraParts].join(
    "\n"
  );
  return { name, title };
}

function buildStreamEntry(name, title, url, slug, apiBase) {
  return {
    name,
    title,
    url,
    type: "hls",
    behaviorHints: {
      notWebReady: false,
      bingeGroup: "fiml4k-" + slug,
      localProxy: {
        enabled: true,
        mode: "hls-rewrite",
        autoUnwrapTs: true,
        headers: {
          Referer: apiBase + "/",
          Origin: apiBase,
        },
      },
    },
  };
}

async function handleCatalog({ type, extra, env }) {
  const apiBase = getApiBase(env);
  const isSeries = type === "series" || type === "tv";
  const apiType = isSeries ? "tv" : "movie";
  const stremioType = isSeries ? "series" : "movie";
  const search = String((extra && extra.search) || "").trim();
  const skip = Math.max(0, parseInt((extra && extra.skip) || "0", 10) || 0);

  let items = [];
  if (search) {
    const rawList = await searchSuggest(search, apiBase);
    const filtered = rawList.filter(
      (it) => it && fiml4kTypeToStremio(it.mediaType || it.type) === stremioType
    );
    items = filtered.slice(skip, skip + API_PAGE_SIZE);
  } else {
    const startPage = Math.floor(skip / API_PAGE_SIZE) + 1;
    const offset = skip % API_PAGE_SIZE;
    if (offset === 0) {
      items = await fetchHomePage(apiType, startPage, apiBase);
    } else {
      const endPage = Math.floor((skip + API_PAGE_SIZE - 1) / API_PAGE_SIZE) + 1;
      const combined = [];
      for (let p = startPage; p <= endPage; p++) {
        const list = await fetchHomePage(apiType, p, apiBase);
        for (let i = 0; i < list.length; i++) combined.push(list[i]);
      }
      items = combined.slice(offset, offset + API_PAGE_SIZE);
    }
  }

  return {
    metas: items
      .map((it) => itemToMeta(it, stremioType, apiBase))
      .filter(Boolean),
  };
}

async function handleMeta({ type, id, env }) {
  const apiBase = getApiBase(env);
  const isSeries = type === "series" || type === "tv";
  const stremioType = isSeries ? "series" : "movie";
  const slug = String(id || "").replace(/^fiml4k:/, "");
  if (!slug) return { meta: null };

  const titleData = await fetchTitleData(slug, apiBase);
  const movie = extractMovieObject(titleData);
  if (!movie) {
    return {
      meta: {
        id: "fiml4k:" + slug,
        type: stremioType,
        name: slug,
        poster: "",
        background: "",
        description: "",
        releaseInfo: "",
        imdbRating: "",
        genres: [],
      },
    };
  }

  const actualSlug = String(movie.slug || slug);
  const meta = {
    id: "fiml4k:" + actualSlug,
    type: stremioType,
    name: preferVi(movie, "title") || actualSlug,
    poster: resolveOptionalUrl(preferVi(movie, "poster"), apiBase),
    background: resolveOptionalUrl(movie.backdrop || "", apiBase),
    description: preferVi(movie, "overview"),
    releaseInfo: movie.year != null ? String(movie.year) : "",
    imdbRating: movie.score != null ? String(movie.score) : "",
    genres: extractGenres(movie),
  };
  if (movie.imdbId) meta.imdb_id = String(movie.imdbId);
  if (movie.tmdbId != null && !isNaN(Number(movie.tmdbId))) {
    meta.tmdb_id = Number(movie.tmdbId);
  }

  if (isSeries && titleData) {
    const rawEpisodes = extractEpisodes(titleData);
    const seen = {};
    const videos = [];
    for (let i = 0; i < rawEpisodes.length; i++) {
      const ep = rawEpisodes[i];
      if (!ep || typeof ep !== "object") continue;
      const season = toIntOr(ep.season ?? ep.seasonNumber ?? ep.season_number, 1);
      const episode = toIntOr(
        ep.episode ?? ep.ep ?? ep.episodeNumber ?? ep.episode_number,
        i + 1
      );
      if (episode <= 0) continue;
      const dedupKey = season + ":" + episode;
      if (seen[dedupKey]) continue;
      seen[dedupKey] = true;
      videos.push({
        id: "fiml4k:" + actualSlug + ":" + season + ":" + episode,
        title: preferVi(ep, "title") || preferVi(ep, "name") || "Tập " + episode,
        season,
        episode,
        overview: preferVi(ep, "overview"),
      });
    }
    videos.sort((a, b) => a.season - b.season || a.episode - b.episode);
    meta.videos = videos;
  }

  return { meta };
}

async function handleStream({ type, id, env }) {
  const apiBase = getApiBase(env);
  const isSeries = type === "series" || type === "tv";
  const stremioType = isSeries ? "series" : "movie";
  let parts = String(id || "").split(":");
  const prefix = (parts[0] || "").toLowerCase();

  let resolvedTitle = null;
  let resolvedYear = null;
  let preloadedTitleData = null;

  if (prefix === "tmdb") {
    const tmdbId = parseInt(parts[1] || "", 10);
    if (!tmdbId) return { streams: [] };
    const resolved = await resolveTmdbToFiml4k(tmdbId, stremioType, env);
    if (!resolved) return { streams: [] };
    resolvedTitle = resolved.title;
    resolvedYear = resolved.year;
    preloadedTitleData = resolved.titleData;
    parts = isSeries
      ? ["fiml4k", resolved.slug, parts[2] || "1", parts[3] || "1"]
      : ["fiml4k", resolved.slug];
  } else if (prefix === "imdb" || /^tt\d+$/i.test(prefix)) {
    const isImdbPrefix = prefix === "imdb";
    const imdbId = isImdbPrefix ? parts[1] || "" : parts[0];
    const seasonArg = isImdbPrefix ? parts[2] : parts[1];
    const epArg = isImdbPrefix ? parts[3] : parts[2];
    const resolved = await resolveImdbToFiml4k(imdbId, stremioType, env);
    if (!resolved) return { streams: [] };
    resolvedTitle = resolved.title;
    resolvedYear = resolved.year;
    preloadedTitleData = resolved.titleData;
    parts = isSeries
      ? ["fiml4k", resolved.slug, seasonArg || "1", epArg || "1"]
      : ["fiml4k", resolved.slug];
  }

  const slug = String(parts[1] || parts[0] || "").trim();
  if (!slug) return { streams: [] };
  const seasonNum = isSeries ? parseInt(parts[2] || "1", 10) || 1 : 1;
  const episodeNum = isSeries ? parseInt(parts[3] || "1", 10) || 1 : 1;
  const seasonStr = String(seasonNum).padStart(2, "0");
  const episodeStr = String(episodeNum).padStart(2, "0");
  const encodedSlug = encodeURIComponent(slug);

  const watchUrls = [
    apiBase + "/api/watch/" + encodedSlug + "?e=s" + seasonStr + "e" + episodeStr,
    apiBase + "/api/watch/" + encodedSlug + "?episode=" + episodeNum,
    apiBase + "/api/watch/" + encodedSlug + "?ep=" + episodeNum,
  ];

  let watchData = null;
  for (let i = 0; i < watchUrls.length; i++) {
    const fetched = await fetchJsonObject(watchUrls[i], apiBase);
    if (
      fetched &&
      (extractSources(fetched).length > 0 || extractEpisodes(fetched).length > 0)
    ) {
      watchData = fetched;
      break;
    }
    if (!watchData && fetched) watchData = fetched;
  }

  let titleData = preloadedTitleData;
  let sources = watchData ? extractSources(watchData) : [];
  let currentEpisode = watchData
    ? findMatchingEpisode(extractEpisodes(watchData), seasonNum, episodeNum)
    : null;

  if (sources.length === 0 && watchData) {
    const epMatch = findMatchingEpisode(extractEpisodes(watchData), seasonNum, episodeNum);
    if (epMatch && Array.isArray(epMatch.sources)) {
      currentEpisode = epMatch;
      sources = epMatch.sources;
    }
  }

  if (sources.length === 0) {
    titleData = titleData || (await fetchTitleData(slug, apiBase));
    if (titleData) {
      const epMatch = findMatchingEpisode(extractEpisodes(titleData), seasonNum, episodeNum);
      if (epMatch && Array.isArray(epMatch.sources)) {
        currentEpisode = epMatch;
        sources = epMatch.sources;
      }
      if (sources.length === 0) {
        sources = extractSources(titleData);
      }
    }
  }

  const movieObj = extractMovieObject(watchData) || extractMovieObject(titleData);
  const movieViTitle =
    (movieObj ? preferVi(movieObj, "title") : "") ||
    resolvedTitle ||
    slug.replace(/-/g, " ");
  const yearStr =
    (movieObj && movieObj.year != null ? String(movieObj.year) : "") ||
    resolvedYear ||
    "";
  const maxRes = String(
    (movieObj && (movieObj.maxRes || movieObj.maxHeight)) || ""
  );
  const viDub = Boolean(movieObj && movieObj.viDub === true);
  const viSubs = Boolean(movieObj && movieObj.viSubs === true);

  const downloadObj =
    (currentEpisode &&
      (currentEpisode.download ||
        (Array.isArray(currentEpisode.downloads) ? currentEpisode.downloads[0] : null))) ||
    (movieObj &&
      (movieObj.download ||
        (Array.isArray(movieObj.downloads) ? movieObj.downloads[0] : null))) ||
    null;
  const rawFileName = String((downloadObj && downloadObj.name) || "");
  const rawSizeBytes = Number((downloadObj && downloadObj.size) || 0) || 0;

  const outStreams = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    if (!src || typeof src !== "object") continue;
    const rawPath = src.url || src.link || src.file;
    if (!rawPath || !String(rawPath).toLowerCase().includes(".m3u8")) continue;
    const masterUrl = resolveUpstreamUrl(rawPath, apiBase);
    const label = src.label || src.name || "Server " + (i + 1);
    const isIndex = /(?:^|\/)index\.m3u8(?:[?#]|$)/i.test(masterUrl);
    const variants = isIndex ? [] : await inspectMasterVariants(masterUrl, apiBase);
    const hdOr4k = variants.filter((v) => v.quality === "4k" || v.quality === "1080");
    const targetVariants =
      hdOr4k.length > 0 ? hdOr4k : variants.length > 0 ? [variants[0]] : [];

    if (targetVariants.length > 0) {
      for (let j = 0; j < targetVariants.length; j++) {
        const v = targetVariants[j];
        const display = formatStreamDisplay({
          movieTitle: movieViTitle,
          year: yearStr,
          season: isSeries ? seasonNum : null,
          episode: isSeries ? episodeNum : null,
          isSeries,
          filename: rawFileName,
          sizeBytes: rawSizeBytes,
          serverLabel: label,
          maxRes,
          viDub,
          viSubs,
          realWidth: v.width,
          realHeight: v.height,
          lockQuality: v.quality,
        });
        outStreams.push(
          buildStreamEntry(
            display.name,
            display.title,
            masterUrl + "#aio_quality=" + v.quality,
            slug,
            apiBase
          )
        );
      }
    } else {
      const display = formatStreamDisplay({
        movieTitle: movieViTitle,
        year: yearStr,
        season: isSeries ? seasonNum : null,
        episode: isSeries ? episodeNum : null,
        isSeries,
        filename: rawFileName,
        sizeBytes: rawSizeBytes,
        serverLabel: label,
        maxRes,
        viDub,
        viSubs,
        realWidth: 0,
        realHeight: 0,
        lockQuality: null,
      });
      outStreams.push(
        buildStreamEntry(display.name, display.title, masterUrl, slug, apiBase)
      );
    }
  }

  return { streams: outStreams };
}

module.exports = {
  manifest,
  handleCatalog,
  handleMeta,
  handleStream,
};
