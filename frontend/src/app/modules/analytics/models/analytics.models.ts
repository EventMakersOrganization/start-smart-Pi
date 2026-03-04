// Analytics Models and Interfaces

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface RiskScore {
  _id?: string;
  user: string | any;
  score: number;
  riskLevel: RiskLevel;
  lastUpdated: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Alert {
  _id?: string;
  student: string | any;
  instructor?: string | any;
  message: string;
  severity: AlertSeverity;
  resolved: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
  academic_level?: string;
  risk_level?: string;
  points_gamification?: number;
}
