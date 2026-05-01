import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface HighRiskAlertEmailPayload {
  to: string;
  riskLevel: string;
  alertMessage: string;
  timestamp: Date;
}

export interface InterventionEmailPayload {
  to: string;
  subject: string;
  headline: string;
  lines: string[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendHighRiskAlertEmail(payload: HighRiskAlertEmailPayload): Promise<boolean> {
    const subject = `High Risk Alert - ${payload.riskLevel.toUpperCase()}`;
    const isoTimestamp = payload.timestamp.toISOString();

    const text = [
      'A high risk alert has been triggered.',
      `User Email: ${payload.to}`,
      `Risk Level: ${payload.riskLevel}`,
      `Alert Message: ${payload.alertMessage}`,
      `Timestamp: ${isoTimestamp}`,
    ].join('\n');

    const html = `
      <h3>High Risk Alert Triggered</h3>
      <p><strong>User Email:</strong> ${payload.to}</p>
      <p><strong>Risk Level:</strong> ${payload.riskLevel}</p>
      <p><strong>Alert Message:</strong> ${payload.alertMessage}</p>
      <p><strong>Timestamp:</strong> ${isoTimestamp}</p>
    `;

    return this.sendMail(payload.to, subject, text, html);
  }

  async sendInterventionEmail(payload: InterventionEmailPayload): Promise<boolean> {
    const text = [payload.headline, ...payload.lines].join('\n');
    const html = `
      <h3>${payload.headline}</h3>
      <ul>
        ${payload.lines.map((line) => `<li>${line}</li>`).join('')}
      </ul>
    `;

    return this.sendMail(payload.to, payload.subject, text, html);
  }

  private async sendMail(to: string, subject: string, text: string, html: string): Promise<boolean> {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      this.logger.warn('SMTP is not fully configured; skipping email notification.');
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT, 10),
      secure: parseInt(SMTP_PORT, 10) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    try {
      await transporter.sendMail({
        from: SMTP_FROM || SMTP_USER,
        to,
        subject,
        text,
        html,
      });
      return true;
    } catch (error) {
      this.logger.error('Failed to send high-risk alert email.', error as Error);
      return false;
    }
  }
}
