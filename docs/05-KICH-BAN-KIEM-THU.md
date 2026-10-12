# Kịch bản kiểm thử nghiệm thu — Quản lý Kho

> Test case theo use case trong `03-USE-CASE.md`. Phần nền (đăng nhập, phân quyền, đặt lại dữ liệu) dùng TC-SYS-01 đến TC-SYS-10 trong `ZDOCS/03-KIEN-TRUC/USE-CASE-NEN.md` §8.

---

## 1. Cách chạy

| Mục | Nội dung |
| :--- | :--- |
| Môi trường | Chạy cả hai chế độ: dữ liệu mẫu (`mock`) và BE thật (`api`) |
| Dữ liệu | Đặt lại dữ liệu demo trước mỗi test case, trừ khi cột "Các bước" ghi "Sau TC-xx" |
| Tài khoản | Theo cột "Vai trò", dùng "Đăng nhập nhanh": Quản lý `quanly`, Thủ kho `nhanvien`, Quản trị viên `admin` |
| Thiết bị | Test case kiểm kê vai trò Thủ kho chạy ở cửa sổ 800×1280; mã vạch gõ bằng bàn phím rồi Enter thay máy quét |
| Đạt | Kết quả thực tế khớp toàn bộ cột "Kết quả mong đợi" |

**Dữ liệu mẫu dùng trong test**

| Kho | Tên | Thủ kho phụ trách |
| :--- | :--- | :--- |
| `KTONG` | Kho tổng Bình Tân | `nhanvien` |
| `KTD` | Kho Thủ Đức | `nhanvien` |
| `KBH` | Kho Biên Hòa | `thukho.bh` (tài khoản mẫu, không có nút đăng nhập nhanh) |

Nhà cung cấp: `NCC001` Công ty TNHH Thương mại Minh Phát; `NCC002` Công ty CP Phân phối Sài Gòn Xanh.

| Mặt hàng | Nhóm | Đơn vị, mã vạch | Tồn, giá vốn, ngưỡng theo kho |
| :--- | :--- | :--- | :--- |
| `STING-330` Nước tăng lực Sting dâu chai 330ml | Đồ uống | Chai `8934588100011`; Thùng 24 `18934588100018` | `KTONG` 2.400 chai, 7.200 ₫, tối thiểu 600, tối đa 4.800; `KTD` 90 chai, 7.300 ₫, tối thiểu 120, tối đa 720; `KBH` 360 chai, 7.250 ₫ |
| `NEP-1L` Dầu ăn Neptune Light 1L | Dầu ăn, gia vị | Chai `8934588200014`; Thùng 12 `18934588200011` | `KTONG` 600 chai, 52.000 ₫; `KTD` 240 chai, 52.000 ₫ |
| `NAMNGU-750` Nước mắm Nam Ngư 750ml | Dầu ăn, gia vị | Chai `8934588300011`; Thùng 12 `18934588300018` | `KTD` 120 chai, 33.000 ₫ |
| `OMO-MT37` Nước giặt OMO Matic cửa trước 3,7kg | Hóa mỹ phẩm | Túi `8934588400017`; Thùng 4 `18934588400014` | `KTONG` 200 túi, 189.000 ₫, tối thiểu 80, tối đa 400 |
| `SUNLIGHT-36` Nước rửa chén Sunlight chanh can 3,6kg | Hóa mỹ phẩm | Can `8934588500010`; Thùng 4 `18934588500017` | `KBH` 48 can, 85.000 ₫; lần xuất gần nhất 75 ngày trước |

Tại `KTD`, nhóm Dầu ăn, gia vị chỉ có 2 mặt hàng còn tồn: Neptune và Nam Ngư. Giá trị tồn trong dữ liệu mẫu bằng đúng tồn × giá vốn.

---

## 2. Test case

