import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { LevelTestComponent } from './level-test.component';
import { AuthService } from '../auth.service';
import { AdaptiveLearningService } from '../adaptive-learning.service';

describe('LevelTestComponent', () => {
  let component: LevelTestComponent;
  let fixture: ComponentFixture<LevelTestComponent>;

  const authServiceMock = {
    getUser: jasmine.createSpy('getUser').and.returnValue({ _id: '123', first_name: 'John' })
  };

  const adaptiveServiceMock = {
    startLevelTestStage: jasmine.createSpy('startLevelTestStage').and.returnValue(of({})),
    startPostEvaluationStage: jasmine.createSpy('startPostEvaluationStage').and.returnValue(of({}))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [LevelTestComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: AdaptiveLearningService, useValue: adaptiveServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LevelTestComponent);
    component = fixture.componentInstance;
    // fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
