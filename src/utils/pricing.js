const AppError = require('./AppError');

const STATUSES = ['new', 'similar1', 'similar2', 'modular'];

// Hóa đơn khách hàng dùng USD (bảng giá khách hàng), hóa đơn freelancer dùng VND (bảng giá freelancer)
const CURRENCY_BY_TYPE = { customer: 'usd', freelancer: 'vnd' };

function getUnitPrice(priceList, status, currency) {
  const tier = priceList && priceList[status];
  if (!tier || typeof tier[currency] !== 'number') {
    throw new AppError(`Bảng giá "${priceList && priceList.name}" chưa có giá ${status}/${currency}`, 422);
  }
  return tier[currency];
}

function getBonus(priceList, hasBonus, currency) {
  if (!hasBonus) return 0;
  return priceList.bonus[currency];
}

// Gắn giá tính từ bảng giá vào model (cần populate category)
function serializeModel(doc) {
  const obj = doc.toObject();
  const pl = doc.category;
  if (pl && pl.name) {
    obj.customerPrice = {
      currency: 'USD',
      unit: getUnitPrice(pl, doc.status, 'usd'),
      bonus: getBonus(pl, doc.hasBonus, 'usd'),
    };
    obj.freelancerPrice = {
      currency: 'VND',
      unit: getUnitPrice(pl, doc.status, 'vnd'),
      bonus: getBonus(pl, doc.hasBonus, 'vnd'),
    };
  }
  return obj;
}

module.exports = { STATUSES, CURRENCY_BY_TYPE, getUnitPrice, getBonus, serializeModel };
