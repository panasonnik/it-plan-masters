'use strict';

const { ZodError } = require('zod');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

//чотири аргументи — обробник помилок
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(422).json({ error: err.issues[0].message });
  }

  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err.code === '23505') {
    return res.status(409).json({ error: 'Такий запис уже існує' });
  }
  //посилання на відсутній запис
  if (err.code === '23503' && String(err.detail).includes('is not present')) {
    return res.status(422).json({ error: 'Обраного значення немає в довіднику' });
  }
  if (err.code === '23503') {
    return res.status(409).json({ error: 'Запис пов’язаний з іншими даними, тому цю дію виконати не можна' });
  }

  console.error(err);
  return res.status(500).json({ error: 'Внутрішня помилка сервера' });
}

module.exports = { httpError, errorHandler };
