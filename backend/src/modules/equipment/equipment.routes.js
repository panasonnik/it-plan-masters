'use strict';

const express = require('express');
const { z } = require('zod');
const { authenticate, requireAdmin } = require('../../auth');
const service = require('./equipment.service');

const id = z.coerce.number().int().positive();
const baseSchema = z.object({
  equipmentTypeId: id,
  parentEquipmentId: id.nullable().default(null),
  assignedUserId: id.nullable().default(null),
  affectedPeople: z.coerce.number().int().positive('Кількість людей має бути більшою за нуль').nullable().default(null),
  departmentId: id.nullable().default(null),
});
//форма надсилає назву й номер і під час зміни; сервіс перевіряє, що вони не змінилися
const updateSchema = baseSchema.extend({
  inventoryNumber: z.string().trim().optional(),
  name: z.string().trim().optional(),
});
//назву та інвентарний номер задають лише під час створення
const createSchema = baseSchema.extend({
  inventoryNumber: z
    .string()
    .trim()
    .min(1, 'Введіть інвентарний номер')
    .regex(/^[0-9]+$/, 'Інвентарний номер має містити лише цифри'),
  name: z.string().trim().min(1, 'Введіть назву'),
});

const router = express.Router();
router.use(authenticate);

router.get('/my', async (req, res) => {
  res.json(await service.listMine(req.user.userId));
});

router.get('/', requireAdmin, async (req, res) => {
  res.json(await service.listAll());
});

router.post('/', requireAdmin, async (req, res) => {
  const equipmentId = await service.createEquipment(createSchema.parse(req.body));
  res.status(201).json({ equipment_id: equipmentId });
});

router.patch('/:equipmentId', requireAdmin, async (req, res) => {
  const equipmentId = id.parse(req.params.equipmentId);
  await service.updateEquipment(equipmentId, updateSchema.parse(req.body));
  res.json({ equipment_id: equipmentId });
});

router.delete('/:equipmentId', requireAdmin, async (req, res) => {
  await service.deleteEquipment(id.parse(req.params.equipmentId));
  res.status(204).end();
});

router.post('/:equipmentId/consumers', requireAdmin, async (req, res) => {
  await service.addConsumer(id.parse(req.params.equipmentId), id.parse(req.body.userId));
  res.status(201).end();
});

router.delete('/:equipmentId/consumers/:userId', requireAdmin, async (req, res) => {
  await service.removeConsumer(id.parse(req.params.equipmentId), id.parse(req.params.userId));
  res.status(204).end();
});

module.exports = { router };
