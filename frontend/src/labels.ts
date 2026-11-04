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
  WSPT: { name: 'Правило Сміта (WSPT)', description: 'Спочатку те, що зачіпає більше людей і робиться швидко' },
  DYNAMIC_RATIO: {
    name: 'Динамічний пріоритет',
    description: 'Спочатку те, що зачіпає більше людей; що довше робота чекає, то вище вона в черзі',
  },
  EDD: { name: 'Правило Джексона (EDD)', description: 'Спочатку те, що раніше стає потрібним' },
  FIFO: { name: 'FIFO', description: 'У порядку надходження' },
};

export const RECOMMENDED_RULE: Rule = 'WSPT';

export const DAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя'];
