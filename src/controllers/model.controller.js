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

exports.create = asyncHandler(async (req, res) => {
  const { name, category, status, hasBonus } = req.body;
  await assertCategory(category);
  const doc = await ModelItem.create({ name, category, status, hasBonus });
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
  const { name, category, status, hasBonus } = req.body;
  if (category !== undefined) await assertCategory(category);
  doc.set(Object.fromEntries(Object.entries({ name, category, status, hasBonus }).filter(([, v]) => v !== undefined)));
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
 *                       &customerPaid=false&freelancerPaid=false&page=1&limit=20&sort=name
 * - q: tìm theo tên (chứa chuỗi, không phân biệt hoa/thường); bỏ trống để liệt kê tất cả
 */
exports.search = asyncHandler(async (req, res) => {
  const { q, category, status, hasBonus, customerPaid, freelancerPaid, sort = 'name' } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

  const filter = {};
  if (q && q.trim()) filter.name = { $regex: escapeRegex(q.trim()), $options: 'i' };
  if (category) filter.category = category;
  if (status) {
    if (!STATUSES.includes(status)) throw new AppError(`status phải thuộc: ${STATUSES.join(', ')}`);
    filter.status = status;
  }
  if (toBool(hasBonus) !== undefined) filter.hasBonus = toBool(hasBonus);
  if (toBool(customerPaid) !== undefined) filter['payment.customerPaid'] = toBool(customerPaid);
  if (toBool(freelancerPaid) !== undefined) filter['payment.freelancerPaid'] = toBool(freelancerPaid);

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
