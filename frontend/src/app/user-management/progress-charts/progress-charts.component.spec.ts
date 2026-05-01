import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ProgressChartsComponent } from './progress-charts.component';

describe('ProgressChartsComponent', () => {
  let component: ProgressChartsComponent;
  let fixture: ComponentFixture<ProgressChartsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [ProgressChartsComponent]
    });
    fixture = TestBed.createComponent(ProgressChartsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
