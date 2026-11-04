'use strict';

const express = require('express');
const { authenticate } = require('../../auth');
const service = require('./notifications.service');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  res.json(await service.listMine(req.user.userId));
});

router.post('/:notificationId/read', async (req, res) => {
  await service.markRead(Number(req.params.notificationId), req.user.userId);
  res.status(204).end();
});

module.exports = { router };
