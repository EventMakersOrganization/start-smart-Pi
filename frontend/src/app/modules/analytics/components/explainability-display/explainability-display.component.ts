import { Component, Input, OnInit } from '@angular/core';
import type { ExplainabilityLog, ExplainabilityFactor } from '../../models/analytics.models';

interface DecisionTypeConfig {
  label: string;
  badgeClass: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-explainability-display',
  templateUrl: './explainability-display.component.html',
  styleUrls: ['./explainability-display.component.css'],
})
export class ExplainabilityDisplayComponent implements OnInit {
  @Input() explanations: ExplainabilityLog[] = [];
  @Input() loading: boolean = false;

  // Decision type display configurations
  readonly decisionTypeMap: Record<string, DecisionTypeConfig> = {
    'FLAG_ATTRITION': {
      label: 'Flag Attrition Risk',
      badgeClass: 'bg-error-container text-on-error-container',
      icon: 'warning',
      color: 'error',
    },
    'MONITOR_SENTIMENT': {
      label: 'Monitor Sentiment',
      badgeClass: 'bg-primary-fixed text-on-primary-fixed',
      icon: 'sentiment_worried',
      color: 'primary',
    },
    'CLEAR_RE_ENTRY': {
      label: 'Clear Re-Entry',
      badgeClass: 'bg-secondary-container text-on-secondary-container',
      icon: 'check_circle',
      color: 'secondary',
    },
    'FLAG_PERFORMANCE': {
      label: 'Flag Performance Drop',
      badgeClass: 'bg-error-container text-on-error-container',
      icon: 'trending_down',
      color: 'error',
    },
  };

  ngOnInit(): void {
    // Explanations are provided via @Input
  }

  /**
   * Get the display configuration for a decision type
   */
  getDecisionTypeConfig(decision: string): DecisionTypeConfig {
    return this.decisionTypeMap[decision] || {
      label: decision.replace(/_/g, ' '),
      badgeClass: 'bg-surface-container text-on-surface',
      icon: 'info',
      color: 'primary',
    };
  }

  /**
   * Get risk level badge class based on risk score
   */
  getRiskLevelBadgeClass(riskScore: number): string {
    if (riskScore >= 80) {
      return 'text-error bg-error px-2 py-0.5 rounded-full';
    } else if (riskScore >= 50) {
      return 'text-primary-fixed bg-primary-fixed text-on-primary-fixed px-2 py-0.5 rounded-full';
    } else {
      return 'text-secondary bg-secondary px-2 py-0.5 rounded-full';
    }
  }

  /**
   * Get risk level text
   */
  getRiskLevelText(riskScore: number): string {
    if (riskScore >= 80) {
      return 'High Risk';
    } else if (riskScore >= 50) {
      return 'Med Risk';
    } else {
      return 'Low Risk';
    }
  }

  /**
   * Get risk level label with uppercase/tracking
   */
  getRiskLevelLabel(riskScore: number): string {
    if (riskScore >= 80) {
      return 'HIGH RISK';
    } else if (riskScore >= 50) {
      return 'MEDIUM RISK';
    } else {
      return 'LOW RISK';
    }
  }

  /**
   * Get background gradient overlay class based on risk score
   */
  getGradientOverlayClass(riskScore: number): string {
    if (riskScore >= 80) {
      return 'bg-error/5';
    } else if (riskScore >= 50) {
      return 'bg-primary/5';
    } else {
      return 'bg-secondary/5';
    }
  }

  /**
   * Get accent color class for factor bar based on risk score
   */
  getFactorBarColorClass(riskScore: number): string {
    if (riskScore >= 80) {
      return 'bg-error';
    } else if (riskScore >= 50) {
      return 'bg-primary';
    } else {
      return 'bg-secondary';
    }
  }

  /**
   * Sort factors by impact (highest first)
   */
  getSortedFactors(factors: ExplainabilityFactor[]): ExplainabilityFactor[] {
    return [...factors].sort((a, b) => b.impact - a.impact);
  }

  /**
   * Get top 3 factors for display
   */
  getTopFactors(factors: ExplainabilityFactor[]): ExplainabilityFactor[] {
    return this.getSortedFactors(factors).slice(0, 3);
  }

  /**
   * Format user ID display (add prefix if needed)
   */
  formatUserId(userId: string): string {
    // If userId is already formatted with prefix, return as is
    if (userId.startsWith('ST-')) {
      return userId;
    }
    // Otherwise, add prefix
    return `ST-${userId.slice(-4).padStart(4, '0')}`;
  }

  /**
   * Get enrollment status display for student
   */
  getEnrollmentStatus(decision: string): string {
    const statusMap: Record<string, string> = {
      'FLAG_ATTRITION': 'Active Enrollment',
      'MONITOR_SENTIMENT': 'Probationary Status',
      'CLEAR_RE_ENTRY': 'Active Enrollment',
      'FLAG_PERFORMANCE': 'Active Enrollment',
    };
    return statusMap[decision] || 'Active Enrollment';
  }

  /**
   * Get decision type slug from decision string
   */
  getDecisionSlug(decision: string): string {
    return decision.toLowerCase().replace(/_/g, '-');
  }

  /**
   * Format date for display
   */
  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day} ${month}, ${time}`;
  }

  /**
   * Get decision type slug for CSS classes
   */
  getDecisionTypeSlug(decision: string): string {
    return decision.toLowerCase().replace(/_/g, '-');
  }

  trackByExplanationId(_: number, item: ExplainabilityLog): string {
    if (item._id) {
      return String(item._id);
    }
    return `${item.userId}-${item.decision}-${item.createdAt ? new Date(item.createdAt).getTime() : ''}`;
  }

  trackByFactorName(_: number, factor: ExplainabilityFactor): string {
    return factor.name;
  }
}
