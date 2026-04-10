import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { WebinarListComponent } from './pages/list/webinar-list.component';
import { WebinarLiveComponent } from './pages/live/webinar-live.component';
import { AdminCreateWebinarComponent } from './pages/admin-create/admin-create.component';

const routes: Routes = [
    { path: 'list', component: WebinarListComponent },
    { path: 'live/:id', component: WebinarLiveComponent },
    { path: 'admin-create', component: AdminCreateWebinarComponent },
];

@NgModule({
    declarations: [
        WebinarListComponent,
        WebinarLiveComponent,
        AdminCreateWebinarComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        RouterModule.forChild(routes)
    ]
})
export class WebinarModule { }
