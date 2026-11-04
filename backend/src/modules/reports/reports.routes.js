'use strict';

const express = require('express');
const { z } = require('zod');
const { authenticate, requireAdmin } = require('../../auth');
const service = require('./reports.service');

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата у форматі РРРР-ММ-ДД');

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/downtime', async (req, res) => {
  res.json(await service.downtime(date.parse(req.query.from), date.parse(req.query.to)));
});

module.exports = { router };
