# Nothing-P • Kho Trình Cắm GitHub (Aio-Stream)

Kho lưu trữ các tiện ích Stremio viết bằng JavaScript thuần, được **Aio-Stream** (từ bản `v1.0.26` trở lên) tải online từ GitHub về máy khi người dùng bấm **Tải & Cài / Cập nhật** trong **Cài đặt → Tiện ích → Kho Trình cắm GitHub (Trên máy)**.

---

## 1. Ưu điểm
- **Không nhúng cứng nguồn phim vào APK Aio-Stream**: người dùng chỉ tải file JS của addon mình chọn.
- **Chạy trực tiếp trên IP thiết bị**: mọi lệnh `fetch()` và phát video đều chạy bằng mạng của điện thoại/TV (tránh bị chặn IP datacenter như Cloudflare Workers / Vercel).
- **Sửa code nóng, không cần deploy server hay build lại APK**: chỉ cần sửa file JS trên GitHub rồi bấm **Cập nhật** ngay trong **Kho Trình cắm GitHub** của app.
- **Tích hợp sẵn với Local Proxy của Aio-Stream**: hỗ trợ lọc chất lượng HLS `#aio_quality=4k`/`1080`, bóc lớp ảnh giả mạo PNG/JPEG/GIF/WEBP trên segment MPEG-TS và fMP4 (`#EXT-X-MAP`), gửi kèm `Referer` / `Origin` / `Cookie`, giải mã `hf-xor-256`, hoặc cắt prefix byte.

---

## 2. Cấu trúc kho
```text
NothingP-Addons/
├── README.md
├── repo.json           # Danh sách các addon hiển thị trong app
└── addons/
    └── fiml4k.js       # Mã nguồn từng addon chuẩn Stremio Local JS
```

---

## 3. Hướng dẫn tạo & thêm addon mới

### Bước 1: Tạo file JS trong thư mục `addons/`
Ví dụ tạo `addons/myaddon.js` theo mẫu tối giản dưới đây:

```javascript
/**
 * Addon mẫu cho Kho Trình Cắm GitHub của Aio-Stream
 * Lưu ý: dùng ES2020 thuần + fetch(), không dùng require()/Buffer của Node.js.
 */

const manifest = {
  // ID duy nhất cho từng addon (app dùng làm đường dẫn /js-addon/<id>/)
  id: "community.myaddon.local",
  version: "1.0.0",
  name: "Nothing-P • Nguồn Mới",
  description: "Mô tả ngắn gọn về nguồn phim",
  resources: [
    "catalog",
    { name: "meta", types: ["movie", "series"], idPrefixes: ["myaddon"] },
    { name: "stream", types: ["movie", "series"], idPrefixes: ["myaddon", "tmdb", "imdb", "tt"] }
  ],
  types: ["movie", "series"],
  catalogs: [
    {
      type: "movie",
      id: "myaddon_movies",
      name: "Phim Lẻ Mới",
      extra: [
        { name: "search", isRequired: false },
        { name: "skip", isRequired: false }
      ]
    },
    {
      type: "series",
      id: "myaddon_series",
      name: "Phim Bộ Mới",
      extra: [
        { name: "search", isRequired: false },
        { name: "skip", isRequired: false }
      ]
    }
  ]
};

// 1. Trả về danh sách phim cho Trang chủ / Tìm kiếm (/catalog/...)
async function handleCatalog({ type, id, catalogId, extra, env }) {
  const search = String((extra && extra.search) || "").trim();
  const skip = Math.max(0, parseInt((extra && extra.skip) || "0", 10) || 0);

  // Ví dụ gọi API nguồn phim trực tiếp từ máy người dùng:
  // const resp = await fetch("https://example.com/api/list?search=" + encodeURIComponent(search));
  // const data = await resp.json();

  return {
    metas: [
      {
        id: "myaddon:ten-phim-slug",
        type: type === "series" ? "series" : "movie",
        name: "Tên Phim Tiếng Việt",
        poster: "https://example.com/poster.jpg",
        posterShape: "poster",
        background: "https://example.com/backdrop.jpg",
        description: "Nội dung phim...",
        releaseInfo: "2025",
        genres: ["Hành Động"]
      }
    ]
  };
}

// 2. Trả về chi tiết phim & danh sách tập (/meta/...)
async function handleMeta({ type, id, env }) {
  const slug = String(id || "").replace(/^myaddon:/, "");
  const meta = {
    id: "myaddon:" + slug,
    type: type === "series" ? "series" : "movie",
    name: "Tên Phim",
    poster: "https://example.com/poster.jpg",
    background: "https://example.com/backdrop.jpg",
    description: "Nội dung...",
    releaseInfo: "2025",
    genres: ["Hành Động"]
  };

  if (type === "series") {
    meta.videos = [
      {
        id: "myaddon:" + slug + ":1:1",
        title: "Tập 1",
        season: 1,
        episode: 1,
        overview: ""
      }
    ];
  }

  return { meta };
}

// 3. Trả về danh sách luồng phát (/stream/...)
async function handleStream({ type, id, env }) {
  // Có thể tận dụng env.tmdbPrimaryKey & env.tmdbFallbackKey do Aio-Stream truyền sẵn
  // khi id bắt đầu bằng "tmdb:..." hoặc "tt..." / "imdb:...".
  return {
    streams: [
      {
        name: "Nothing-P • Nguồn Mới\n[1080p FHD]",
        title: "🎬 Tên Phim\n📺 1080p Full HD\n⚡ CDN (Local Proxy)",
        url: "https://cdn.example.com/master.m3u8#aio_quality=1080",
        type: "hls",
        behaviorHints: {
          notWebReady: false,
          bingeGroup: "myaddon-" + String(id),
          localProxy: {
            enabled: true,
            mode: "hls-rewrite",
            autoUnwrapTs: true,
            headers: {
              Referer: "https://example.com/",
              Origin: "https://example.com"
            }
          }
        }
      }
    ]
  };
}

module.exports = {
  manifest,
  handleCatalog,
  handleMeta,
  handleStream
};
```

