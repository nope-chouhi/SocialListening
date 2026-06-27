# 🎯 Bước Tiếp Theo - Service Catalog Module

## 📋 Tóm Tắt Tình Hình

### ✅ Đã Xong
- Database schema (5 tables)
- Backend API (một phần)
- Frontend UI (100%)
- Service request form
- Import scripts
- Test scripts
- Documentation

### ❌ Vấn Đề
**Backend API đang bị lỗi 500 Internal Server Error**
- Không thể tạo categories mới
- Không thể tạo services mới
- Không thể tạo service requests

**Mục tiêu:**
1. Fix backend errors
2. Import 26 services từ Excel
3. Test service request workflow
4. Tích hợp với mentions/alerts/incidents

**Thay đổi liên quan:**
- `backend/app/schemas/service.py`: Đã cập nhật `ServiceCategoryResponse` để khai báo rõ `name`, `description`, `is_active`, `updated_at` thay vì kế thừa từ `ServiceCategoryBase`, giúp tránh lỗi serialization 500 khi backend trả về danh sách categories.

---

## 🚀 Hành Động Ngay

### Bước 1: Kiểm Tra Backend Logs

1. Đăng nhập Render: https://dashboard.render.com/
2. Chọn service: `social-listening-backend`
3. Click tab **Logs**
4. Tìm error messages khi call API

**Tìm các lỗi về:**
- `psycopg2.errors` - Database errors
- `pydantic.ValidationError` - Validation errors
- `sqlalchemy.exc` - SQLAlchemy errors
- `500 Internal Server Error` - General errors

### Bước 2: Chạy Health Check

```bash
python check_backend_health.py
```

Xem endpoints nào hoạt động, endpoints nào lỗi.

### Bước 3: Fix Backend

**Có thể cần:**

1. **Chạy lại migrations:**
```bash
# Trên Render Shell hoặc local với production DB
cd backend
alembic upgrade head
```

2. **Hoặc dùng admin endpoint:**
```bash
# Chạy script này
python -c "
import requests
token = requests.post('https://social-listening-backend.onrender.com/api/auth/login', 
                      data={'username': 'admin@sociallistening.com', 'password': 'Admin@123456'}).json()['access_token']
headers = {'Authorization': f'Bearer {token}'}
response = requests.post('https://social-listening-backend.onrender.com/api/admin/run-migrations', headers=headers)
print(response.json())
"
```

3. **Fix Pydantic models nếu cần:**
   - Sửa `backend/app/schemas/service.py`
   - Đảm bảo `updated_at` là Optional
   - Thêm json_encoders nếu cần

4. **Redeploy:**
```bash
git add .
git commit -m "fix: service catalog API errors"
git push origin main
```

### Bước 4: Test Lại

```bash
# Test health
python check_backend_health.py

# Test workflow
python test_service_request_workflow.py
```

### Bước 5: Import Services

```bash
# Import 26 services từ Excel
python import_excel_services_v2.py
```

### Bước 6: Test Frontend

1. Mở: https://social-listening-azure.vercel.app/dashboard/services
2. Tab "Danh Mục Dịch Vụ" - nên thấy 31 services
3. Click icon "+" để tạo service request
4. Điền form và submit
5. Tab "Yêu Cầu Dịch Vụ" - nên thấy request vừa tạo

---

## 📚 Documents Tham Khảo

### Hướng Dẫn Chi Tiết
- **`SERVICE_REQUEST_WORKFLOW_GUIDE.md`** - Workflow & troubleshooting
- **`IMPORT_EXCEL_SERVICES_GUIDE.md`** - Import guide
- **`SERVICE_CATALOG_STATUS.md`** - Trạng thái hiện tại

### Scripts Sẵn Sàng
- `check_backend_health.py` - Kiểm tra backend
- `test_service_request_workflow.py` - Test workflow
- `import_excel_services_v2.py` - Import services
- `check_categories.py` - Xem data hiện có

### Data Files
- `data/mhc_parsed_detailed.json` - 26 services parsed
- `data/EXCEL_ANALYSIS_SUMMARY.md` - Analysis report

---

## 🔍 Debug Tips

### Nếu Backend Vẫn Lỗi

1. **Check database trực tiếp:**
```bash
# Connect to Render PostgreSQL
psql <DATABASE_URL>

# Check tables
\dt

# Check enum types
\dT

# Check service_categories
SELECT * FROM service_categories;

# Check services
SELECT id, code, name FROM services;
```

2. **Check logs chi tiết:**
   - Render Dashboard → Logs
   - Tìm stack trace
   - Note down error message

3. **Test với Postman:**
   - Import API collection
   - Test từng endpoint
   - Xem response details

### Nếu Import Fail

1. **Check categories exist:**
```bash
python check_categories.py
```

2. **Create missing categories manually:**
```python
import requests
token = "..."
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Create category
response = requests.post(
    "https://social-listening-backend.onrender.com/api/services/categories",
    headers=headers,
    json={
        "name": "Community Response Planning",
        "description": "Public and private response drafting",
        "is_active": True
    }
)
print(response.status_code, response.text)
```

3. **Import từng service manually nếu cần**

---

## ✅ Checklist

### Phase 1: Fix Backend
- [ ] Check Render logs
- [ ] Identify error cause
- [ ] Fix code/database
- [ ] Redeploy
- [ ] Test endpoints
- [ ] Verify all working

### Phase 2: Import Data
- [ ] Run import script
- [ ] Verify 26 services imported
- [ ] Check prices correct
- [ ] Check descriptions clear
- [ ] Adjust if needed

### Phase 3: Test Workflow
- [ ] Run workflow test script
- [ ] Test create request
- [ ] Test submit
- [ ] Test approve
- [ ] Test complete
- [ ] Verify logs
- [ ] Verify deliverables

### Phase 4: Frontend Testing
- [ ] Test services page
- [ ] Test create request form
- [ ] Test request list
- [ ] Test dashboard metrics
- [ ] Test search/filters
- [ ] Test all buttons

### Phase 5: Integration
- [ ] Add button in mention detail
- [ ] Add button in alerts
- [ ] Add button in incidents
- [ ] Test integration
- [ ] Verify linking works

### Phase 6: Polish
- [ ] Create request detail page
- [ ] Add action modals
- [ ] Add notifications
- [ ] Update documentation
- [ ] Train users

---

## 🎉 Khi Hoàn Thành

Bạn sẽ có:
- ✅ 31 services (5 mẫu + 26 từ Excel)
- ✅ Service request workflow hoàn chỉnh
- ✅ Integration với mentions/alerts/incidents
- ✅ Dashboard metrics
- ✅ Audit logs
- ✅ Compliance tracking

---

## 📞 Cần Giúp?

1. **Backend errors:** Check `SERVICE_REQUEST_WORKFLOW_GUIDE.md`
2. **Import issues:** Check `IMPORT_EXCEL_SERVICES_GUIDE.md`
3. **Status overview:** Check `SERVICE_CATALOG_STATUS.md`
4. **Run scripts:** Check individual script files

---

**Bắt đầu từ:** Bước 1 - Kiểm tra Backend Logs  
**Ưu tiên:** Fix backend API errors (CRITICAL)  
**Timeline:** 1-2 giờ để fix backend, 30 phút để import & test

Good luck! 🚀
