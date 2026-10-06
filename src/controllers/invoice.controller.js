const Invoice = require('../models/Invoice');
const ModelItem = require('../models/Model');
const Counter = require('../models/Counter');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { CURRENCY_BY_TYPE, getUnitPrice, getBonus } = require('../utils/pricing');

// Dựng danh sách dòng hóa đơn từ bảng giá: customer -> USD, freelancer -> VND
async function buildItems(type, modelIds) {
  if (!Array.isArray(modelIds) || modelIds.length === 0) throw new AppError('modelIds phải là mảng không rỗng');
  const uniqueIds = [...new Set(modelIds.map(String))];
  if (uniqueIds.length !== modelIds.length) throw new AppError('modelIds bị trùng');

  const models = await ModelItem.find({ _id: { $in: uniqueIds } }).populate('category');
  if (models.length !== uniqueIds.length) throw new AppError('Có model không tồn tại', 404);
  const byId = new Map(models.map((m) => [String(m._id), m]));

  const cur = CURRENCY_BY_TYPE[type];
  const items = uniqueIds.map((id) => {
    const m = byId.get(id);
    const unitPrice = getUnitPrice(m.category, m.status, cur);
    const bonus = getBonus(m.category, m.hasBonus, cur);
    return { model: m._id, modelName: m.name, category: m.category.name, status: m.status, unitPrice, bonus, total: unitPrice + bonus };
  });

  const subtotal = items.reduce((s, i) => s + i.unitPrice, 0);
  const bonusTotal = items.reduce((s, i) => s + i.bonus, 0);
  return { items, subtotal, bonusTotal, total: subtotal + bonusTotal, currency: cur.toUpperCase() };
}

async function nextInvoiceNumber(type) {
  const seq = await Counter.next(`invoice:${type}`);
  const prefix = type === 'customer' ? 'INV' : 'FRL';
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${ymd}-${String(seq).padStart(4, '0')}`;
}

// POST /api/invoices  { type, from, to, modelIds, invoiceNumber? }
exports.create = asyncHandler(async (req, res) => {
  const { type, from, to, modelIds, invoiceNumber } = req.body;
  if (!CURRENCY_BY_TYPE[type]) throw new AppError('type phải là "customer" hoặc "freelancer"');

  const built = await buildItems(type, modelIds);
  const doc = await Invoice.create({
    invoiceNumber: invoiceNumber || (await nextInvoiceNumber(type)),
    type,
    from,
    to,
    ...built,
  });
  res.status(201).json(doc);
});

// GET /api/invoices?type=customer&isPaid=false&page=1&limit=20
exports.list = asyncHandler(async (req, res) => {
  const { type, isPaid } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const filter = {};
  if (type) filter.type = type;
  if (isPaid === 'true' || isPaid === 'false') filter.isPaid = isPaid === 'true';

  const [data, total] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Invoice.countDocuments(filter),
  ]);
  res.json({ page, limit, total, totalPages: Math.ceil(total / limit), data });
});

exports.get = asyncHandler(async (req, res) => {
  const doc = await Invoice.findById(req.params.id);
  if (!doc) throw new AppError('Không tìm thấy hóa đơn', 404);
  res.json(doc);
});

// PATCH /api/invoices/:id/pay  { isPaid: true|false }
// Đồng bộ tình trạng thanh toán sang các model trong hóa đơn
exports.setPaid = asyncHandler(async (req, res) => {
  const { isPaid } = req.body;
  if (typeof isPaid !== 'boolean') throw new AppError('isPaid phải là boolean');
  const doc = await Invoice.findById(req.params.id);
  if (!doc) throw new AppError('Không tìm thấy hóa đơn', 404);

  doc.isPaid = isPaid;
  doc.paidAt = isPaid ? new Date() : undefined;
  await doc.save();

  const field = doc.type === 'customer' ? 'payment.customerPaid' : 'payment.freelancerPaid';
  await ModelItem.updateMany({ _id: { $in: doc.items.map((i) => i.model) } }, { $set: { [field]: isPaid } });
  res.json(doc);
});

// POST /api/invoices/:id/recalculate — cập nhật lại giá theo bảng giá hiện tại (chỉ khi chưa thanh toán)
exports.recalculate = asyncHandler(async (req, res) => {
  const doc = await Invoice.findById(req.params.id);
  if (!doc) throw new AppError('Không tìm thấy hóa đơn', 404);
  if (doc.isPaid) throw new AppError('Hóa đơn đã thanh toán, không thể tính lại', 409);
  const built = await buildItems(doc.type, doc.items.map((i) => i.model));
  doc.set(built);
  await doc.save();
  res.json(doc);
});

exports.remove = asyncHandler(async (req, res) => {
  const doc = await Invoice.findById(req.params.id);
  if (!doc) throw new AppError('Không tìm thấy hóa đơn', 404);
  if (doc.isPaid) throw new AppError('Không thể xóa hóa đơn đã thanh toán', 409);
  await doc.deleteOne();
  res.status(204).end();
});
