'use strict';

const express = require('express');
const { z } = require('zod');
const { authenticate, requireAdmin } = require('../../auth');
const service = require('./references.service');

const int = z.coerce.number().int();
const FIELD_TYPES = {
  text: z.string().trim().min(1, 'Заповніть усі поля'),
  id: int.positive('Оберіть значення зі списку'),
  optionalId: int.positive().nullable().default(null),
  minutes: int.positive('Кількість хвилин має бути більшою за нуль'),
  days: int.min(0, 'Кількість днів не може бути від’ємною'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата у форматі РРРР-ММ-ДД'),
  workType: z.string().trim().min(1, 'Оберіть вид робіт'),
};

function schemaOf(table) {
  const shape = {};
  for (const [column, type] of Object.entries(table.fields)) shape[column] = FIELD_TYPES[type];
  return z.object(shape);
}

const time = z.string().regex(/^\d{2}:\d{2}/, 'Час у форматі ГГ:ХХ');
const daySchema = z.object({
  day_of_week: int.min(1).max(7),
  start_time: time,
  end_time: time,
  break_start: time.nullable().default(null),
  break_end: time.nullable().default(null),
});

const workTypeSchema = z.object({
  work_type: z.string().trim().regex(/^[A-Z_]+$/, 'Код — великими латинськими літерами, наприклад NETWORK'),
  name: z.string().trim().min(1, 'Введіть назву'),
});

const router = express.Router();
router.use(authenticate);

router.get('/symptoms-for/:equipmentId', async (req, res) => {
  res.json(await service.symptomsFor(int.parse(req.params.equipmentId)));
});

router.get('/equipment-types', async (req, res) => {
  res.json(await service.listEquipmentTypes());
});

router.use(requireAdmin);

router.get('/work-hours', async (req, res) => {
  res.json(await service.listWorkHours());
});

router.put('/work-hours', async (req, res) => {
  res.json(await service.saveWorkHours(z.array(daySchema).parse(req.body)));
});

router.get('/settings', async (req, res) => {
  res.json(await service.listSettings());
});

router.put('/settings/:key', async (req, res) => {
  const value = z.string().trim().min(1, 'Введіть значення').parse(String(req.body.setting_value ?? ''));
  res.json(await service.updateSetting(req.params.key, value));
});

router.get('/work-types', async (req, res) => {
  res.json(await service.listWorkTypes());
});

router.post('/work-types', async (req, res) => {
  res.status(201).json(await service.createWorkType(workTypeSchema.parse(req.body)));
});

router.get('/:name', async (req, res) => {
  res.json(await service.listRows(service.tableOf(req.params.name)));
});

router.post('/:name', async (req, res) => {
  const table = service.tableOf(req.params.name);
  res.status(201).json(await service.createRow(table, schemaOf(table).parse(req.body)));
});

router.put('/:name/:id', async (req, res) => {
  const table = service.tableOf(req.params.name);
  const input = schemaOf(table).parse(req.body);
  res.json(await service.updateRow(table, int.parse(req.params.id), input));
});

router.delete('/:name/:id', async (req, res) => {
  const table = service.tableOf(req.params.name);
  await service.deleteRow(table, int.parse(req.params.id));
  res.status(204).end();
});

module.exports = { router };
