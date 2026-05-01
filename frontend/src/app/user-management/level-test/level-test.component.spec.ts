import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, of, throwError } from "rxjs";
import { ActivatedRoute, Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import { LevelTestComponent } from "./level-test.component";
import { AdaptiveLearningService } from "../adaptive-learning.service";
import { AuthService } from "../auth.service";

describe("LevelTestComponent", () => {
  let fixture: ComponentFixture<LevelTestComponent>;
  let component: LevelTestComponent;
  let adaptiveService: jasmine.SpyObj<
    Pick<
      AdaptiveLearningService,
      "startLevelTestStage" | "startPostEvaluationStage"
    >
  >;
  let router: jasmine.SpyObj<Pick<Router, "navigate">>;
  const queryParams = new BehaviorSubject<Record<string, string>>({});

  const sessionResponse = {
    session_id: "sess-1",
    first_question: {
      question: "What is 2+2?",
      options: ["3", "4"],
      difficulty: "easy",
      topic: "Math",
    },
    total_questions: 1,
    is_ai_generated: false,
  };

  beforeEach(async () => {
    adaptiveService = jasmine.createSpyObj("AdaptiveLearningService", [
      "startLevelTestStage",
      "startPostEvaluationStage",
    ]);
    adaptiveService.startLevelTestStage.and.returnValue(of(sessionResponse));

    router = jasmine.createSpyObj("Router", ["navigate"]);

    spyOn(window, "setInterval").and.returnValue(999 as unknown as number);
    spyOn(window, "clearInterval");

    await TestBed.configureTestingModule({
      declarations: [LevelTestComponent],
      imports: [CommonModule],
      providers: [
        { provide: AdaptiveLearningService, useValue: adaptiveService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParams.asObservable() },
        },
        {
          provide: AuthService,
          useValue: {
            getUser: jasmine
              .createSpy("getUser")
              .and.returnValue({
                id: "student-1",
                first_name: "Ada",
                last_name: "Lovelace",
              }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LevelTestComponent);
    component = fixture.componentInstance;
    queryParams.next({});
  });

  afterEach(() => {
    fixture.destroy();
  });

  it("should create", () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it("navigates to login when user is missing", () => {
    const auth = TestBed.inject(AuthService) as any;
    auth.getUser.and.returnValue(null);

    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(["/login"]);
  });

  it("loads level test via startLevelTestStage and clears loading", async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(adaptiveService.startLevelTestStage).toHaveBeenCalledWith(
      [],
      undefined,
    );
    expect(component.loading).toBe(false);
    expect(component.sessionId).toBe("sess-1");
    expect(component.testData?.total_questions).toBe(1);
  });

  it("sets loading false when startLevelTestStage errors", async () => {
    adaptiveService.startLevelTestStage.and.returnValue(
      throwError(() => new Error("network")),
    );

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.loading).toBe(false);
  });

  it("formatQuestionText strips leading Quiz heading line", () => {
    const text = component.formatQuestionText({
      questionText: "Quiz 1 : Demo\nReal question body",
    });
    expect(text).toContain("Real question body");
    expect(text).not.toMatch(/^Quiz\s*1/i);
  });

  it("formatOptionText strips A/B/C prefix from option string", () => {
    expect(component.formatOptionText("A. hello")).toBe("hello");
  });
});
