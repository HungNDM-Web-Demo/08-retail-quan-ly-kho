# Kịch bản demo — Quản lý Kho

> Dùng khi trình bày cho chủ doanh nghiệp thương mại, nhà phân phối có 1–3 kho, hoặc trưởng kho. Thời lượng 12–15 phút. Đi theo một ngày của kho: nhận hàng nhà cung cấp, giao hàng cho đại lý, bổ sung hàng giữa hai kho, kiểm kê cuối tháng, đối chiếu xuất nhập tồn.

---

## 1. Chuẩn bị trước buổi demo

- [ ] Mở sẵn link demo, thử "Đăng nhập nhanh" cả 3 vai trò
- [ ] Đặt lại dữ liệu demo (thanh công cụ demo → Đặt lại dữ liệu) để có số liệu 90 ngày tính tới hôm nay, có sẵn phiếu chờ duyệt và hàng dưới tối thiểu
- [ ] Đổi tên doanh nghiệp, logo, màu theo thương hiệu khách (Cài đặt → Thương hiệu) nếu đã biết
- [ ] Mở thêm một tab ở kích thước tablet (800×1280) để chiếu màn đếm kiểm kê của thủ kho
- [ ] In sẵn hoặc mở trên điện thoại tờ mã vạch mẫu: mã thùng Sting, thùng dầu Neptune, thùng nước mắm Nam Ngư (giá trị ở `05-KICH-BAN-KIEM-THU.md` §1)
- [ ] Ghi nhớ 3 kho mẫu: `KTONG` Kho tổng Bình Tân, `KTD` Kho Thủ Đức, `KBH` Kho Biên Hòa

| Link | Ghi chú |
| :--- | :--- |
| FE | `http://localhost:3108` hoặc link online |
| Swagger | `https://localhost:7108/swagger` (khi khách hỏi về tích hợp kế toán, bán hàng) |

| Tài khoản | Vai trò | Dùng để cho xem |
| :--- | :--- | :--- |
| `admin` | Quản trị viên | Phân quyền, gán kho cho thủ kho, thương hiệu |
| `quanly` | Quản lý kho | Tổng quan, duyệt phiếu, duyệt kiểm kê, thẻ kho, báo cáo xuất nhập tồn |
| `nhanvien` | Thủ kho (phụ trách `KTONG`, `KTD`) | Lập phiếu nhập, xuất, chuyển; nhận hàng; đếm kiểm kê trên tablet |

Mật khẩu: giá trị `DEMO_PASSWORD` trong `.env`, hoặc bấm "Đăng nhập nhanh".

---

## 2. Câu chuyện demo

> Mở đầu: "Anh/chị hình dung sáng nay kho tổng vừa có xe hàng của nhà cung cấp tới, chiều phải giao cho đại lý, và cuối tháng phải kiểm kê. Em đi đúng một ngày đó."

| # | Vai trò | Thao tác | Điểm cần nhấn mạnh |
| :---: | :--- | :--- | :--- |
| 1 | Quản lý kho | Đăng nhập, mở Tổng quan | Thấy ngay giá trị tồn từng kho, bao nhiêu phiếu đang chờ mình duyệt, hàng nào đang trên xe, kho nào sắp thiếu hàng |
| 2 | Thủ kho | Đổi sang Thủ kho; lập phiếu nhập `KTONG` từ nhà cung cấp Minh Phát: quét mã thùng Sting, nhập 100 thùng giá 180.000 ₫; quét thùng dầu Neptune, 50 thùng giá 600.000 ₫; nhập chi phí xe 1.200.000 ₫; gửi duyệt | Quét mã thùng là ra đúng hàng, đúng đơn vị; chi phí xe tự chia vào từng mặt hàng; gửi duyệt rồi tồn mới tăng, không ai tự ý cộng kho |
| 3 | Quản lý kho | Đổi sang Quản lý, mở Phiếu chờ duyệt, xem phiếu: chi phí xe chia 450.000 ₫ cho Sting, 750.000 ₫ cho dầu; bấm Duyệt; in phiếu nhập kho mẫu 01-VT | Giá vốn bình quân tự tính lại theo từng kho, đã gồm chi phí xe; phiếu in đúng mẫu kế toán quen dùng |
| 4 | Thủ kho | Lập phiếu xuất bán 30 thùng OMO cho Đại lý Tạp hóa Thanh Hương, gửi duyệt; lập tiếp phiếu 25 thùng cho đại lý khác thì bị chặn: chỉ còn 80 túi khả dụng | Hàng đã nằm trên phiếu chờ duyệt thì được giữ chỗ, không bán trùng một thùng hàng cho hai khách |
| 5 | Quản lý kho | Từ chối phiếu 30 thùng với lý do "Đại lý chỉ đặt 20 thùng"; đổi sang Thủ kho sửa thành 20 thùng, gửi lại; đổi lại Quản lý duyệt | Mọi lần từ chối đều có lý do; người lập không tự duyệt phiếu của mình |
| 6 | Thủ kho | Mở Tồn kho → Cảnh báo: Kho Thủ Đức chỉ còn 90 chai Sting, dưới mức 120; hệ thống đề xuất 26 thùng; bấm "Tạo phiếu chuyển" từ Kho tổng, gửi duyệt | Không cần nhớ kho nào thiếu gì; một bấm là có phiếu chuyển đúng số lượng, nguyên thùng |
| 7 | Quản lý kho | Duyệt phiếu chuyển; Tổng quan hiện 1 phiếu "Đang chuyển" và giá trị hàng trên xe | Biết hàng đang nằm trên xe bao nhiêu tiền; xe đi quá 3 ngày chưa nhận thì gắn nhãn Trễ |
| 8 | Thủ kho | Ở kho Thủ Đức, xác nhận nhận hàng: thực nhận 622 chai, 2 chai bể | Hao hụt trên đường tự ghi nhận đúng giá trị, không lẫn vào lệch kho |
| 9 | Thủ kho | Chuyển sang tab tablet; tạo phiếu kiểm kê Kho Thủ Đức, nhóm Dầu ăn, gia vị; đếm: quét mã thùng, gõ số chai lẻ; màn đếm không hiện số trên sổ; gửi duyệt | Kiểm kê mù, người đếm không "đếm theo sổ"; chỉ khóa nhóm hàng đang đếm, phần còn lại của kho vẫn xuất nhập bình thường |
| 10 | Quản lý kho | Mở phiếu kiểm kê: thiếu 3 chai dầu (−156.000 ₫), thừa 30 chai nước mắm (+990.000 ₫) kèm nguyên nhân; duyệt; in biên bản kiểm kê mẫu 05-VT | Chênh lệch lớn bắt buộc có nguyên nhân; duyệt xong tồn tự khớp thực tế, có biên bản ký |
| 11 | Quản lý kho | Mở Thẻ kho Sting tại Kho tổng: tồn đầu ngày, phiếu nhập sáng nay, phiếu chuyển chiều nay, tồn cuối; bấm số phiếu để mở phiếu | Hỏi "thùng hàng đi đâu" là có câu trả lời ngay, từng phiếu, từng người duyệt |
| 12 | Quản lý kho | Mở Báo cáo xuất nhập tồn tháng này theo kho, bấm vào số xuất để xem chi tiết; chuyển sang tab Chậm luân chuyển | Có ngay số liệu gửi kế toán cuối tháng; biết hàng nào nằm kho quá 60, 90 ngày đang chôn vốn |

