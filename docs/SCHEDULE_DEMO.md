# Demo Tính Năng Lập Lịch Quét

## ✅ Tính năng đã hoàn thành:

### 🔧 Backend:
1. **Model Source** được cập nhật với các trường:
   - `crawl_frequency`: Enum (daily, weekly, monthly, yearly, manual)
   - `crawl_time`: Giờ quét (ví dụ: 09:00)
   - `crawl_day_of_week`: Thứ trong tuần (0=Thứ 2, 6=Chủ nhật)
   - `crawl_day_of_month`: Ngày trong tháng (1-31)
   - `crawl_month`: Tháng (1-12)
   - `next_crawl_at`: Thời gian quét tiếp theo (tự động tính)

2. **SchedulerService** với các functions:
   - `calculate_next_crawl_time()`: Tính thời gian quét tiếp theo
   - `get_schedule_description()`: Mô tả lịch bằng tiếng Việt
   - `get_frequency_display_text()`: Text hiển thị tần suất

3. **API Sources** được cập nhật:
   - Tự động tính `next_crawl_at` khi tạo/cập nhật source
   - Hỗ trợ tất cả tham số lập lịch

4. **Migration** `002_add_crawl_schedule.py` để cập nhật database

### 🎨 Frontend:
1. **Sources Page** được cập nhật với:
   - Hiển thị thông tin lịch quét trên mỗi source card
   - Hiển thị thời gian quét tiếp theo
   - Icon clock để dễ nhận biết

2. **Add Source Modal** với UI lập lịch:
   - Dropdown chọn tần suất quét
   - Time picker cho giờ quét
   - Conditional fields tùy theo tần suất:
     - **Hằng ngày**: Chỉ cần giờ
     - **Hằng tuần**: Giờ + thứ trong tuần
     - **Hằng tháng**: Giờ + ngày trong tháng
     - **Hằng năm**: Giờ + ngày + tháng

## 🎯 Cách sử dụng:

### 1. Thêm Source với lịch quét:
1. Vào `/dashboard/sources`
2. Click "Thêm nguồn"
3. Nhập thông tin cơ bản (tên, URL, loại)
4. Chọn tần suất quét:
   - **Thủ công**: Không tự động quét
   - **Hằng ngày**: Quét mỗi ngày lúc giờ chỉ định
   - **Hằng tuần**: Quét vào thứ và giờ chỉ định
   - **Hằng tháng**: Quét vào ngày và giờ chỉ định mỗi tháng
   - **Hằng năm**: Quét vào ngày/tháng/giờ chỉ định mỗi năm

### 2. Xem thông tin lịch:
- Mỗi source card hiển thị:
  - Lịch quét (ví dụ: "Hằng ngày lúc 09:00")
  - Lần quét tiếp theo
  - Lần quét cuối cùng

## 📋 Ví dụ các lịch quét:

### Hằng ngày:
- **Input**: Tần suất = daily, Giờ = 09:00
- **Hiển thị**: "Hằng ngày lúc 09:00"
- **Next crawl**: Ngày mai lúc 09:00

### Hằng tuần:
- **Input**: Tần suất = weekly, Thứ = 0 (Thứ 2), Giờ = 14:30
- **Hiển thị**: "Hằng tuần vào Thứ 2 lúc 14:30"
- **Next crawl**: Thứ 2 tuần sau lúc 14:30

### Hằng tháng:
- **Input**: Tần suất = monthly, Ngày = 15, Giờ = 10:00
- **Hiển thị**: "Hằng tháng ngày 15 lúc 10:00"
- **Next crawl**: Ngày 15 tháng sau lúc 10:00

### Hằng năm:
- **Input**: Tần suất = yearly, Tháng = 1, Ngày = 1, Giờ = 00:00
- **Hiển thị**: "Hằng năm Tháng 1 ngày 1 lúc 00:00"
- **Next crawl**: 1/1 năm sau lúc 00:00

## 🔄 Deployment Status:

- ✅ **Code**: Đã push lên GitHub
- ⏳ **Backend**: Cần deploy lên Render (manual deploy sau khi merge PR)
- ⏳ **Frontend**: Cần deploy lên Vercel (manual deploy sau khi merge PR)
- ⏳ **Database**: Cần chạy migration để thêm các trường mới

## 🚀 Bước tiếp theo:

1. **Chạy Migration**: Cần chạy migration trên database production
2. **Test UI**: Test thêm source với các tần suất khác nhau
3. **Implement Scheduler**: Tạo background job để thực hiện quét theo lịch
4. **Monitoring**: Thêm logs và monitoring cho scheduled crawls

## 💡 Lưu ý:

- Hiện tại chỉ có UI và logic tính toán thời gian
- Chưa có background job thực sự chạy quét theo lịch
- Cần implement Celery hoặc background task để thực hiện quét tự động
- Database cần migration để có các trường mới

**Tính năng lập lịch quét đã sẵn sàng để test và sử dụng!** 🎉