### 2.1. Danh mục

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-01 | UC-01 | Thêm mặt hàng có đơn vị quy đổi và ngưỡng tồn | Quản lý | 1. Hàng hóa → Thêm mặt hàng 2. Mã `ONGTHO-380`, tên "Sữa đặc Ông Thọ đỏ lon 380g", nhóm Sữa, đơn vị Lon, mã vạch `8934588600017` 3. Thêm đơn vị Thùng 48, hệ số 48, mã `18934588600014` 4. Ngưỡng `KTONG`: tối thiểu 480, tối đa 2.400 5. Lưu 6. Phiếu nhập → Tạo, quét `18934588600014` | Mặt hàng có tồn 0 ở 3 kho; bước 6 thêm dòng "Sữa đặc Ông Thọ đỏ lon 380g – Thùng 48" |
| TC-02 | UC-01 | Trùng mã hàng, trùng mã vạch | Quản lý | 1. Thêm mặt hàng mã `STING-330` 2. Thêm mặt hàng mã mới với mã vạch `18934588100018` | Bước 1 báo lỗi tại ô mã hàng; bước 2 báo lỗi tại ô mã vạch, nêu "Nước tăng lực Sting dâu chai 330ml – Thùng 24" |
| TC-03 | UC-01 | Ngưỡng tồn sai, đổi hệ số đã dùng | Quản lý | 1. Sửa Sting, ngưỡng `KTD` tối thiểu 720, tối đa 720, lưu 2. Sửa hệ số Thùng 24 của Sting thành 20 | Bước 1 báo "Tồn tối thiểu phải nhỏ hơn tồn tối đa"; bước 2 ô hệ số bị khóa, chú thích "Đơn vị đã có chứng từ" |
| TC-04 | UC-02 | Thêm kho, gán thủ kho | Quản lý, Thủ kho | 1. Kho → Thêm kho `KQ7` "Kho Quận 7" 2. Gán thủ kho `nhanvien`, lưu 3. Đổi sang Thủ kho, Phiếu nhập → Tạo, mở ô chọn kho | Ô chọn kho có `KTONG`, `KTD`, `KQ7`; không có `KBH` |
| TC-05 | UC-02 | Ngừng kho còn tồn | Quản lý | 1. Mở `KBH`, bật "Ngừng hoạt động", lưu | Từ chối, nêu số mặt hàng còn tồn tại `KBH`; kho vẫn hoạt động |
| TC-06 | UC-02 | Thủ kho chỉ thấy kho được gán | Thủ kho | 1. Tồn kho, mở bộ lọc kho 2. Gõ URL thẻ kho của Sting kèm bộ lọc kho `KBH` | Bộ lọc chỉ có `KTONG`, `KTD`; bước 2 bỏ bộ lọc `KBH`, không hiện số liệu của `KBH` |

### 2.2. Phiếu nhập

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-07 | UC-03 | Lập và gửi duyệt phiếu nhập | Thủ kho | 1. Phiếu nhập → Tạo: kho `KTONG`, loại Mua hàng, `NCC001`, số hóa đơn `0001234`, ngày hôm nay 2. Quét `18934588100018` 3. Sửa số lượng 100, đơn giá 180.000 ₫ 4. Gửi duyệt | Dòng Sting đơn vị Thùng 24, thành tiền 18.000.000 ₫; phiếu mã `PN{yyMMdd}{nnn}` trạng thái Chờ duyệt; tồn Sting `KTONG` vẫn 2.400 chai |
| TC-08 | UC-03 | Phân bổ chi phí mua hàng vào giá vốn | Thủ kho, Quản lý | 1. Phiếu nhập `KTONG`, `NCC001`: Sting 100 Thùng 24 × 180.000 ₫; Neptune 50 Thùng 12 × 600.000 ₫; chi phí mua hàng 1.200.000 ₫ 2. Gửi duyệt 3. Đổi sang Quản lý, duyệt | Bước 1: chi phí phân bổ Sting 450.000 ₫, Neptune 750.000 ₫; giá trị nhập kho 18.450.000 ₫ và 30.750.000 ₫. Sau duyệt: Sting `KTONG` tồn 4.800, giá vốn 7.444 ₫ = (17.280.000 + 18.450.000) ÷ 4.800 làm tròn; Neptune `KTONG` tồn 1.200, giá vốn 51.625 ₫ = (31.200.000 + 30.750.000) ÷ 1.200 |
| TC-09 | UC-03 | Dữ liệu phiếu không hợp lệ | Thủ kho | 1. Phiếu Mua hàng bỏ trống nhà cung cấp, gửi 2. Chọn `NCC001`, dòng số lượng 0, gửi 3. Số lượng 1, ngày chứng từ là ngày mai, gửi | Mỗi bước báo lỗi tại đúng ô; phiếu vẫn Nháp |
| TC-10 | UC-03 | Rút lại phiếu chờ duyệt để sửa | Thủ kho | 1. Sau TC-07, mở phiếu, bấm "Rút lại" 2. Sửa đơn giá 178.000 ₫, gửi lại | Bước 1 phiếu về Nháp, sửa được; bước 2 Chờ duyệt, thành tiền 17.800.000 ₫ |