> Nếu khách hỏi phân quyền: đổi sang Quản trị viên, bỏ gán Kho Thủ Đức của thủ kho, đổi sang Thủ kho để thấy kho đó biến mất khỏi mọi màn hình.
>
> Kết: "Toàn bộ dữ liệu anh/chị vừa thấy là dữ liệu mẫu. Bản triển khai sẽ nhập danh mục hàng và tồn đầu kỳ của doanh nghiệp từ file Excel, dùng máy quét hoặc máy PDA thủ kho đang có."

---

## 3. Câu hỏi khách hay hỏi

| Câu hỏi | Trả lời gợi ý |
| :--- | :--- |
| Giá vốn tính theo phương pháp nào? Có FIFO không? | Demo tính bình quân gia quyền sau mỗi lần nhập, riêng từng kho, đã gồm chi phí vận chuyển. Bản triển khai cấu hình được nhập trước xuất trước hoặc bình quân cuối kỳ theo chế độ kế toán doanh nghiệp đang áp dụng. |
| Có quản lý theo lô, hạn sử dụng không? | Demo chưa có. Bản triển khai thêm lô, hạn dùng, gợi ý xuất lô hết hạn trước, cảnh báo cận hạn. |
| Có quản lý vị trí kệ, ô trong kho không? | Demo quản lý đến mức kho. Bản triển khai thêm vị trí kệ, gợi ý vị trí lấy hàng. |
| Dùng máy quét hoặc máy PDA được không? | Máy quét USB, Bluetooth dùng được ngay vì chạy như bàn phím. Máy PDA Android có trình duyệt dùng màn đếm và lập phiếu trên tablet. Trong demo em gõ tay mã vạch. |
| Có kết nối phần mềm kế toán (MISA, Fast…) không? | Demo chưa kết nối, chỉ giả lập. Bản triển khai xuất dữ liệu phiếu nhập, xuất theo mẫu nhập liệu của phần mềm kế toán, hoặc nối API nếu phần mềm hỗ trợ. |
| Bán hàng ở cửa hàng có tự trừ kho không? | Demo kho chưa nối bán hàng. Có demo POS bán lẻ riêng; bản triển khai nối hai bên để đơn bán tự sinh phiếu xuất. |
| Kiểm kê có phải dừng cả kho không? | Không. Chỉ khóa nhóm hàng đang đếm tại kho đó; các nhóm khác vẫn nhập xuất bình thường. |
| Phiếu đã duyệt mà sai thì sửa thế nào? | Không sửa trực tiếp để giữ dấu vết. Quản lý tạo phiếu ngược bằng một nút, duyệt xong rồi lập lại phiếu đúng. |
| Thủ kho có xem được giá vốn không? | Không. Thủ kho chỉ thấy số lượng và chỉ thấy kho mình phụ trách. Giá vốn, giá trị tồn chỉ quản lý thấy. |
| Mất mạng khi đang kiểm kê thì sao? | Bản demo cần mạng. Bản triển khai có thể cho đếm offline trên tablet rồi đồng bộ, cần khảo sát thêm. |

---

## 4. Sau buổi demo

- [ ] Ghi lại yêu cầu khách nêu thêm vào `01-TONG-QUAN-NGHIEP-VU.md`
- [ ] Ghi lại số kho, số mặt hàng, số thủ kho, phần mềm kế toán và phương pháp tính giá vốn khách đang dùng
- [ ] Hỏi khách có cần quản lý lô, hạn sử dụng, vị trí kệ, số serial không
- [ ] Xin file danh mục hàng và tồn đầu kỳ mẫu để ước lượng công nhập liệu
- [ ] Gửi link demo và tài khoản `nhanvien`, `quanly` cho khách tự trải nghiệm (nếu đồng ý)
