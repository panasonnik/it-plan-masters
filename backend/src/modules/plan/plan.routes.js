'use strict';

const express = require('express');
const { z } = require('zod');
const { authenticate, requireAdmin } = require('../../auth');
const { RULE_CODES } = require('../../scheduling/rules');
const service = require('./plan.service');

const ruleSchema = z.enum(RULE_CODES, { message: 'Невідоме правило' });

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/', async (req, res) => {
  res.json(await service.todayView());
});

router.post('/', async (req, res) => {
  res.json(await service.planNow());
});

router.put('/rule', async (req, res) => {
  res.json(await service.changeRule(ruleSchema.parse(req.body.rule)));
});

module.exports = { router };
