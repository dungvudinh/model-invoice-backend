const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
