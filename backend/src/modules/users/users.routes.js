'use strict';

const express = require('express');
const { z } = require('zod');
const { authenticate, requireAdmin } = require('../../auth');
const { email, password, fullName } = require('../auth/auth.routes');
const service = require('./users.service');

const role = z.enum(['EMPLOYEE', 'IT_ADMIN']);
const createSchema = z.object({ email, password, fullName, role: role.default('EMPLOYEE') });
const updateSchema = z.object({ fullName: fullName.optional(), role: role.optional(), isActive: z.boolean().optional() });

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/', async (req, res) => {
  res.json(await service.listUsers());
});

router.post('/', async (req, res) => {
  res.status(201).json(await service.createUser(createSchema.parse(req.body)));
});

router.patch('/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  res.json(await service.updateUser(req.user.userId, userId, updateSchema.parse(req.body)));
});

module.exports = { router };
