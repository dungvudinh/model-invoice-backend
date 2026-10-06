# Model Invoice API

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