### 2.3. Phiếu xuất

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-11 | UC-04 | Tồn khả dụng chặn gửi duyệt | Thủ kho | 1. PX A: `KTONG`, Xuất bán, người nhận "Đại lý Tạp hóa Thanh Hương", OMO 30 Thùng 4, gửi duyệt 2. PX B: `KTONG`, Xuất bán, OMO 25 Thùng 4, gửi duyệt | Bước 1: PX A Chờ duyệt (120 túi). Bước 2: dòng OMO hiện khả dụng 80 túi ("20 thùng"), tô đỏ; gửi bị chặn "Vượt tồn khả dụng 20 túi" |
| TC-12 | UC-04 | Thiếu người nhận, thiếu lý do hủy | Thủ kho | 1. Phiếu Xuất bán không nhập người nhận, gửi 2. Phiếu Xuất hủy không nhập lý do, gửi | Mỗi bước báo lỗi tại ô tương ứng, phiếu vẫn Nháp |

### 2.4. Duyệt phiếu

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-13 | UC-05 | Duyệt phiếu nhập | Quản lý | 1. Sau TC-07, Phiếu chờ duyệt → mở phiếu → Duyệt | Phiếu Đã duyệt; Sting `KTONG` tồn 4.800 ("200 thùng"), giá vốn 7.350 ₫ = (17.280.000 + 18.000.000) ÷ 4.800, giá trị tồn 35.280.000 ₫; thẻ kho có dòng nhập 2.400, tồn sau 4.800 |
| TC-14 | UC-05 | Duyệt phiếu xuất | Quản lý | 1. Sau TC-11 bước 1, duyệt PX A | Phiếu Đã duyệt; OMO `KTONG` tồn 80 túi ("20 thùng"); giá trị xuất 22.680.000 ₫; giá trị tồn còn 15.120.000 ₫; trạng thái Dưới tối thiểu; thẻ kho có dòng xuất 120 |
| TC-15 | UC-05 | Từ chối và gửi lại | Quản lý, Thủ kho | 1. Sau TC-11 bước 1, từ chối PX A với lý do "Sai SL" 2. Nhập lý do "Đại lý chỉ đặt 20 thùng", xác nhận 3. Đổi sang Thủ kho, mở PX A, sửa 20 Thùng 4, gửi lại | Bước 1 báo lý do tối thiểu 10 ký tự; bước 2 PX A Từ chối, khả dụng OMO về 200 túi; bước 3 Tổng quan thủ kho hiện lý do; sau khi gửi lại PX A Chờ duyệt, khả dụng 120 túi |
| TC-16 | UC-05 | Người lập không tự duyệt | Quản lý, Quản trị viên | 1. Quản lý lập phiếu nhập `KTD`, `NCC002`, Nam Ngư 10 Thùng 12 × 390.000 ₫, gửi 2. Mở phiếu ở Phiếu chờ duyệt 3. Đổi sang Quản trị viên, duyệt | Bước 2 nút Duyệt khóa, chú thích "Người duyệt phải khác người lập"; bước 3 duyệt được; Nam Ngư `KTD` tồn 240, giá vốn 32.750 ₫ = (3.960.000 + 3.900.000) ÷ 240 |
| TC-17 | UC-05 | Thủ kho không có quyền duyệt | Thủ kho | 1. Gõ URL `/approvals` 2. Mở phiếu Chờ duyệt do người khác lập ở danh sách phiếu nhập | Bước 1 chuyển tới `/forbidden`; bước 2 không có nút Duyệt, Từ chối |

