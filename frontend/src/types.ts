
export type Role = 'EMPLOYEE' | 'IT_ADMIN';
export type Rule = 'FIFO' | 'EDD' | 'WSPT' | 'DYNAMIC_RATIO';

export interface User {
  user_id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
}

export interface Equipment {
  equipment_id: number;
  inventory_number: string;
  name: string;
  equipment_type_id: number;
  parent_equipment_id: number | null;
  assigned_user_id: number | null;
  tree_path: string;
  affected_people: number | null;
  proposed_people: number;
  type_name: string;
  assigned_user_name: string | null;
  consumer_ids?: number[];
}

export interface HistoryRow {
  status: string;
  comment: string | null;
  changed_at: string;
}

export interface Ticket {
  ticket_id: number;
  status: string;
  description: string | null;
  reject_reason: string | null;
  created_at: string;
  equipment_name: string;
  inventory_number: string;
  symptom_label: string;
  reported_by_name: string;
  work_type: string | null;
  work_type_name: string | null;
  estimated_minutes: number | null;
  people_count: number | null;
  history: HistoryRow[] | null;
}

export interface Work {
  task_id: number;
  source: 'TICKET' | 'PLANNED';
  status: string;
  work_type: string;
  work_type_name: string;
  estimated_minutes: number;
  people_count: number;
  release_at: string;
  due_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  actual_minutes: number | null;
  work_types: { work_type: string; name: string }[];
  ticket_id: number | null;
  equipment_name: string;
  inventory_number: string;
  symptom_label: string | null;
  description: string | null;
  reported_by_name: string | null;
  planned_start_at?: string;
  planned_end_at?: string;
  group_root_equipment_id?: number | null;
  group_root_name?: string | null;
}

export interface TodayPlan {
  rule: Rule;
  current: Work | null;
  next: Work[];
  waiting: Work[];
  done: Work[];
}

export interface Notification {
  notification_id: number;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

export type Row = Record<string, string | number | null>;
