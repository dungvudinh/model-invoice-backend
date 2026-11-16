# Model Invoice API

API này phục vụ các luồng của ứng dụng quản lý thanh toán linh kiện PC: bảng giá
khách hàng/freelancer, tra cứu model, tạo hóa đơn và cập nhật trạng thái thanh toán.
Frontend hiện vẫn dùng Redux/mock data; để chuyển sang dữ liệu thật, frontend cần gọi
các endpoint dưới đây thay cho reducer mock.

## Endpoint chính

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| `GET`, `POST` | `/api/price-lists` | Liệt kê/tạo loại linh kiện và giá USD/VND |
| `GET`, `PUT`, `DELETE` | `/api/price-lists/:id` | Đọc/sửa/xóa bảng giá |
| `GET` | `/api/models/search?q=&status=&customerPaid=&freelancerPaid=` | Tra cứu model có phân trang |
| `POST` | `/api/models` | Tạo model (`type`, `status`, `milestone`, `deadline`, `staff`) |
| `GET`, `PUT`, `DELETE` | `/api/models/:id` | Đọc/sửa/xóa model |
| `PATCH` | `/api/models/:id/payment` | Cập nhật cờ thanh toán model |
| `GET`, `POST` | `/api/invoices` | Liệt kê/tạo hóa đơn khách hàng hoặc freelancer |
| `GET`, `PUT`, `DELETE` | `/api/invoices/:id` | Đọc/sửa/xóa hóa đơn chưa thanh toán |
| `PATCH` | `/api/invoices/:id/pay` | Đánh dấu hóa đơn đã/chưa thanh toán và đồng bộ model |
| `POST` | `/api/invoices/:id/recalculate` | Tính lại tổng tiền theo bảng giá mới |

Model chấp nhận `status` là `New`, `Similar1`, `Similar2`, `Modular` hoặc dạng chữ
thường. `type` là tên bảng giá đã tạo. Bonus mặc định áp dụng cho model trạng thái
New có deadline `OK`; có thể truyền `hasBonus` để chỉ định rõ.

Hóa đơn nhận `type: "customer"` (USD) hoặc `type: "freelancer"` (VND), cùng
`from`, `to` và một trong hai trường `models` hoặc `modelIds`. `models` dùng trực tiếp
cấu trúc form frontend; backend lưu model trước khi tạo hóa đơn. API response giữ
các trường chuẩn như `items`, `isPaid` và bổ sung alias frontend `models`, `paid`, `id`.

```bash
npm install
cp .env.example .env
npm run dev
```

## Ví dụ

```bash
# 1. Tạo loại model + bảng giá
curl -X POST localhost:3000/api/price-lists -H 'Content-Type: application/json' -d '{
  "name": "VGA",
  "new":      {"usd": 50, "vnd": 800000},
  "similar1": {"usd": 35, "vnd": 560000},
  "similar2": {"usd": 25, "vnd": 400000},
  "modular":  {"usd": 15, "vnd": 240000},
  "bonus":    {"usd": 5,  "vnd": 80000}
}'

# 2. Tạo model
curl -X POST localhost:3000/api/models -H 'Content-Type: application/json' \
  -d '{"name":"RTX 4090 Founders","category":"<priceListId>","status":"new","hasBonus":true}'

# 3. Tra cứu
curl 'localhost:3000/api/models/search?q=rtx&status=new&customerPaid=false'

# 4. Hóa đơn khách hàng (USD) / freelancer (VND)
curl -X POST localhost:3000/api/invoices -H 'Content-Type: application/json' -d '{
  "type": "customer",
  "from": {"name":"Công ty A","email":"a@x.com","address":"Hà Nội"},
  "to":   {"name":"Khách B","email":"b@y.com","address":"USA"},
  "modelIds": ["<modelId>"]
}'
```
