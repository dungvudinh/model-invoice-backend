const mongoose = require('mongoose');
const { STATUSES } = require('../utils/pricing');

const modelSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Thiếu tên model'], trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'PriceList', required: [true, 'Thiếu loại model'] },
    status: { type: String, enum: STATUSES, required: [true, 'Thiếu trạng thái'] },
    // Có áp dụng Bonus hay không; số tiền Bonus lấy từ bảng giá theo loại
    hasBonus: { type: Boolean, default: false },
    // Tình trạng thanh toán: khách hàng đã trả công ty chưa, công ty đã trả freelancer chưa
    payment: {
      customerPaid: { type: Boolean, default: false },
      freelancerPaid: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// Tên model không được trùng (không phân biệt hoa/thường)
modelSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
modelSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Model', modelSchema);