### 2.5. Chuyển kho

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-18 | UC-06 | Chuyển kho, nhận thiếu | Thủ kho, Quản lý | 1. Phiếu chuyển: `KTONG` → `KTD`, Sting 20 Thùng 24, gửi duyệt 2. Quản lý duyệt 3. Thủ kho mở phiếu, xác nhận nhận 478 chai, hoàn tất | Bước 2: `KTONG` còn 1.920 ("80 thùng"); giá vốn chuyển 7.200 ₫, giá trị chuyển 3.456.000 ₫; phiếu Đang chuyển; `KTD` vẫn 90. Bước 3: `KTD` tồn 568 ("23 thùng 16 chai"), giá vốn 7.216 ₫ = (657.000 + 3.441.600) ÷ 568 làm tròn; hao hụt 2 chai, 14.400 ₫; phiếu Đã nhận |
| TC-19 | UC-06 | Dữ liệu chuyển kho không hợp lệ | Thủ kho | 1. Tạo phiếu chuyển kho đi `KTONG`, kho đến `KTONG` 2. Như TC-18 tới bước 2, rồi nhập thực nhận 500 chai | Bước 1 báo "Kho đến phải khác kho đi"; bước 2 báo "Không vượt số lượng chuyển 480 chai" |

### 2.6. Tra cứu, in, sửa sai

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-20 | UC-07 | Phiếu ngược của phiếu xuất và in phiếu | Quản lý, Quản trị viên | 1. Sau TC-14, mở PX A, bấm "Tạo phiếu ngược" 2. Gửi duyệt; đổi sang Quản trị viên, duyệt 3. Quản lý mở lại PX A, bấm In | Bước 1: phiếu nhập nháp loại "Nhập điều chỉnh", `KTONG`, OMO 120 túi, đơn giá 189.000 ₫, ghi mã PX A. Sau bước 2: OMO tồn 200, giá vốn 189.000 ₫. Bước 3: không còn nút "Tạo phiếu ngược"; bản in theo bố cục 02-VT có dòng "Hai mươi hai triệu sáu trăm tám mươi nghìn đồng" |

