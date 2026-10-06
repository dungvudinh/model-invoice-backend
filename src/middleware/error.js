const notFound = (req, res) => res.status(404).json({ message: 'Route not found' });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ message: `Giá trị của "${field}" đã tồn tại`, keyValue: err.keyValue });
  }
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', details });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Giá trị không hợp lệ cho "${err.path}"` });
  }
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ message: err.message || 'Internal Server Error' });
};

module.exports = { notFound, errorHandler };
