'use strict';

const express = require('express');
const { z } = require('zod');
const { authenticate, requireAdmin } = require('../../auth');
const service = require('./tickets.service');

const createSchema = z.object({
  equipmentId: z.coerce.number().int().positive('Оберіть пристрій'),
  symptomId: z.coerce.number().int().positive('Оберіть, що сталося'),
  description: z.string().trim().max(2000).optional(),
});
const reasonSchema = z.string().trim().min(1, 'Вкажіть причину відхилення');

const router = express.Router();
router.use(authenticate);

router.post('/', async (req, res) => {
  const ticketId = await service.createTicket(req.user, createSchema.parse(req.body));
  res.status(201).json({ ticket_id: ticketId });
});

router.get('/my', async (req, res) => {
  res.json(await service.listMine(req.user.userId));
});

router.get('/', requireAdmin, async (req, res) => {
  res.json(await service.listAll());
});

router.post('/:ticketId/reject', requireAdmin, async (req, res) => {
  const ticketId = Number(req.params.ticketId);
  await service.rejectTicket(ticketId, reasonSchema.parse(req.body.reason ?? ''));
  res.json({ ticket_id: ticketId });
});

module.exports = { router };
