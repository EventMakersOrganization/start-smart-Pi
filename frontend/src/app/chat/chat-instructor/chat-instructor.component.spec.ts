import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatInstructorComponent } from './chat-instructor.component';

describe('ChatInstructorComponent', () => {
  let component: ChatInstructorComponent;
  let fixture: ComponentFixture<ChatInstructorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ChatInstructorComponent]
    });
    fixture = TestBed.createComponent(ChatInstructorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
