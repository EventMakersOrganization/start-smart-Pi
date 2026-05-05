import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl, socketBaseUrl, publicApiOrigin, assetUrl } from '../../core/api-url';

@Injectable({
    providedIn: 'root'
})
export class StatsService {
    private nestUrl = apiUrl('/api/brainrush');

    constructor(private http: HttpClient) { }

    getSoloStats(): Observable<any> {
        return this.http.get(`${this.nestUrl}/stats/solo`);
    }
}
