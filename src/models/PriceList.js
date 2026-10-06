const mongoose = require('mongoose');

// Mỗi mức giá có cả USD (giá khách hàng) và VND (giá freelancer)
const priceSchema = new mongoose.Schema(
  {
    usd: { type: Number, required: [true, 'Thiếu giá USD'], min: 0 },
    vnd: { type: Number, required: [true, 'Thiếu giá VND'], min: 0 },
  },
  { _id: false }
);

const priceListSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Thiếu tên loại model'], trim: true }, // VGA, Mainboard, Case, Fan...
    new: { type: priceSchema, required: true },
    similar1: { type: priceSchema, required: true },
    similar2: { type: priceSchema, required: true },
    modular: { type: priceSchema, required: true },
    bonus: { type: priceSchema, required: true },
  },
  { timestamps: true }
);

// Tên loại không phân biệt hoa/thường
priceListSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = mongoose.model('PriceList', priceListSchema);