> Lưu ý: Có thể tham khảo bản triển khai thực tế hoàn chỉnh tại [addons/fiml4k.js](addons/fiml4k.js).

---

### Bước 2: Khai báo vào `repo.json`
Mở [repo.json](repo.json) và thêm một phần tử mới vào mảng `"addons"`:

```json
{
  "id": "nothingp-github-addons",
  "name": "Nothing-P • Kho Trình cắm GitHub",
  "description": "Các nguồn phim Stremio chạy cục bộ trên thiết bị qua Local Proxy",
  "addons": [
    {
      "id": "community.fiml4k.local",
      "name": "Nothing-P • Fiml4K",
      "version": "1.0.3",
      "description": "Phim 4K & Phim Bộ Vietsub (tải từ GitHub, chạy bằng IP máy qua Local Proxy)",
      "types": ["movie", "series"],
      "entry": "addons/fiml4k.js",
      "icon": "https://fiml4k.fun/favicon.ico"
    },
    {
      "id": "community.myaddon.local",
      "name": "Nothing-P • Nguồn Mới",
      "version": "1.0.0",
      "description": "Mô tả ngắn gọn về addon mới",
      "types": ["movie", "series"],
      "entry": "addons/myaddon.js"
    }
  ]
}
```

- Trường `id` trong `repo.json` **phải khớp** với `manifest.id` trong file JS và chỉ nên chứa chữ cái, số, `.`, `_`, `-`.
- Trường `entry` có thể là đường dẫn tương đối (`addons/myaddon.js`) hoặc link URL đầy đủ (`https://raw.githubusercontent.com/...`).

---

## 4. Tham chiếu API & Môi trường QuickJS trong Aio-Stream

### Tham số đầu vào cho các hàm xử lý
App gọi từng hàm với một object duy nhất (`req`) gồm:
- **`handleCatalog(req)`**: `{ action: "catalog", type, id, catalogId, extra, env }`
  - `extra`: chứa các tham số Stremio như `extra.search`, `extra.skip`, v.v.
- **`handleMeta(req)`**: `{ action: "meta", type, id, env }`
- **`handleStream(req)`**: `{ action: "stream", type, id, env }`
- **`env`** (Aio-Stream tự truyền vào):
  - `env.addonId`: ID của addon đang chạy
  - `env.addonVersion`: phiên bản hiện tại trong metadata đã lưu
  - `env.scriptUrl`: URL gốc đã tải script
  - `env.tmdbPrimaryKey` & `env.tmdbFallbackKey`: API key TMDB cộng đồng để phân giải `tmdb:` / `tt...`

> Ngoài bộ 3 hàm `handleCatalog` / `handleMeta` / `handleStream`, runner cũng hỗ trợ tên ngắn (`catalog`, `meta`, `stream`) hoặc 1 hàm gộp `onRequest(req)` / `handleRequest(req)`.

