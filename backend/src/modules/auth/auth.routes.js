'use strict';

const express = require('express');
const { z } = require('zod');
const { authenticate } = require('../../auth');
const service = require('./auth.service');

const email = z.string().trim().toLowerCase().email('Некоректна адреса електронної пошти');
const password = z.string().min(8, 'Пароль має містити щонайменше 8 символів');
const fullName = z.string().trim().min(1, 'Введіть ім’я').max(120);

const registerSchema = z.object({ email, password, fullName });
const loginSchema = z.object({ email, password: z.string().min(1, 'Введіть пароль') });

const router = express.Router();

router.post('/register', async (req, res) => {
  res.status(201).json(await service.register(registerSchema.parse(req.body)));
});

router.post('/login', async (req, res) => {
  res.json(await service.login(loginSchema.parse(req.body)));
});

router.get('/me', authenticate, async (req, res) => {
  res.json(await service.currentUser(req.user.userId));
});

module.exports = { router, email, password, fullName };
