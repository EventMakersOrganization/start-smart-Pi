import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, BrandLogoComponent],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  @Input() user: any;
  @Input() homeLink: string = '/';
  @Input() searchPlaceholder: string = 'Search...';
  
  @Output() logoutRequest = new EventEmitter<void>();
  @Output() profileSidebarRequest = new EventEmitter<void>();

  constructor() { }

  ngOnInit(): void { }

  onLogout(): void {
    this.logoutRequest.emit();
  }

  onOpenProfile(): void {
    this.profileSidebarRequest.emit();
  }
}