### Hàm JS khả dụng & Giới hạn runtime
File JS được thực thi bằng **QuickJS** ngay trên máy Android/TV:
- **Có sẵn**: `fetch(url, options)` (chạy qua OkHttp bằng IP thiết bị, trả `ok`, `status`, `statusText`, `url`, `headers.get(name)`, `text()`, `json()`, `arrayBuffer()`), `URL`, `atob`, `btoa`, `console`, `JSON`, `encodeURIComponent`, `decodeURIComponent`.
- **Không dùng các API của Node.js / Cloudflare**: tránh `require(...)`, `Buffer`, `fs`, `HTMLRewriter`, `crypto.subtle`, `cheerio`, `TextDecoder`, `URLSearchParams`. Nên parse dữ liệu bằng JSON hoặc Regex/hàm JS thuần (như bảng đổi dấu tiếng Việt thuần JS trong [addons/fiml4k.js](addons/fiml4k.js)).
- **Sandbox theo từng request**: mỗi HTTP request tạo một phiên QuickJS mới, vì vậy biến cache khai báo trong file JS không tự lưu sang request tiếp theo.
- **Giới hạn an toàn**: tối đa **25 giây** cho mỗi lần gọi hàm và tối đa **4 MB** cho một phản hồi `fetch()`.

---

## 5. Hướng dẫn cấu hình `behaviorHints.localProxy` cho Stream

Khi trả về `streams`, gắn thêm `behaviorHints.localProxy` để **Aio-Stream** tự xử lý ngay trên máy khi cần:

| Nhu cầu | Cấu hình `localProxy` | Ghi chú |
|---|---|---|
| **HLS thường hoặc HLS ngụy trang PNG/JPEG/WEBP** | `{ enabled: true, mode: "hls-rewrite", autoUnwrapTs: true, headers: { Referer: "..." } }` | Tự rewrite playlist, hỗ trợ fMP4 `#EXT-X-MAP`, bóc prefix ảnh giả mạo. Thêm `#aio_quality=4k` / `1080` / `720` cuối URL master để lọc đúng 1 độ phân giải. |
| **DASH (`.mpd`) cần giữ headers** | `{ enabled: true, mode: "dash-rewrite", headers: { Referer: "..." } }` | Rewrite `<BaseURL>` và giữ header qua redirect. |
| **MP4/MKV chỉ cần giữ `Referer`/`Cookie`** | `{ enabled: true, mode: "http-headers", headers: { Referer: "..." } }` | Chuyển tiếp header an toàn (hữu ích cho trình phát ngoài hoặc URL bị chặn hotlink). |
| **Bỏ N byte rác đầu file MP4** | `{ enabled: true, mode: "prefix-skip", skipBytes: 64, contentType: "video/mp4" }` | Bỏ `skipBytes` byte đầu an toàn với mọi `Range`. |
| **File mã hóa XOR-256** | `{ enabled: true, mode: "hf-xor-256", autoKey: true }` | Tự phát hiện độ dài header/khóa XOR-256 trên máy. |

Nếu link phát là CDN trực tiếp sạch hoàn toàn (không cần header đặc biệt, không ngụy trang), không cần gắn `localProxy` (hoặc đặt `{ enabled: false }`).

---

## 6. Kiểm tra trước khi push & cập nhật trong app

1. **Test nhanh cú pháp và logic trên máy (Node.js 18+):**
   ```bash
   node -e '
     const addon = require("./addons/myaddon.js");
     console.log("Manifest:", addon.manifest.id, addon.manifest.version);
   '
   ```
2. **Push lên GitHub** (`main`), sau đó trong app **Aio-Stream**:
   - Vào **Cài đặt → Tiện ích → Kho Trình cắm GitHub (Trên máy)**.
   - Giữ link mặc định `https://github.com/anpham14121993-cloud/NothingP-Addons` (hoặc dán repo GitHub khác / link raw `.js` trực tiếp).
   - Bấm **Tải kho** → bấm **Tải & Cài** (hoặc **Cập nhật** nếu đã cài trước đó).
   - *Lưu ý*: `raw.githubusercontent.com` đôi khi giữ cache CDN tối đa ~5 phút ngay sau khi vừa commit; tăng số `version` trong `manifest` + `repo.json` giúp dễ nhận biết qua badge **`Đã cài v...`** trong app khi bản mới đã lên CDN.
