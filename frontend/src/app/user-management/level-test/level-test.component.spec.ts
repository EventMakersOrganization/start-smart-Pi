import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LevelTestComponent } from './level-test.component';

describe('LevelTestComponent', () => {
  let component: LevelTestComponent;
  let fixture: ComponentFixture<LevelTestComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LevelTestComponent]
    });
    fixture = TestBed.createComponent(LevelTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
