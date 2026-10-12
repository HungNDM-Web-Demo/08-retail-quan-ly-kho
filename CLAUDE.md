# Quản lý Kho

Dự án demo để trình bày cho khách hàng, tạo từ `_template`. Gồm `BE/` (.NET 8, Clean Architecture, 1 DB) và `FE/` (Next.js + shadcn/ui, chạy được bằng dữ liệu mẫu).
Trả lời bằng tiếng Việt.

## Tài liệu

- **Riêng của dự án** nằm trong `docs/` của dự án này. Đọc `docs/01-TONG-QUAN-NGHIEP-VU.md` trước để biết demo cho ai, làm gì.
- **Dùng chung cho mọi dự án** nằm trong `ZDOCS/` ở thư mục kho (cùng cấp với thư mục dự án):
  - `ZDOCS/03-KIEN-TRUC/`: kiến trúc hệ thống, CSDL nền, quy ước API.
  - `ZDOCS/04-QUY-CHUAN-CODE/`: quy chuẩn code BE, FE.
- Không chép tài liệu chung vào `docs/` của dự án. `docs/` chỉ chứa thứ riêng của dự án này.

## Backend (BE)

- Trước khi viết/sửa code BE, **đọc `ZDOCS/04-QUY-CHUAN-CODE/BE-CAU-TRUC-THU-MUC.md`** và làm đúng theo đó (quy tắc vàng §2, checklist CRUD §3, code mẫu §4, migration §5).
- Luồng: Controller → IService → IGenericRepository / IUnitOfWork → AppDbContext. Controller không inject DbContext/repository. API trả DTO, không trả Entity.
- Entity đặt ở `Domain/Entities/{Area}/{Module}/`, bảng `{Area}_{TenSoNhieu}`.
- Chức năng mới: đủ CRUD, mã quyền (BE `Permissions.cs` + `SystemSeeder` + FE `config/permissions.ts`), dữ liệu mẫu trong `DemoDataSeeder`, cập nhật `docs/02-THIET-KE-CSDL.md` và `docs/03-DANH-SACH-API.md`.
- Không commit secret; secret nằm trong `BE/src/API/.env`.

## Frontend (FE)

- Trước khi viết/sửa code FE, **đọc `ZDOCS/04-QUY-CHUAN-CODE/FE-CAU-TRUC-THU-MUC.md`**.
- Mọi dữ liệu đi qua `features/{feature}/services/`; service tự chọn mock hoặc API. Mock trả đúng kiểu như API và khớp seed BE.
- Menu, nút bấm, hành động bọc bằng `usePermissions()`.
- Làm/sửa giao diện: dùng skill `ui-ux-pro-max`. Màu chỉ lấy từ token trong `theme.css`.

## Dữ liệu mẫu

- Tiếng Việt thật, giá VNĐ hợp lý, đủ nhiều để giao diện trông như đang vận hành.
- Ngày tháng tính tương đối so với hôm nay, không ghi cứng.

## Văn bản tiếng Việt

- Viết hoặc chỉnh tài liệu tiếng Việt: dùng các skill `humanizer-vi`, `grammar-checker-vi`, `style-guide-vi`, `translationese-cleaner-vi`.

## Cuối mỗi task

Tóm tắt ngắn: entity, route API, quyền mới, màn hình FE, migration đã/chưa chạy.
