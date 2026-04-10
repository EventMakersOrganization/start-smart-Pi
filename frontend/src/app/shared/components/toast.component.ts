import { Component } from '@angular/core';
import { ToastService, Toast } from '../services/toast.service';

import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-toast',
    standalone: true,
    imports: [CommonModule, RouterModule],
    template: `
        <div class="toast-container">
            <div *ngFor="let toast of toasts$ | async" 
                 class="toast glass" 
                 [ngClass]="toast.type">
                <div class="content">
                    <span class="icon" [ngSwitch]="toast.type">
                        <span *ngSwitchCase="'success'">✅</span>
                        <span *ngSwitchCase="'error'">❌</span>
                        <span *ngSwitchCase="'warning'">⚠️</span>
                        <span *ngSwitchCase="'info'">ℹ️</span>
                    </span>
                    <div class="text">
                        <p>{{ toast.message }}</p>
                        <button *ngIf="toast.actionUrl" 
                                class="action-btn"
                                [routerLink]="toast.actionUrl"
                                (click)="remove(toast.id)">
                            {{ toast.actionLabel || 'View' }}
                        </button>
                    </div>
                </div>
                <button class="close-btn" (click)="remove(toast.id)">×</button>
            </div>
        </div>
    `,
    styles: [`
        .toast-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 350px;
        }

        .glass {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            color: white;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            animation: slideLeft 0.3s ease-out;
        }

        @keyframes slideLeft {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        .content {
            display: flex;
            gap: 12px;
        }

        .icon {
            font-size: 1.2rem;
        }

        .text p {
            margin: 0;
            font-size: 0.9rem;
            font-weight: 500;
        }

        .action-btn {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: bold;
            margin-top: 8px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .action-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .close-btn {
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.5);
            font-size: 1.5rem;
            line-height: 1;
            cursor: pointer;
            padding: 0;
            margin-left: 10px;
        }

        .close-btn:hover {
            color: white;
        }

        .error { border-left: 4px solid #ff4d4d; }
        .success { border-left: 4px solid #00e676; }
        .warning { border-left: 4px solid #ffab00; }
        .info { border-left: 4px solid #2979ff; }
    `]
})
export class ToastComponent {
    toasts$ = this.toastService.toasts$;

    constructor(private toastService: ToastService) { }

    remove(id: number) {
        this.toastService.remove(id);
    }
}
