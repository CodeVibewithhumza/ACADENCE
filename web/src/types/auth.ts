export type UserRole = 'ADMIN' | 'COORDINATOR' | 'FACULTY';

export interface User {
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  status: 'ACTIVE' | 'INACTIVE';
  token?: string;
  created_at?: string;
}

export interface PeriodScheduleItem {
  p: number;
  label: string;
  start_time: string; // e.g. "08:30"
  end_time: string;   // e.g. "09:20"
  is_break?: boolean;
}

export interface SystemSettings {
  institution_name: string;
  academic_session: string;
  nep_framework: string;
  working_days_per_week: number;
  periods_per_day: number;
  teaching_practice_weeks: number;
  campus_start_time?: string;
  campus_end_time?: string;
  default_period_duration_minutes?: number;
  break_duration_minutes?: number;
  lunch_break_after?: number;
  periods_schedule?: PeriodScheduleItem[];
  supabase_url: string;
  supabase_anon_key: string;
  auto_validate: boolean;
  audit_logging: boolean;
}

export interface AuditLogEntry {
  timestamp: string;
  user_email: string;
  action: string;
  details: string;
}
