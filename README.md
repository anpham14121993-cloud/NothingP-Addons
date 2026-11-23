# Nothing-P • Kho Trình Cắm GitHub (Aio-Stream)

Kho lưu trữ các tiện ích Stremio viết bằng JavaScript thuần, được **Aio-Stream** tải online từ GitHub về máy khi bạn bấm **Cài đặt / Cập nhật** trong **Cài đặt → Tiện ích → Kho Trình cắm GitHub**.

## Ưu điểm
- Không nhúng cứng code nguồn phim vào file APK **Aio-Stream**.
- Chạy trực tiếp trên thiết bị bằng mạng của người dùng (tránh bị chặn IP datacenter như Cloudflare/Vercel).
- Khi `fiml4k.fun` thay đổi domain hoặc cấu trúc API, chỉ cần sửa file JS trong thư mục `addons/` trên GitHub và bấm **Cập nhật** trong app — không cần build lại APK.

## Cấu trúc chuẩn
- `repo.json`: danh sách các addon hiển thị trong **Kho Trình cắm GitHub**.
- `addons/*.js`: mỗi file xuất ra `manifest`, `handleCatalog`, `handleMeta`, `handleStream` (chuẩn ES2020 + `fetch`, chạy được trên cả QuickJS trong Aio-Stream và Node.js).