### 2.7. Tồn kho, thẻ kho, cảnh báo

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-21 | UC-08 | Tồn thực, chờ xuất, khả dụng | Quản lý | 1. Sau TC-11 bước 1, mở Tồn kho, kho `KTONG`, tìm OMO 2. Bấm số chờ xuất | Tồn thực 200 ("50 thùng"), chờ xuất 120, khả dụng 80, giá vốn 189.000 ₫, giá trị 37.800.000 ₫, trạng thái Dưới tối thiểu; bước 2 thấy PX A |
| TC-22 | UC-08 | Thủ kho không thấy giá trị | Thủ kho | 1. Mở Tồn kho | Không có cột giá vốn, giá trị, dòng tổng giá trị; vẫn thấy tồn thực, chờ xuất, khả dụng, trạng thái |
| TC-23 | UC-09 | Thẻ kho cộng trừ đúng | Thủ kho, Quản lý | 1. Sau TC-13, thủ kho lập phiếu chuyển `KTONG` → `KTD` Sting 20 Thùng 24, quản lý duyệt 2. Quản lý mở Thẻ kho Sting, kho `KTONG`, kỳ Hôm nay | Tồn đầu kỳ 2.400; dòng phiếu nhập +2.400, tồn sau 4.800; dòng phiếu chuyển −480, tồn sau 4.320; tổng nhập 2.400, tổng xuất 480, tồn cuối 4.320 bằng tồn trên màn Tồn kho; dòng phiếu chuyển có đơn giá 7.350 ₫, giá trị 3.528.000 ₫ |
| TC-24 | UC-09 | Thẻ kho 30 ngày của thủ kho | Thủ kho | 1. Thẻ kho OMO, kho `KTONG`, kỳ 30 ngày 2. Bấm một số phiếu bất kỳ | Tồn đầu kỳ + tổng nhập − tổng xuất = tồn cuối kỳ = 200; không có cột đơn giá, giá trị; bước 2 mở đúng phiếu |
| TC-25 | UC-10 | Cảnh báo và đề xuất chuyển kho | Thủ kho | 1. Tồn kho → Cảnh báo, kho `KTD` 2. Ở dòng Sting, bấm "Tạo phiếu chuyển" từ `KTONG` | Sting `KTD` Dưới tối thiểu (khả dụng 90, tối thiểu 120), đề xuất 624 chai (26 thùng); `KTONG` hiện khả dụng 2.400; phiếu chuyển nháp `KTONG` → `KTD`, Sting 26 Thùng 24 |

### 2.8. Kiểm kê

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-26 | UC-11 | Đếm, gửi duyệt, cân bằng | Quản lý, Thủ kho | 1. Quản lý tạo phiếu kiểm kê `KTD`, phạm vi nhóm Dầu ăn, gia vị, người đếm `nhanvien` 2. Thủ kho mở phiếu: quét `18934588200011` 19 lần, nhập thêm 9 chai Neptune; nhập Nam Ngư 150 chai 3. Gửi duyệt 4. Chọn nguyên nhân cho Nam Ngư "Nhập xuất chưa lập phiếu", gửi 5. Quản lý duyệt | Bước 1: phiếu `KK{yyMMdd}{nn}` Đang kiểm, sổ sách Neptune 240, Nam Ngư 120. Bước 2: màn đếm không có cột sổ sách; Neptune 237. Bước 3: Neptune −3, −156.000 ₫, không bắt buộc nguyên nhân; Nam Ngư +30, +990.000 ₫, bắt buộc nguyên nhân (25%); tổng thừa 990.000 ₫, tổng thiếu 156.000 ₫. Bước 5: `KTD` Neptune 237, Nam Ngư 150; giá vốn giữ 52.000 ₫ và 33.000 ₫; thẻ kho có dòng "Điều chỉnh kiểm kê"; phiếu Đã cân bằng |
| TC-27 | UC-11 | Gửi khi còn dòng chưa đếm | Thủ kho | 1. Phiếu kiểm kê như TC-26 bước 1, chỉ đếm Neptune 237 2. Gửi duyệt 3. Bấm "Điền bằng sổ sách cho dòng chưa đếm", gửi | Bước 2 bị chặn, liệt kê Nam Ngư chưa đếm; bước 3 Nam Ngư 120, chênh 0, gửi được |
| TC-28 | UC-11 | Khóa phát sinh chỉ hàng trong phạm vi | Thủ kho, Quản lý | 1. Có phiếu kiểm kê như TC-26 bước 1 (Đang kiểm) 2. Thủ kho lập và gửi PX `KTD` Neptune 2 Thùng 12; lập và gửi PX `KTD` Sting 1 Thùng 24 3. Quản lý duyệt lần lượt hai phiếu | Bước 2 gửi được cả hai; bước 3 PX Neptune bị chặn "Dầu ăn Neptune Light 1L đang kiểm kê tại KTD (KK…)"; PX Sting duyệt được |
| TC-29 | UC-11 | Phiếu kiểm kê thứ hai và hủy phiếu | Quản lý | 1. Sau TC-28, tạo thêm phiếu kiểm kê cho `KTD` 2. Hủy phiếu kiểm kê đang mở 3. Duyệt lại PX Neptune | Bước 1 bị chặn, nêu mã phiếu đang mở; bước 2 phiếu Đã hủy, tồn không đổi; bước 3 duyệt được, Neptune `KTD` còn 216 |
| TC-30 | UC-11 | Trả lại đếm lại | Quản lý, Thủ kho | 1. Sau TC-26 bước 4 (Chờ duyệt), quản lý chọn dòng Nam Ngư, "Trả lại đếm lại" kèm ghi chú 2. Thủ kho sửa Nam Ngư thành 125, gửi 3. Quản lý duyệt | Bước 1: phiếu Đang kiểm, Nam Ngư đánh dấu cần đếm lại, Neptune giữ 237. Bước 2: Nam Ngư +5 (4,2%, +165.000 ₫), không bắt buộc nguyên nhân. Bước 3: Nam Ngư `KTD` 125 |

