import {
  HttpClientTestingModule,
  HttpTestingController,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { AdaptiveLearningService } from "./adaptive-learning.service";
import { AuthService } from "./auth.service";

describe("AdaptiveLearningService", () => {
  let service: AdaptiveLearningService;
  let httpMock: HttpTestingController;
  const base = "http://localhost:3000/api/adaptive";

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AdaptiveLearningService,
        { provide: AuthService, useValue: {} },
      ],
    });
    service = TestBed.inject(AdaptiveLearningService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("createProfile posts to /profiles", () => {
    const body = { userId: "u1" };
    let result: unknown;
    service.createProfile(body).subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${base}/profiles`);
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual(body);
    req.flush({ ok: true });
    expect(result).toEqual({ ok: true });
  });

  it("getGoalSettings GETs goals path", () => {
    const goals = {
      studyHoursPerWeek: 8,
      targetTopic: "x",
      targetScorePerTopic: 75,
      exercisesPerDay: 2,
      targetLevel: "intermediate",
      deadline: "",
      createdAt: "",
    };
    let result: unknown;
    service.getGoalSettings("s1").subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${base}/goals/s1`);
    expect(req.request.method).toBe("GET");
    req.flush(goals);
    expect(result).toEqual(goals);
  });

  it("getGoalSettings returns null on HTTP error (catchError)", () => {
    let result: unknown = "unset";
    service.getGoalSettings("s1").subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${base}/goals/s1`);
    req.flush("err", { status: 500, statusText: "Server Error" });
    expect(result).toBeNull();
  });

  it("generateRecommendationsV2 POSTs to v2 path", () => {
    const payload = { done: true };
    let result: unknown;
    service.generateRecommendationsV2("s1").subscribe((r) => (result = r));

    const req = httpMock.expectOne(
      `${base}/recommendations/generate/v2/s1`,
    );
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({});
    req.flush(payload);
    expect(result).toEqual(payload);
  });

  it("getSpacedRepetitionSchedule GETs spaced-repetition path", () => {
    const res = {
      schedule: [],
      overdueCount: 0,
      dueTodayCount: 0,
      nextSession: null,
    };
    let result: unknown;
    service.getSpacedRepetitionSchedule("s1").subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${base}/spaced-repetition/s1`);
    expect(req.request.method).toBe("GET");
    req.flush(res);
    expect(result).toEqual(res);
  });
});
