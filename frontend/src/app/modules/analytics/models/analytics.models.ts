// Analytics Models and Interfaces

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
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
  dimensions?: {
    performance_risk: number;
    engagement_risk: number;
    progression_risk: number;
    weakness_persistence: number;
    trend_risk: number;
  };
  requiresIntervention?: boolean;
  interventionType?: 'post_evaluation' | 'remedial_content' | 'instructor_alert' | 'none';
  weakAreas?: Array<{
    topic: string;
    currentScore: number;
    suggestedDifficulty: 'easy' | 'medium' | 'hard';
    action: string;
    source: 'level-test' | 'performance' | 'profile';
  }>;
  reason?: string;
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
  isOnline?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  academic_level?: string;
  risk_level?: string;
  points_gamification?: number;
}

export interface ExplainabilityFactor {
  name: string;
  impact: number; // Percentage impact (0-100)
}

export interface ExplainabilityLog {
  _id?: string;
  userId: string;
  recommendationId?: string;
  riskScore: number; // Percentage (0-100)
  decision: string; // e.g., 'FLAG_ATTRITION', 'MONITOR_SENTIMENT'
  explanation: string; // Human-readable explanation text
  factors: ExplainabilityFactor[]; // Contributing factors with impacts
  createdAt?: Date;
  updatedAt?: Date;
}
