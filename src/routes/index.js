const router = require('express').Router();
const pl = require('../controllers/priceList.controller');
const md = require('../controllers/model.controller');
const inv = require('../controllers/invoice.controller');

// Bảng giá (loại model)
router.route('/price-lists').get(pl.list).post(pl.create);
router.route('/price-lists/:id').get(pl.get).put(pl.update).delete(pl.remove);

// Model — /search phải khai báo trước /:id
router.get('/models/search', md.search);
router.post('/models', md.create);
router.route('/models/:id').get(md.get).put(md.update).delete(md.remove);
router.patch('/models/:id/payment', md.updatePayment);

// Hóa đơn
router.route('/invoices').get(inv.list).post(inv.create);
router.route('/invoices/:id').get(inv.get).delete(inv.remove);
router.patch('/invoices/:id/pay', inv.setPaid);
router.post('/invoices/:id/recalculate', inv.recalculate);

module.exports = router;
