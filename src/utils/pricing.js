const AppError = require('./AppError');

const STATUSES = ['new', 'similar1', 'similar2', 'modular', 'modularsimilar'];

// Hóa đơn khách hàng dùng USD (bảng giá khách hàng), hóa đơn freelancer dùng VND (bảng giá freelancer)
const CURRENCY_BY_TYPE = { customer: 'usd', freelancer: 'vnd' };

function getUnitPrice(priceList, status, currency) {
  const tierKey = status === 'modularsimilar' ? 'modularSimilar' : status;
  const tier = priceList && priceList[tierKey];
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
  // Keep the API convenient for the existing frontend contract.
  obj.id = String(obj._id);
  obj.type = pl?.name || obj.type;
  obj.status = ({ new: 'New', similar1: 'Similar1', similar2: 'Similar2', modular: 'Modular', modularsimilar: 'Modular Similar' })[obj.status] || obj.status;
  obj.clientPaid = Boolean(obj.payment?.customerPaid);
  obj.freelancerPaid = Boolean(obj.payment?.freelancerPaid);
  return obj;
}

module.exports = { STATUSES, CURRENCY_BY_TYPE, getUnitPrice, getBonus, serializeModel };
