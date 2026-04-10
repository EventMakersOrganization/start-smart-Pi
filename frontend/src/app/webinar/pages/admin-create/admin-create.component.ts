import { Component } from '@angular/core';
import { WebinarService } from '../../services/webinar.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-admin-create',
    templateUrl: './admin-create.component.html',
    styleUrls: ['./admin-create.component.css']
})
export class AdminCreateWebinarComponent {
    webinar: any = {
        title: '',
        description: '',
        instructorName: '',
        scheduledStartTime: '',
        durationMinutes: 60,
        thumbnailUrl: ''
    };

    constructor(private webinarService: WebinarService, private router: Router) { }

    onSubmit() {
        this.webinarService.createWebinar(this.webinar).subscribe({
            next: () => {
                alert('Webinar Created Successfully!');
                this.router.navigate(['/webinar/list']);
            },
            error: (err) => alert('Error creating webinar: ' + err.message)
        });
    }
}
