import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    id: number;
    actionUrl?: string;
    actionLabel?: string;
}

@Injectable({
    providedIn: 'root'
})
export class ToastService {
    private toasts: Toast[] = [];
    private toastSubject = new BehaviorSubject<Toast[]>([]);
    public toasts$ = this.toastSubject.asObservable();

    private counter = 0;

    show(message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info', actionUrl?: string, actionLabel?: string) {
        const id = this.counter++;
        const toast: Toast = { message, type, id, actionUrl, actionLabel };
        this.toasts.push(toast);
        this.toastSubject.next([...this.toasts]);

        // Auto remove after 10 seconds
        setTimeout(() => this.remove(id), 10000);
    }

    remove(id: number) {
        this.toasts = this.toasts.filter(t => t.id !== id);
        this.toastSubject.next([...this.toasts]);
    }
}
