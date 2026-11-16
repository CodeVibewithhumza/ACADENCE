export type UserRole = 'ADMIN' | 'COORDINATOR' | 'FACULTY' | 'STUDENT';

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

export interface SystemSettings {
  institution_name: string;
  academic_session: string;
  nep_framework: string;
  working_days_per_week: number;
  periods_per_day: number;
  teaching_practice_weeks: number;
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

