import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecommendationDisplayComponent } from './recommendation-display.component';

describe('RecommendationDisplayComponent', () => {
  let component: RecommendationDisplayComponent;
  let fixture: ComponentFixture<RecommendationDisplayComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RecommendationDisplayComponent]
    });
    fixture = TestBed.createComponent(RecommendationDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