### 2.9. Tổng quan và báo cáo

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-31 | UC-12 | Tổng quan quản lý cập nhật | Quản lý, Thủ kho | 1. Ghi lại giá trị tồn `KTONG` và số phiếu nhập chờ duyệt 2. Đổi sang Thủ kho, làm TC-07 3. Quay lại Tổng quan 4. Duyệt phiếu đó, quay lại Tổng quan | Sau bước 3: phiếu nhập chờ duyệt tăng 1; sau bước 4: trở về số cũ, giá trị tồn `KTONG` tăng 18.000.000 ₫, cột nhập hôm nay trên biểu đồ tăng 18.000.000 ₫ |
| TC-32 | UC-12 | Tổng quan của thủ kho | Thủ kho | 1. Sau TC-18 bước 2 (phiếu chuyển đã duyệt, chưa nhận), đăng nhập nhanh Thủ kho | "Việc cần làm" có 1 phiếu chuyển chờ nhận tại `KTD`; không có số giá trị nào |
| TC-33 | UC-13 | Xuất nhập tồn theo một kho | Quản lý | 1. Sau TC-23, Báo cáo → Xuất nhập tồn, kho `KTONG`, kỳ Hôm nay | Dòng Sting: tồn đầu 2.400 / 17.280.000 ₫; nhập 2.400 / 18.000.000 ₫; xuất 480 / 3.528.000 ₫; tồn cuối 4.320 / 31.752.000 ₫; khớp thẻ kho và màn Tồn kho |
| TC-34 | UC-13 | Tất cả kho khi có hàng đang chuyển, mở thẻ kho từ báo cáo | Quản lý | 1. Sau TC-18 bước 2 (chưa nhận), Xuất nhập tồn, Tất cả kho, Hôm nay 2. Bấm số xuất của Sting | Sting: tồn đầu 2.850 (2.400 + 90 + 360); nhập 0; xuất 480; tồn cuối 2.370; dòng "Hàng đang chuyển cuối kỳ: 480 chai, 3.456.000 ₫"; bước 2 mở Thẻ kho Sting, Mọi kho, Hôm nay, có dòng phiếu chuyển |
| TC-35 | UC-14 | Hàng chậm luân chuyển | Quản lý | 1. Báo cáo → Chậm luân chuyển, kho `KBH` | Sunlight nằm trong nhóm 60–89 ngày, 75 ngày kể từ lần xuất gần nhất, tồn 48 can, giá trị 4.080.000 ₫ |

---

## 3. Biên bản chạy thử

| Ngày | Người test | Chế độ | Số TC đạt / tổng | Lỗi ghi nhận |
| :--- | :--- | :--- | :---: | :--- |
| | | | | |
