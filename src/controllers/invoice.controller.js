const Invoice = require('../models/Invoice');
const ModelItem = require('../models/Model');
const Counter = require('../models/Counter');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { CURRENCY_BY_TYPE, getUnitPrice, getBonus } = require('../utils/pricing');
const { resolveCategory } = require('./model.controller');

function serializeInvoice(doc, models = []) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const byId = new Map(models.map((model) => [String(model._id), model]));
  obj.id = String(obj._id);
  obj.paid = Boolean(obj.isPaid);
  obj.models = (obj.items || []).map((item) => {
    const model = byId.get(String(item.model));
    return {
      id: String(item.model), name: item.modelName, type: item.category,
      status: ({ new: 'New', similar1: 'Similar1', similar2: 'Similar2', modular: 'Modular' })[item.status] || item.status,
      milestone: model?.milestone ?? 0, deadline: model?.deadline || 'OK', staff: model?.staff || '',
      clientPaid: Boolean(model?.payment?.customerPaid), freelancerPaid: Boolean(model?.payment?.freelancerPaid),
      price: item.unitPrice, bonus: item.bonus,
    };
  });
  obj.createdAt = obj.createdAt ? new Date(obj.createdAt).toISOString().slice(0, 10) : obj.createdAt;
  return obj;
}

async function serializeWithModels(doc) {
  const ids = (doc.items || []).map((item) => item.model);
  const models = await ModelItem.find({ _id: { $in: ids } });
  return serializeInvoice(doc, models);
}

async function resolveInvoiceModels(modelIds, models) {
  if (Array.isArray(modelIds) && modelIds.length) return modelIds;
  if (!Array.isArray(models) || !models.length) return modelIds;
  const ids = [];
  for (const model of models) {
    let existing = await ModelItem.findOne({ name: String(model.name || '').trim() }).collation({ locale: 'en', strength: 2 });
    if (!existing) {
      const category = await resolveCategory(model.category, model.type);
      const status = String(model.status || '').toLowerCase().replace(/\s+/g, '');
      existing = await ModelItem.create({
        name: model.name, category, status,
        milestone: model.milestone, deadline: model.deadline || 'OK', staff: model.staff,
        hasBonus: model.hasBonus ?? (status === 'new' && (model.deadline || 'OK') === 'OK'),
        payment: { customerPaid: Boolean(model.clientPaid), freelancerPaid: Boolean(model.freelancerPaid) },
      });
    }
    ids.push(String(existing._id));
  }
  return ids;
}

// Dựng danh sách dòng hóa đơn từ bảng giá: customer -> USD, freelancer -> VND
async function buildItems(type, modelIds, excludeInvoiceId) {
  if (!Array.isArray(modelIds) || modelIds.length === 0) throw new AppError('modelIds phải là mảng không rỗng');
  const uniqueIds = [...new Set(modelIds.map(String))];
  if (uniqueIds.length !== modelIds.length) throw new AppError('modelIds bị trùng');

  const models = await ModelItem.find({ _id: { $in: uniqueIds } }).populate('category');
  if (models.length !== uniqueIds.length) throw new AppError('Có model không tồn tại', 404);

  // A model may be used once in a customer invoice and once in a freelancer
  // invoice, but never in two invoices of the same type.
  const existingInvoiceFilter = {
    type,
    'items.model': { $in: uniqueIds },
  };
  if (excludeInvoiceId) existingInvoiceFilter._id = { $ne: excludeInvoiceId };
  const existingInvoice = await Invoice.findOne(existingInvoiceFilter).select('invoiceNumber');
  if (existingInvoice) {
    throw new AppError(`Model đã nằm trong hóa đơn ${type === 'customer' ? 'khách hàng' : 'freelancer'} ${existingInvoice.invoiceNumber}`, 409);
  }

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
  const { type, from, to, invoiceNumber } = req.body;
  if (!CURRENCY_BY_TYPE[type]) throw new AppError('type phải là "customer" hoặc "freelancer"');

  const modelIds = await resolveInvoiceModels(req.body.modelIds, req.body.models);
  const built = await buildItems(type, modelIds);
  const doc = await Invoice.create({
    invoiceNumber: invoiceNumber || (await nextInvoiceNumber(type)),
    type,
    from,
    to,
    ...built,
  });
  res.status(201).json(await serializeWithModels(doc));
});

// PUT /api/invoices/:id updates party details and/or replaces invoice models.
exports.update = asyncHandler(async (req, res) => {
  const doc = await Invoice.findById(req.params.id);
  if (!doc) throw new AppError('Không tìm thấy hóa đơn', 404);
  if (doc.isPaid) throw new AppError('Không thể sửa hóa đơn đã thanh toán', 409);
  if (req.body.from !== undefined) doc.from = req.body.from;
  if (req.body.to !== undefined) doc.to = req.body.to;
  if (req.body.models !== undefined || req.body.modelIds !== undefined) {
    const ids = await resolveInvoiceModels(req.body.modelIds, req.body.models);
    doc.set(await buildItems(doc.type, ids, doc._id));
  }
  await doc.save();
  res.json(await serializeWithModels(doc));
});

// GET /api/invoices?type=customer&isPaid=false&page=1&limit=20
exports.list = asyncHandler(async (req, res) => {
  const { type, isPaid } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const filter = {};
  if (type) filter.type = type;
  if (isPaid === 'true' || isPaid === 'false') filter.isPaid = isPaid === 'true';

  const [docs, total] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Invoice.countDocuments(filter),
  ]);
  res.json({ page, limit, total, totalPages: Math.ceil(total / limit), data: await Promise.all(docs.map(serializeWithModels)) });
});

exports.get = asyncHandler(async (req, res) => {
  const doc = await Invoice.findById(req.params.id);
  if (!doc) throw new AppError('Không tìm thấy hóa đơn', 404);
  res.json(await serializeWithModels(doc));
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
  res.json(await serializeWithModels(doc));
});

// POST /api/invoices/:id/recalculate — cập nhật lại giá theo bảng giá hiện tại (chỉ khi chưa thanh toán)
exports.recalculate = asyncHandler(async (req, res) => {
  const doc = await Invoice.findById(req.params.id);
  if (!doc) throw new AppError('Không tìm thấy hóa đơn', 404);
  if (doc.isPaid) throw new AppError('Hóa đơn đã thanh toán, không thể tính lại', 409);
  const built = await buildItems(doc.type, doc.items.map((i) => i.model), doc._id);
  doc.set(built);
  await doc.save();
  res.json(await serializeWithModels(doc));
});

exports.remove = asyncHandler(async (req, res) => {
  const doc = await Invoice.findById(req.params.id);
  if (!doc) throw new AppError('Không tìm thấy hóa đơn', 404);
  if (doc.isPaid) throw new AppError('Không thể xóa hóa đơn đã thanh toán', 409);
  await doc.deleteOne();
  res.status(204).end();
});
