'use strict';

const express = require('express');
const { z } = require('zod');
const { authenticate, requireAdmin } = require('../../auth');
const service = require('./tasks.service');

const correctSchema = z.object({
  workType: z.string().trim().min(1, 'Оберіть вид робіт'),
  peopleCount: z.coerce.number().int().positive('Кількість людей має бути більшою за нуль'),
});
const completeSchema = z.object({
  actualMinutes: z.coerce.number().int().positive('Вкажіть, скільки хвилин тривала робота'),
});

const router = express.Router();
router.use(authenticate, requireAdmin);

router.patch('/:taskId', async (req, res) => {
  const input = correctSchema.parse(req.body);
  res.json(await service.correctTask(Number(req.params.taskId), input));
});

router.post('/:taskId/start', async (req, res) => {
  res.json(await service.startTask(Number(req.params.taskId)));
});

router.post('/:taskId/complete', async (req, res) => {
  const { actualMinutes } = completeSchema.parse(req.body);
  res.json(await service.completeTask(Number(req.params.taskId), actualMinutes));
});

module.exports = { router };
