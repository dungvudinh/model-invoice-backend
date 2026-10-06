const mongoose = require('mongoose');

const partySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ'] },
    address: { type: String, required: true, trim: true },
  },
  { _id: false }
);

// Ảnh chụp giá tại thời điểm lập hóa đơn, lấy đúng từ bảng giá (USD hoặc VND tùy loại hóa đơn)
const itemSchema = new mongoose.Schema(
  {
    model: { type: mongoose.Schema.Types.ObjectId, ref: 'Model', required: true },
    modelName: String,
    category: String,
    status: String,
    unitPrice: { type: Number, required: true },
    bonus: { type: Number, default: 0 },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    type: { type: String, enum: ['customer', 'freelancer'], required: true },
    currency: { type: String, enum: ['USD', 'VND'], required: true },
    isPaid: { type: Boolean, default: false },
    paidAt: Date,
    from: { type: partySchema, required: true },
    to: { type: partySchema, required: true },
    items: { type: [itemSchema], validate: [(v) => v.length > 0, 'Hóa đơn cần ít nhất 1 model'] },
    subtotal: { type: Number, required: true },
    bonusTotal: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { timestamps: true } // createdAt = ngày tạo
);

invoiceSchema.index({ type: 1, isPaid: 1 });
invoiceSchema.index({ 'items.model': 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
