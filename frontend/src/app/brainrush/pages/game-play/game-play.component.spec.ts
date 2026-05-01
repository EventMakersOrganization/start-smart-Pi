import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import {
  AnswerOptionComponent,
  GamePlayComponent,
  GameTimerComponent,
  PowerUpComponent,
} from "./game-play.component";
import { BrainrushService } from "../../services/brainrush.service";
import { SocketService } from "../../services/socket.service";
import { ScoringService } from "../../services/scoring.service";
import { AudioService } from "../../services/audio.service";

describe("GameTimerComponent", () => {
  it("offset is zero when time equals total", () => {
    const timer = new GameTimerComponent();
    timer.timeLeft = 15;
    timer.total = 15;
    expect(timer.offset).toBe(0);
  });

  it("offset equals circumference when timeLeft is zero", () => {
    const timer = new GameTimerComponent();
    timer.timeLeft = 0;
    timer.total = 20;
    expect(timer.offset).toBeCloseTo(timer.circumference, 5);
  });
});

describe("PowerUpComponent", () => {
  it("emits use when count > 0", () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PowerUpComponent, CommonModule],
    }).createComponent(PowerUpComponent);
    const cmp = fixture.componentInstance;
    spyOn(cmp.use, "emit");
    cmp.count = 2;
    cmp.onUse();
    expect(cmp.use.emit).toHaveBeenCalled();
  });

  it("does not emit when count is 0", () => {
    const fixture = TestBed.configureTestingModule({
      imports: [PowerUpComponent, CommonModule],
    }).createComponent(PowerUpComponent);
    const cmp = fixture.componentInstance;
    spyOn(cmp.use, "emit");
    cmp.count = 0;
    cmp.onUse();
    expect(cmp.use.emit).not.toHaveBeenCalled();
  });
});

describe("AnswerOptionComponent", () => {
  it("select emits when not answered and not locked", () => {
    TestBed.configureTestingModule({
      imports: [AnswerOptionComponent, CommonModule],
    });
    const fixture = TestBed.createComponent(AnswerOptionComponent);
    const cmp = fixture.componentInstance;
    spyOn(cmp.select, "emit");
    cmp.answered = false;
    cmp.isLocked = false;
    cmp.onSelect();
    expect(cmp.select.emit).toHaveBeenCalled();
  });

  it("select does not emit when locked", () => {
    TestBed.configureTestingModule({
      imports: [AnswerOptionComponent, CommonModule],
    });
    const fixture = TestBed.createComponent(AnswerOptionComponent);
    const cmp = fixture.componentInstance;
    spyOn(cmp.select, "emit");
    cmp.answered = false;
    cmp.isLocked = true;
    cmp.onSelect();
    expect(cmp.select.emit).not.toHaveBeenCalled();
  });

  it("buttonClass reflects selected state before answer", () => {
    TestBed.configureTestingModule({
      imports: [AnswerOptionComponent, CommonModule],
    });
    const fixture = TestBed.createComponent(AnswerOptionComponent);
    const cmp = fixture.componentInstance;
    cmp.answered = false;
    cmp.isSelected = true;
    expect(cmp.buttonClass).toContain("border-blue");
  });
});

describe("GamePlayComponent (solo demo smoke)", () => {
  let fixture: ComponentFixture<GamePlayComponent>;

  beforeEach(async () => {
    const paramMap = jasmine.createSpyObj("ParamMap", ["get"]);
    paramMap.get.and.callFake((key: string) => {
      if (key === "sessionId") {
        return "demo";
      }
      if (key === "roomCode") {
        return "solo";
      }
      return null;
    });

    await TestBed.configureTestingModule({
      imports: [GamePlayComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap } },
        },
        {
          provide: Router,
          useValue: {
            getCurrentNavigation: () => null,
          },
        },
        {
          provide: BrainrushService,
          useValue: {
            initializeSoloSession: jasmine
              .createSpy("initializeSoloSession")
              .and.returnValue({ subscribe: () => ({ unsubscribe: () => {} }) }),
          },
        },
        {
          provide: SocketService,
          useValue: {},
        },
        {
          provide: ScoringService,
          useValue: {},
        },
        {
          provide: AudioService,
          useValue: {
            startMusic: jasmine.createSpy("startMusic"),
            playSFX: jasmine.createSpy("playSFX"),
            stopMusic: jasmine.createSpy("stopMusic"),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GamePlayComponent);
  });

  afterEach(() => {
    fixture.destroy();
  });

  it("should create and load demo questions", () => {
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.sessionId).toBe("demo");
    expect(component.isMultiplayer).toBe(false);
    expect(component.totalQuestions).toBeGreaterThan(0);
    expect(component.currentQuestion).not.toBeNull();
  });
});
