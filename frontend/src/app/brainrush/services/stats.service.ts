import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class StatsService {
    private nestUrl = 'http://localhost:3000/api/brainrush';

    constructor(private http: HttpClient) { }

    getSoloStats(): Observable<any> {
        return this.http.get(`${this.nestUrl}/stats/solo`);
    }
}
