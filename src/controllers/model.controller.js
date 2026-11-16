const ModelItem = require('../models/Model');
const PriceList = require('../models/PriceList');
const Invoice = require('../models/Invoice');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { STATUSES, serializeModel } = require('../utils/pricing');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toBool = (v) => (v === 'true' ? true : v === 'false' ? false : undefined);

async function assertCategory(id) {
  if (!(await PriceList.exists({ _id: id }))) throw new AppError('Loại model không tồn tại', 404);
}

async function resolveCategory(category, type) {
  const value = category || type;
  if (!value) throw new AppError('Thiếu loại model (type/category)');
  if (/^[a-f\d]{24}$/i.test(String(value))) {
    await assertCategory(value);
    return value;
  }
  const list = await PriceList.findOne({ name: String(value).trim() }).collation({ locale: 'en', strength: 2 });
  if (!list) throw new AppError(`Không tìm thấy bảng giá cho loại "${value}"`, 404);
  return list._id;
}

function normalizeStatus(status) {
  const normalized = String(status || '').toLowerCase().replace(/\s+/g, '');
  if (!STATUSES.includes(normalized)) throw new AppError(`status phải thuộc: ${STATUSES.join(', ')}`);
  return normalized;
}

exports.create = asyncHandler(async (req, res) => {
  const { name, category, type, status, hasBonus, milestone, deadline, staff, clientPaid, freelancerPaid } = req.body;
  const resolvedCategory = await resolveCategory(category, type);
  const normalizedStatus = normalizeStatus(status);
  const bonusEligible = normalizedStatus === 'new' && (deadline || 'OK') === 'OK';
  const doc = await ModelItem.create({
    name, category: resolvedCategory, status: normalizedStatus,
    hasBonus: hasBonus ?? bonusEligible, milestone, deadline, staff,
    payment: { customerPaid: clientPaid ?? req.body.payment?.customerPaid ?? false, freelancerPaid: freelancerPaid ?? req.body.payment?.freelancerPaid ?? false },
  });
  await doc.populate('category');
  res.status(201).json(serializeModel(doc));
});

exports.get = asyncHandler(async (req, res) => {
  const doc = await ModelItem.findById(req.params.id).populate('category');
  if (!doc) throw new AppError('Không tìm thấy model', 404);
  res.json(serializeModel(doc));
});

exports.update = asyncHandler(async (req, res) => {
  const doc = await ModelItem.findById(req.params.id);
  if (!doc) throw new AppError('Không tìm thấy model', 404);
  const { name, category, type, status, hasBonus, milestone, deadline, staff, clientPaid, freelancerPaid } = req.body;
  const values = { name, status: status === undefined ? undefined : normalizeStatus(status), hasBonus, milestone, deadline, staff };
  if (category !== undefined || type !== undefined) values.category = await resolveCategory(category, type);
  if (clientPaid !== undefined || freelancerPaid !== undefined) {
    if (clientPaid !== undefined) doc.payment.customerPaid = clientPaid;
    if (freelancerPaid !== undefined) doc.payment.freelancerPaid = freelancerPaid;
  }
  doc.set(Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)));
  await doc.save();
  await doc.populate('category');
  res.json(serializeModel(doc));
});

// PATCH /api/models/:id/payment  { customerPaid?: bool, freelancerPaid?: bool }
exports.updatePayment = asyncHandler(async (req, res) => {
  const doc = await ModelItem.findById(req.params.id);
  if (!doc) throw new AppError('Không tìm thấy model', 404);
  const { customerPaid, freelancerPaid } = req.body;
  if (typeof customerPaid === 'boolean') doc.payment.customerPaid = customerPaid;
  if (typeof freelancerPaid === 'boolean') doc.payment.freelancerPaid = freelancerPaid;
  await doc.save();
  await doc.populate('category');
  res.json(serializeModel(doc));
});

exports.remove = asyncHandler(async (req, res) => {
  if (await Invoice.exists({ 'items.model': req.params.id })) {
    throw new AppError('Không thể xóa: model đã nằm trong hóa đơn', 409);
  }
  const doc = await ModelItem.findByIdAndDelete(req.params.id);
  if (!doc) throw new AppError('Không tìm thấy model', 404);
  res.status(204).end();
});

/**
 * Tra cứu model
 * GET /api/models/search?q=rtx&category=<id>&status=new&hasBonus=true
 *                       &customerPaid=false&freelancerPaid=false&inInvoice=true&page=1&limit=20&sort=name
 * - q: tìm theo tên (chứa chuỗi, không phân biệt hoa/thường); bỏ trống để liệt kê tất cả
 */
exports.search = asyncHandler(async (req, res) => {
  const { q, category, status, hasBonus, customerPaid, freelancerPaid, inInvoice, sort = 'name' } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

  const filter = {};
  if (q && q.trim()) filter.name = { $regex: escapeRegex(q.trim()), $options: 'i' };
  if (category) filter.category = category;
  if (status) filter.status = normalizeStatus(status);
  if (toBool(hasBonus) !== undefined) filter.hasBonus = toBool(hasBonus);
  if (toBool(customerPaid) !== undefined) filter['payment.customerPaid'] = toBool(customerPaid);
  if (toBool(freelancerPaid) !== undefined) filter['payment.freelancerPaid'] = toBool(freelancerPaid);
  if (inInvoice === 'true') filter._id = { $in: await Invoice.distinct('items.model') };

  const sortMap = { name: { name: 1 }, '-name': { name: -1 }, newest: { createdAt: -1 }, oldest: { createdAt: 1 } };

  const [docs, total] = await Promise.all([
    ModelItem.find(filter)
      .populate('category')
      .collation({ locale: 'en', strength: 2 })
      .sort(sortMap[sort] || sortMap.name)
      .skip((page - 1) * limit)
      .limit(limit),
    ModelItem.countDocuments(filter),
  ]);

  res.json({ page, limit, total, totalPages: Math.ceil(total / limit), data: docs.map(serializeModel) });
});

exports.resolveCategory = resolveCategory;
