const PriceList = require('../models/PriceList');
const ModelItem = require('../models/Model');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const pick = (b) => ({ name: b.name, new: b.new, similar1: b.similar1, similar2: b.similar2, modular: b.modular, bonus: b.bonus });

exports.create = asyncHandler(async (req, res) => {
  const doc = await PriceList.create(pick(req.body));
  res.status(201).json(doc);
});

exports.list = asyncHandler(async (req, res) => {
  res.json(await PriceList.find().sort({ name: 1 }));
});

exports.get = asyncHandler(async (req, res) => {
  const doc = await PriceList.findById(req.params.id);
  if (!doc) throw new AppError('Không tìm thấy loại model', 404);
  res.json(doc);
});

exports.update = asyncHandler(async (req, res) => {
  const doc = await PriceList.findById(req.params.id);
  if (!doc) throw new AppError('Không tìm thấy loại model', 404);
  const data = Object.fromEntries(Object.entries(pick(req.body)).filter(([, v]) => v !== undefined));
  doc.set(data);
  await doc.save();
  res.json(doc);
});

exports.remove = asyncHandler(async (req, res) => {
  if (await ModelItem.exists({ category: req.params.id })) {
    throw new AppError('Không thể xóa: còn model thuộc loại này', 409);
  }
  const doc = await PriceList.findByIdAndDelete(req.params.id);
  if (!doc) throw new AppError('Không tìm thấy loại model', 404);
  res.status(204).end();
});
