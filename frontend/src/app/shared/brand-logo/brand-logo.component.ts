import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * START SMART logo (assets/images/logo.png).
 * Use {@link link} for a clickable home route; null for decorative-only (e.g. auth hero).
 */
@Component({
  selector: 'app-brand-logo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <a
      *ngIf="link !== null"
      [routerLink]="link"
      class="inline-flex items-center shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
      [attr.aria-label]="ariaLabel"
    >
      <img
        [src]="src"
        [alt]="altText"
        [ngClass]="imgClass"
        class="select-none drop-shadow-md"
        draggable="false"
      />
    </a>
    <span
      *ngIf="link === null"
      class="inline-flex items-center shrink-0"
      role="img"
      [attr.aria-label]="ariaLabel"
    >
      <img
        [src]="src"
        [alt]="altText"
        [ngClass]="imgClass"
        class="select-none drop-shadow-md"
        draggable="false"
      />
    </span>
  `,
})
export class BrandLogoComponent {
  @Input() src = 'assets/images/logo.png';
  @Input() link: string | null = '/';
  @Input() altText = 'START SMART — Learn Smarter';
  @Input() ariaLabel = 'START SMART home';

  /**
   * header: top app bars · sidebar: narrow nav · auth: login/register hero · compact: tight rows
   */
  @Input() variant: 'header' | 'sidebar' | 'auth' | 'compact' = 'header';

  get imgClass(): string {
    // Source asset ~418×144; scales by height with max-width caps (pre–2× zoom sizing).
    const base =
      'w-auto object-contain object-left max-w-[min(100%,520px)]';
    switch (this.variant) {
      case 'sidebar':
        return `${base} h-14 sm:h-16 md:h-16`;
      case 'auth':
        return `${base} max-w-[min(100%,480px)] h-20 sm:h-24 md:h-28 mx-auto`;
      case 'compact':
        return `${base} max-w-[min(100%,360px)] h-10 sm:h-11 md:h-12`;
      case 'header':
      default:
        return `${base} h-14 sm:h-16 md:h-16`;
    }
  }
}
