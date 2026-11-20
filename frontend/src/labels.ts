import type { Rule } from './types';

export const STATUSES: Record<string, string> = {
  NEW: 'нова',
  SCHEDULED: 'запланована',
  IN_PROGRESS: 'виконується',
  DONE: 'виконана',
  REJECTED: 'відхилена',
  CANCELLED: 'скасована',
};

export const RULES: Record<Rule, { name: string; description: string }> = {
  WSPT: {
    name: 'Правило Сміта (WSPT)',
    description: 'Чим більше людей чекає і чим коротша робота, тим раніше вона в плані.',
  },
  DYNAMIC_RATIO: {
    name: 'Динамічний пріоритет',
    description: 'Спершу те, що зачіпає більше людей; що довше робота чекає, то вище вона в черзі.',
  },
  EDD: {
    name: 'Правило Джексона (EDD)',
    description: 'Першою йде робота, яку потрібно виконати найраніше.',
  },
  FIFO: { name: 'FIFO', description: 'У тому порядку, в якому надійшли заявки.' },
};

//підписи-питання і пояснення до довідника «Налаштування»; ключі в БД не змінюються
export const SETTINGS: Record<string, { question: string; hint?: string; unit?: string }> = {
  ALGORITHM: {
    question: 'Що система ставить у план першим',
    hint: 'Те саме правило можна змінити на сторінці «Сьогодні».',
  },
  PLAN_HORIZON_DAYS: {
    question: 'За скільки днів наперед система заносить планові роботи до списку',
    hint: 'Працівники отримують сповіщення заздалегідь. До плану на день робота потрапить лише тоді, коли настане її строк.',
    unit: 'днів',
  },
  REMINDER_DAYS: {
    question: 'За скільки днів до планової роботи нагадати працівникам',
    unit: 'днів',
  },
  NORM_MIN_SAMPLES: {
    question: 'Після скількох виконаних робіт система рахує тривалість за фактичним часом',
    hint: 'До того тривалість береться з нормативу.',
    unit: 'робіт',
  },
};

export const RECOMMENDED_RULE: Rule = 'WSPT';

export const DAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя'];
