'use strict';

const express = require('express');
const cors = require('cors');
const config = require('./config');
const { httpError, errorHandler } = require('./errors');

const app = express();

app.use(cors({ origin: config.clientUrl }));
app.use(express.json());

app.use('/api/auth', require('./modules/auth/auth.routes').router);
app.use('/api/users', require('./modules/users/users.routes').router);
app.use('/api/equipment', require('./modules/equipment/equipment.routes').router);
app.use('/api/references', require('./modules/references/references.routes').router);
app.use('/api/tickets', require('./modules/tickets/tickets.routes').router);
app.use('/api/plan', require('./modules/plan/plan.routes').router);
app.use('/api/tasks', require('./modules/tasks/tasks.routes').router);
app.use('/api/notifications', require('./modules/notifications/notifications.routes').router);
app.use('/api/reports', require('./modules/reports/reports.routes').router);

app.use((req, res, next) => next(httpError(404, `Маршрут ${req.method} ${req.originalUrl} не існує`)));
app.use(errorHandler);

module.exports = app;
