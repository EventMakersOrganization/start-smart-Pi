import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebinarService } from '../../services/webinar.service';
import { Webinar } from '../../services/webinar.interface';
import { AuthService } from '../../../user-management/auth.service';
import { interval, Subscription } from 'rxjs';

@Component({
    selector: 'app-webinar-list',
    templateUrl: './webinar-list.component.html',
    styleUrls: ['./webinar-list.component.css']
})
export class WebinarListComponent implements OnInit, OnDestroy {
    webinars: Webinar[] = [];
    liveWebinars: Webinar[] = [];
    upcomingWebinars: Webinar[] = [];
    pastWebinars: Webinar[] = [];
    userRole: string = '';

    private refreshSubscription!: Subscription;

    constructor(
        private webinarService: WebinarService,
        private authService: AuthService
    ) { }

    ngOnInit(): void {
        const user = this.authService.getUser();
        this.userRole = user?.role || '';
        this.loadWebinars();
        // Refresh every 30 seconds to update statuses and timers
        this.refreshSubscription = interval(30000).subscribe(() => this.loadWebinars());
    }

    ngOnDestroy(): void {
        if (this.refreshSubscription) this.refreshSubscription.unsubscribe();
    }

    loadWebinars() {
        this.webinarService.getWebinars().subscribe(data => {
            this.webinars = data;
            this.liveWebinars = data.filter((w: Webinar) => w.status === 'live');
            this.upcomingWebinars = data.filter((w: Webinar) => w.status === 'scheduled');
            this.pastWebinars = data.filter((w: Webinar) => w.status === 'ended');
        });
    }

    getCountdown(startTime: any): string {
        const start = new Date(startTime).getTime();
        const now = new Date().getTime();
        const diff = start - now;

        if (diff <= 0) return 'Starting now...';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 24) return `${Math.floor(hours / 24)} days to go`;
        return `${hours}h ${mins}m`;
    }

    getHeroWebinar(): Webinar | null {
        if (this.liveWebinars.length > 0) return this.liveWebinars[0];
        if (this.upcomingWebinars.length > 0) return this.upcomingWebinars[0];
        return null;
    }
}
