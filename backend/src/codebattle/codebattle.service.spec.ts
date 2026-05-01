jest.mock("uuid", () => ({
  v4: jest.fn(() => "00000000-0000-4000-8000-000000000001"),
}));

import { CodebattleService } from "./codebattle.service";

describe("CodebattleService", () => {
  let service: CodebattleService;

  beforeEach(() => {
    service = new CodebattleService();
  });

  describe("getProblems", () => {
    it("filters by difficulty (case-insensitive) and caps count", () => {
      const easy = service.getProblems("EASY", 100);
      expect(easy.length).toBeGreaterThan(0);
      expect(easy.every((p) => p.difficulty === "easy")).toBe(true);

      const capped = service.getProblems("easy", 2);
      expect(capped.length).toBeLessThanOrEqual(2);
    });
  });

  describe("multiplayer room lifecycle", () => {
    it("createRoom initializes host, waiting status, and pending submissions map", () => {
      const room = service.createRoom("sock-host", "HostUser", {
        difficulty: "easy",
        count: 3,
      });

      expect(room.hostId).toBe("sock-host");
      expect(room.players).toHaveLength(1);
      expect(room.players[0].username).toBe("HostUser");
      expect(room.status).toBe("waiting");
      expect(room.roomCode).toMatch(/^[A-Z0-9]{6}$/);
      expect(room.pendingSubmissions).toBeDefined();
    });

    it("joinRoom throws when room missing", () => {
      expect(() =>
        service.joinRoom("XXXXXX", "s1", "p1"),
      ).toThrow("Room not found");
    });

    it("joinRoom throws when battle already started", () => {
      const room = service.createRoom("h1", "H", {
        difficulty: "easy",
        count: 2,
      });
      service.startGame(room.roomCode, "h1");

      expect(() =>
        service.joinRoom(room.roomCode, "s2", "p2"),
      ).toThrow("Battle already in progress");
    });

    it("joinRoom adds a new player when waiting", () => {
      const room = service.createRoom("h1", "H", {
        difficulty: "easy",
        count: 2,
      });
      const updated = service.joinRoom(room.roomCode, "s2", "Guest");

      expect(updated.players).toHaveLength(2);
      expect(updated.players.map((p) => p.username)).toContain("Guest");
    });

    it("leaveRoom deletes room when last player leaves", () => {
      const room = service.createRoom("only", "Solo", {
        difficulty: "easy",
        count: 1,
      });
      const code = room.roomCode;

      expect(service.leaveRoom(code, "only")).toBeNull();
      expect(service.getRoom(code)).toBeUndefined();
    });

    it("leaveRoom reassigns host when host leaves", () => {
      const room = service.createRoom("host", "H", {
        difficulty: "easy",
        count: 2,
      });
      service.joinRoom(room.roomCode, "guest", "G");

      const left = service.leaveRoom(room.roomCode, "host");
      expect(left).not.toBeNull();
      expect(left!.hostId).toBe("guest");
    });

    it("startGame rejects non-host", () => {
      const room = service.createRoom("h1", "H", { difficulty: "easy", count: 2 });
      service.joinRoom(room.roomCode, "g1", "G");

      expect(() => service.startGame(room.roomCode, "g1")).toThrow(
        "Only host can start",
      );
    });

    it("startGame loads problems and sets playing", () => {
      const room = service.createRoom("h1", "H", { difficulty: "easy", count: 2 });
      const started = service.startGame(room.roomCode, "h1");

      expect(started.status).toBe("playing");
      expect(started.problems.length).toBeGreaterThan(0);
      expect(started.currentProblemIndex).toBe(0);
    });

    it("updatePlayerStatus updates matching player", () => {
      const room = service.createRoom("h1", "H", { difficulty: "easy", count: 2 });
      const r = service.updatePlayerStatus(room.roomCode, "h1", "idle");
      expect(r!.players[0].status).toBe("idle");
    });

    it("submitMultiplayerSolution marks submitted and is idempotent", () => {
      const room = service.createRoom("h1", "H", { difficulty: "easy", count: 2 });
      service.startGame(room.roomCode, "h1");

      const first = service.submitMultiplayerSolution(
        room.roomCode,
        "h1",
        "code",
        10,
      );
      expect(first.alreadySubmitted).toBe(false);

      const second = service.submitMultiplayerSolution(
        room.roomCode,
        "h1",
        "code",
        10,
      );
      expect(second.alreadySubmitted).toBe(true);
    });

    it("getRoom returns undefined for unknown code", () => {
      expect(service.getRoom("ZZZZZZ")).toBeUndefined();
    });
  });
});
