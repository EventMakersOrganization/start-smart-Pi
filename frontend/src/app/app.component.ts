import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'frontend';
  private navSub?: Subscription;

  constructor(
    private router: Router,
    private titleService: Title,
  ) {}

  ngOnInit(): void {
    this.navSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updatePageTitle();
        this.focusMainContent();
      });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  private updatePageTitle(): void {
    const route = this.getDeepestRoute(this.router.routerState.root);
    const routeTitle = route?.snapshot?.data?.['title'];
    this.titleService.setTitle(
      routeTitle ? `${String(routeTitle)} - Start Smart` : 'Start Smart',
    );
  }

  private focusMainContent(): void {
    const main = document.getElementById('main-content');
    if (main) {
      main.focus();
    }
  }

  private getDeepestRoute(route: any): any {
    let current = route;
    while (current?.firstChild) {
      current = current.firstChild;
    }
    return current;
  }
}
