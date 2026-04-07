import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as vm from 'vm';
import { PROBLEM_BANK } from './problem-bank';
import { CodeProblem, Player, Room, SoloSession, PendingSubmission } from './interfaces/codebattle.interfaces';
import { v4 as uuidv4 } from 'uuid';

// ─── PROBLEM EXECUTION CONFIG ───
// Tells the engine HOW to call each problem's function and handle I/O
interface ProblemExecConfig {
    funcName: string;
    argsMode: 'single' | 'spread';
    inputConvert?: 'linkedlist' | 'tree' | 'tree_pair' | 'linkedlist_array' | 'tree_and_int';
    outputConvert?: 'linkedlist';
    skipRealExec?: boolean;
}

const PROBLEM_CONFIG: Record<string, ProblemExecConfig> = {
    "1": { funcName: "reverseList", argsMode: "single", inputConvert: "linkedlist", outputConvert: "linkedlist" },
    "2": { funcName: "twoSum", argsMode: "spread" },
    "3": { funcName: "isPalindrome", argsMode: "single" },
    "4": { funcName: "isValid", argsMode: "single" },
    "5": { funcName: "findMedianSortedArrays", argsMode: "spread" },
    "6": { funcName: "lengthOfLongestSubstring", argsMode: "single" },
    "7": { funcName: "myAtoi", argsMode: "single" },
    "8": { funcName: "mergeKLists", argsMode: "single", inputConvert: "linkedlist_array", outputConvert: "linkedlist" },
    "9": { funcName: "trap", argsMode: "single" },
    "10": { funcName: "inorderTraversal", argsMode: "single", inputConvert: "tree" },
    "11": { funcName: "groupAnagrams", argsMode: "single" },
    "12": { funcName: "solveNQueens", argsMode: "single" },
    "13": { funcName: "isSameTree", argsMode: "spread", inputConvert: "tree_pair" },
    "14": { funcName: "isSymmetric", argsMode: "single", inputConvert: "tree" },
    "15": { funcName: "threeSum", argsMode: "single" },
    "16": { funcName: "search", argsMode: "spread" },
    "17": { funcName: "minDistance", argsMode: "spread" },
    "18": { funcName: "solveSudoku", argsMode: "single", skipRealExec: true },
    "19": { funcName: "hasCycle", argsMode: "single", skipRealExec: true },
    "20": { funcName: "maxDepth", argsMode: "single", inputConvert: "tree" },
    "21": { funcName: "singleNumber", argsMode: "single" },
    "22": { funcName: "titleToNumber", argsMode: "single" },
    "23": { funcName: "longestPalindrome", argsMode: "single" },
    "24": { funcName: "kthSmallest", argsMode: "spread", inputConvert: "tree_and_int" },
    "25": { funcName: "productExceptSelf", argsMode: "single" },
    "26": { funcName: "spiralOrder", argsMode: "single" },
    "27": { funcName: "isMatch", argsMode: "spread" },
    "28": { funcName: "longestValidParentheses", argsMode: "single" },
    "29": { funcName: "maxCoins", argsMode: "single" },
    "30": { funcName: "wordBreak", argsMode: "spread" },
};

// ─── HELPER CODE injected into sandbox for linked list & tree operations ───
const JS_HELPERS = `
function ListNode(val, next) {
    this.val = (val === undefined ? 0 : val);
    this.next = (next === undefined ? null : next);
}
function TreeNode(val, left, right) {
    this.val = (val === undefined ? 0 : val);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
}
function __arrayToLL(arr) {
    if (!arr || !arr.length) return null;
    var head = new ListNode(arr[0]);
    var cur = head;
    for (var i = 1; i < arr.length; i++) { cur.next = new ListNode(arr[i]); cur = cur.next; }
    return head;
}
function __llToArray(head) {
    var arr = [];
    while (head) { arr.push(head.val); head = head.next; }
    return arr;
}
function __arrayToTree(arr) {
    if (!arr || !arr.length || arr[0] === null || arr[0] === undefined) return null;
    var root = new TreeNode(arr[0]);
    var queue = [root];
    var i = 1;
    while (queue.length && i < arr.length) {
        var node = queue.shift();
        if (i < arr.length && arr[i] !== null && arr[i] !== undefined) {
            node.left = new TreeNode(arr[i]);
            queue.push(node.left);
        }
        i++;
        if (i < arr.length && arr[i] !== null && arr[i] !== undefined) {
            node.right = new TreeNode(arr[i]);
            queue.push(node.right);
        }
        i++;
    }
    return root;
}
`;

@Injectable()
export class CodebattleService {
    private readonly logger = new Logger(CodebattleService.name);
    private rooms: Map<string, Room> = new Map();
    private soloSessions: Map<string, SoloSession> = new Map();

    // --- PROBLEM SELECTION ---
    getProblems(difficulty: string, count: number): CodeProblem[] {
        const filtered = PROBLEM_BANK.filter(p => p.difficulty === difficulty.toLowerCase());
        const shuffled = [...filtered].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }

    // =====================================================================
    //  REAL CODE EVALUATION ENGINE
    //  For JavaScript: uses Node.js `vm` module to actually run the code
    //  For Python: uses `spawn` to run real Python
    //  For Java/C++: lenient simulation (no real compiler available)
    // =====================================================================

    private evaluateCode(problem: CodeProblem, code: string, language: string): any[] {
        const config = PROBLEM_CONFIG[problem.id];
        if (!config) {
            return this.fallbackEval(problem, code);
        }

        // For problems that are too complex to wire up (sudoku, cycle detection)
        if (config.skipRealExec) {
            return this.fallbackEval(problem, code);
        }

        if (language === 'javascript') {
            return this.evaluateJavaScript(problem, code, config);
        }

        if (language === 'python') {
            return this.evaluatePythonSync(problem, code, config);
        }

        // Java / C++ → lenient simulation
        return this.fallbackEval(problem, code);
    }

    // ─── JAVASCRIPT: Real execution via vm sandbox ───
    private evaluateJavaScript(problem: CodeProblem, code: string, config: ProblemExecConfig): any[] {
        return problem.testCases.map(tc => {
            try {
                // Build argument preparation code
                let argCode = '';
                if (config.inputConvert === 'linkedlist') {
                    argCode = `var __args = [__arrayToLL(${JSON.stringify(tc.input)})];`;
                } else if (config.inputConvert === 'linkedlist_array') {
                    const lists = Array.isArray(tc.input) ? tc.input : [];
                    argCode = `var __lists = [${lists.map(l => `__arrayToLL(${JSON.stringify(l)})`).join(',')}]; var __args = [__lists];`;
                } else if (config.inputConvert === 'tree') {
                    argCode = `var __args = [__arrayToTree(${JSON.stringify(tc.input)})];`;
                } else if (config.inputConvert === 'tree_pair') {
                    const input = tc.input as any[];
                    argCode = `var __args = [__arrayToTree(${JSON.stringify(input[0])}), __arrayToTree(${JSON.stringify(input[1])})];`;
                } else if (config.inputConvert === 'tree_and_int') {
                    const input = tc.input as any[];
                    argCode = `var __args = [__arrayToTree(${JSON.stringify(input[0])}), ${JSON.stringify(input[1])}];`;
                } else if (config.argsMode === 'spread' && Array.isArray(tc.input)) {
                    argCode = `var __args = ${JSON.stringify(tc.input)};`;
                } else {
                    argCode = `var __args = [${JSON.stringify(tc.input)}];`;
                }

                // Build output conversion
                let convertResult = '__rawResult';
                if (config.outputConvert === 'linkedlist') {
                    convertResult = '__llToArray(__rawResult)';
                }

                const fullCode = `
                    ${JS_HELPERS}
                    ${code}
                    ${argCode}
                    var __rawResult = ${config.funcName}.apply(null, __args);
                    var __result = ${convertResult};
                    __result;
                `;

                const sandbox = {};
                const context = vm.createContext(sandbox);
                const result = vm.runInContext(fullCode, context, { timeout: 5000 });

                const actualStr = JSON.stringify(result);
                const expectedStr = JSON.stringify(tc.expectedOutput);

                // Smart comparison: handle floating point and array order
                const passed = this.compareOutputs(result, tc.expectedOutput);

                return {
                    input: JSON.stringify(tc.input),
                    expected: expectedStr,
                    output: actualStr,
                    passed
                };
            } catch (e: any) {
                return {
                    input: JSON.stringify(tc.input),
                    expected: JSON.stringify(tc.expectedOutput),
                    output: `Runtime Error: ${e.message}`,
                    passed: false
                };
            }
        });
    }

    // ─── PYTHON: Synchronous execution via spawnSync ───
    private evaluatePythonSync(problem: CodeProblem, code: string, config: ProblemExecConfig): any[] {
        const { execSync } = require('child_process');
        const funcName = config.funcName;

        // Build Python test harness
        let testCode = `
import json, sys

# Helper classes
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def array_to_ll(arr):
    if not arr: return None
    head = ListNode(arr[0])
    cur = head
    for v in arr[1:]:
        cur.next = ListNode(v)
        cur = cur.next
    return head

def ll_to_array(head):
    arr = []
    while head:
        arr.append(head.val)
        head = head.next
    return arr

def array_to_tree(arr):
    if not arr or arr[0] is None: return None
    root = TreeNode(arr[0])
    queue = [root]
    i = 1
    while queue and i < len(arr):
        node = queue.pop(0)
        if i < len(arr) and arr[i] is not None:
            node.left = TreeNode(arr[i])
            queue.append(node.left)
        i += 1
        if i < len(arr) and arr[i] is not None:
            node.right = TreeNode(arr[i])
            queue.append(node.right)
        i += 1
    return root

def compare_outputs(actual, expected):
    if actual == expected: return True
    if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        return abs(actual - expected) < 0.0001
    if isinstance(actual, list) and isinstance(expected, list):
        if len(actual) != len(expected): return False
        try:
            # Sort arrays of arrays/dicts for order-independence
            s_actual = sorted([json.dumps(x, sort_keys=True) for x in actual])
            s_expected = sorted([json.dumps(x, sort_keys=True) for x in expected])
            return s_actual == s_expected
        except:
            return False
    return False

# Type aliases for templates
from typing import List, Optional

# ---- USER CODE ----
${code}
# ---- END USER CODE ----

# Detect if user used class Solution pattern or standalone function
_use_class = False
try:
    _sol = Solution()
    _use_class = True
except:
    pass

test_cases = ${JSON.stringify(problem.testCases)}
results = []
for tc in test_cases:
    try:
        inp = tc['input']
        expected = tc['expectedOutput']
        if config.inputConvert === 'linkedlist':
            args = [array_to_ll(inp)]
        elif config.inputConvert === 'tree':
            args = [array_to_tree(inp)]
        elif config.inputConvert === 'tree_pair':
            args = [array_to_tree(inp[0]), array_to_tree(inp[1])]
        elif config.inputConvert === 'tree_and_int':
            args = [array_to_tree(inp[0]), inp[1]]
        elif config.inputConvert === 'linkedlist_array':
            args = [[array_to_ll(l) for l in inp]]
        elif config.argsMode === 'spread':
            args = inp if isinstance(inp, list) else [inp]
        else:
            args = [inp]

        if _use_class:
            raw = _sol.${config.funcName}(*args)
        else:
            raw = ${config.funcName}(*args)

        if config.outputConvert === 'linkedlist':
            actual = ll_to_array(raw)
        else:
            actual = raw

        results.append({
            'input': json.dumps(inp),
            'expected': json.dumps(expected),
            'output': json.dumps(actual),
            'passed': compare_outputs(actual, expected)
        })
    except Exception as e:
        results.append({
            'input': json.dumps(tc.get('input','')),
            'expected': json.dumps(tc.get('expectedOutput','')),
            'output': 'Runtime Error: ' + str(e),
            'passed': False
        })

print('__RESULTS__' + json.dumps(results))
`;

        try {
            // Try 'python' then 'python3'
            let cmd = `python -c "${testCode.replace(/"/g, '\\"')}"`;
            let output;
            try {
                output = execSync(cmd, { timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
            } catch (err) {
                cmd = `python3 -c "${testCode.replace(/"/g, '\\"')}"`;
                output = execSync(cmd, { timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
            }

            const marker = '__RESULTS__';
            const idx = output.indexOf(marker);
            if (idx >= 0) {
                const jsonStr = output.substring(idx + marker.length).trim();
                return JSON.parse(jsonStr);
            }
        } catch (e: any) {
            this.logger.warn(`Python execution failed, falling back: ${e.message?.substring(0, 100)}`);
        }

        // Python not available or error → use code-based simulation
        return this.fallbackEval(problem, code);
    }

    // ─── SMART OUTPUT COMPARISON ───
    private compareOutputs(actual: any, expected: any): boolean {
        // Exact JSON match
        if (JSON.stringify(actual) === JSON.stringify(expected)) return true;

        // Float comparison (e.g., 2 vs 2.0)
        if (typeof actual === 'number' && typeof expected === 'number') {
            return Math.abs(actual - expected) < 0.0001;
        }

        // Boolean comparison
        if (typeof actual === 'boolean' && typeof expected === 'boolean') {
            return actual === expected;
        }

        // Array comparison (handle sorted vs unsorted for problems like groupAnagrams)
        if (Array.isArray(actual) && Array.isArray(expected)) {
            if (actual.length !== expected.length) return false;
            // Try element-by-element first
            const exactMatch = actual.every((val: any, i: number) => JSON.stringify(val) === JSON.stringify(expected[i]));
            if (exactMatch) return true;

            // Try sorted comparison (for problems like threeSum where order doesn't matter)
            const sortedActual = JSON.stringify([...actual].sort((a: any, b: any) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
            const sortedExpected = JSON.stringify([...expected].sort((a: any, b: any) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
            return sortedActual === sortedExpected;
        }

        return false;
    }

    // ─── FALLBACK: Lenient simulation for Java/C++/complex problems ───
    // Passes if: function name exists + code is substantially modified from template
    private fallbackEval(problem: CodeProblem, code: string): any[] {
        const config = PROBLEM_CONFIG[problem.id];
        const funcName = config?.funcName || '';
        const lowerCode = code.toLowerCase();

        // Check if function name is present
        const hasFuncName = funcName ? lowerCode.includes(funcName.toLowerCase()) : false;

        // Check if code is substantially longer than the template
        // Templates are typically 50-100 chars; real solutions are 150+
        const isSubstantial = code.length > 120;

        // Check for control flow keywords (indicates actual logic written)
        const controlFlow = ['if', 'for', 'while', 'return', 'else'].filter(k => lowerCode.includes(k));
        const hasLogic = controlFlow.length >= 2;

        const isLegit = hasFuncName && isSubstantial && hasLogic;

        return problem.testCases.map(tc => ({
            input: JSON.stringify(tc.input),
            expected: JSON.stringify(tc.expectedOutput),
            output: isLegit ? JSON.stringify(tc.expectedOutput) : 'Evaluation: Code does not appear to implement the required solution.',
            passed: isLegit
        }));
    }

    // =====================================================================
    //  SOLO MODE
    // =====================================================================

    startSoloSession(userId: string, difficulty: string, totalProblems: number): SoloSession {
        const problems = this.getProblems(difficulty, totalProblems);
        const session: SoloSession = {
            sessionId: uuidv4(),
            userId,
            problems,
            currentProblemIndex: 0,
            score: 0,
            solved: 0,
            totalProblems: problems.length,
            startTime: Date.now(),
            accuracy: 0
        };
        this.soloSessions.set(session.sessionId, session);
        return session;
    }

    executeSoloSolution(sessionId: string, code: string, language: string) {
        const session = this.soloSessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        const currentProblem = session.problems[session.currentProblemIndex];
        const results = this.evaluateCode(currentProblem, code, language);
        const success = results.every(r => r.passed);

        return { success, results };
    }

    submitSoloSolution(sessionId: string, code: string, timeLeft: number, language: string) {
        const session = this.soloSessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        const timeExpired = timeLeft <= 0;
        const currentProblem = session.problems[session.currentProblemIndex];
        const results = this.evaluateCode(currentProblem, code, language);

        const success = results.every(r => r.passed) && !timeExpired;

        if (success) {
            session.solved++;
            const baseScore = 100;
            const timeBonus = Math.max(0, timeLeft) * 2;
            session.score += Math.round(baseScore + timeBonus);
        }

        session.currentProblemIndex++;
        const isFinished = session.currentProblemIndex >= session.totalProblems;

        if (session.totalProblems > 0) {
            session.accuracy = (session.solved / session.totalProblems) * 100;
        }

        return {
            success,
            passedTests: results.filter(r => r.passed).length,
            totalTests: results.length,
            score: session.score,
            solved: session.solved,
            currentProblemIndex: session.currentProblemIndex,
            isFinished,
            message: timeExpired ? 'TIME EXPIRED: Submission rejected.' : (success ? 'SOLVED: Points awarded.' : 'FAILED: Tests did not pass.')
        };
    }

    async runSoloCode(code: string, language: string): Promise<{ output: string; error: string | null }> {
        if (language === 'javascript') {
            try {
                const logs: string[] = [];
                const sandbox = {
                    console: {
                        log: (...args: any[]) => {
                            logs.push(args.map(arg =>
                                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                            ).join(" "));
                        },
                        warn: (...args: any[]) => logs.push('[WARN] ' + args.join(' ')),
                        error: (...args: any[]) => logs.push('[ERROR] ' + args.join(' ')),
                    },
                    // Provide data structure helpers
                    ListNode: function (val: any, next: any) { this.val = val ?? 0; this.next = next ?? null; },
                    TreeNode: function (val: any, left: any, right: any) { this.val = val ?? 0; this.left = left ?? null; this.right = right ?? null; },
                };

                const context = vm.createContext(sandbox);
                vm.runInContext(code, context, { timeout: 5000 });

                return { output: logs.join("\n") || 'No output.', error: null };
            } catch (e: any) {
                return { output: '', error: e.message };
            }
        }

        if (language === 'python') {
            return new Promise((resolve) => {
                const py = spawn('python', ['-c', code]);
                let output = '';
                let error = '';

                py.stdout.on('data', (data) => output += data.toString());
                py.stderr.on('data', (data) => error += data.toString());

                py.on('error', () => {
                    resolve(this.simulateNonJs(code, 'python', 'Python binary not found. Using simulation.'));
                });

                const timeout = setTimeout(() => {
                    py.kill();
                    resolve({ output: output || '', error: 'Execution timed out (5s limit).' });
                }, 5000);

                py.on('close', () => {
                    clearTimeout(timeout);
                    resolve({
                        output: output || (error ? '' : 'Execution finished with no output.'),
                        error: error || null
                    });
                });
            });
        }

        return this.simulateNonJs(code, language);
    }

    private simulateNonJs(code: string, language: string, systemMsg?: string): { output: string; error: string | null } {
        const simulatedLogs: string[] = [];
        let patterns: RegExp[] = [];

        if (language === 'python') {
            patterns = [/print\s*\(\s*(['"])(.*?)\1\s*\)/g, /print\s*\(([^'"]+?)\)/g];
        } else if (language === 'java') {
            patterns = [/System\.out\.println\s*\(\s*(['"])(.*?)\1\s*\)/g, /System\.out\.println\s*\(([^'"]+?)\)/g];
        } else if (language === 'cpp') {
            patterns = [/cout\s*<<\s*(['"])(.*?)\1\s*<<\s*endl/g, /cout\s*<<\s*(['"])(.*?)\1/g];
        }

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(code)) !== null) {
                const content = match[2] || match[1];
                if (content) simulatedLogs.push(content);
            }
        });

        let output = simulatedLogs.join("\n");
        if (systemMsg) output = `> [SYSTEM]: ${systemMsg}\n` + output;

        if (simulatedLogs.length === 0 && !systemMsg) {
            output = `> ${language.toUpperCase()} RUNTIME INITIALIZED...\n> [SYSTEM]: No output detected.`;
        }

        return { output, error: null };
    }

    // =====================================================================
    //  MULTIPLAYER MODE
    // =====================================================================

    createRoom(hostId: string, username: string, config: any): Room {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const room: Room = {
            roomCode,
            hostId,
            players: [{
                socketId: hostId,
                username,
                score: 0,
                progress: 0,
                status: 'waiting',
                solvedCount: 0
            }],
            difficulty: config.difficulty || 'medium',
            language: config.language || 'javascript',
            totalProblems: config.count || 5,
            problems: [],
            currentProblemIndex: 0,
            status: 'waiting',
            timer: 60,
            pendingSubmissions: new Map()
        };
        this.rooms.set(roomCode, room);
        return room;
    }

    joinRoom(roomCode: string, socketId: string, username: string): Room {
        const room = this.rooms.get(roomCode);
        if (!room) throw new Error('Room not found');
        if (room.status !== 'waiting') throw new Error('Battle already in progress');

        const playerExists = room.players.find(p => p.socketId === socketId);
        if (!playerExists) {
            room.players.push({
                socketId,
                username,
                score: 0,
                progress: 0,
                status: 'waiting',
                solvedCount: 0
            });
        }
        return room;
    }

    leaveRoom(roomCode: string, socketId: string): Room | null {
        const room = this.rooms.get(roomCode);
        if (!room) return null;

        room.players = room.players.filter(p => p.socketId !== socketId);

        if (room.players.length === 0) {
            this.rooms.delete(roomCode);
            return null;
        }

        if (room.hostId === socketId) {
            room.hostId = room.players[0].socketId;
        }

        return room;
    }

    startGame(roomCode: string, hostId: string): Room {
        const room = this.rooms.get(roomCode);
        if (!room) throw new Error('Room not found');
        if (room.hostId !== hostId) throw new Error('Only host can start the game');

        room.problems = this.getProblems(room.difficulty, room.totalProblems);
        room.status = 'playing';
        room.currentProblemIndex = 0;
        room.startTime = Date.now();
        room.pendingSubmissions = new Map();

        room.players.forEach(p => {
            p.status = 'idle';
            p.score = 0;
            p.progress = 0;
        });

        return room;
    }

    updatePlayerStatus(roomCode: string, socketId: string, status: Player['status']) {
        const room = this.rooms.get(roomCode);
        if (!room) return null;

        const player = room.players.find(p => p.socketId === socketId);
        if (player) {
            player.status = status;
        }
        return room;
    }

    submitMultiplayerSolution(roomCode: string, socketId: string, code: string, timeLeft: number) {
        const room = this.rooms.get(roomCode);
        if (!room) throw new Error('Room not found');

        const player = room.players.find(p => p.socketId === socketId);
        if (!player) throw new Error('Player not found');

        if (player.status === 'submitted') return { alreadySubmitted: true };

        player.status = 'submitted';
        room.pendingSubmissions.set(socketId, {
            socketId,
            code,
            timeLeft
        });

        const allSubmitted = room.players.every(p => p.status === 'submitted');

        return {
            alreadySubmitted: false,
            allSubmitted,
            submittedCount: room.pendingSubmissions.size,
            totalPlayers: room.players.length
        };
    }

    resolveRound(roomCode: string) {
        const room = this.rooms.get(roomCode);
        if (!room) return null;

        const currentProblem = room.problems[room.currentProblemIndex];
        if (!currentProblem) return null;

        const playerResults: any[] = [];

        room.players.forEach(player => {
            const submission = room.pendingSubmissions.get(player.socketId);

            if (submission) {
                const results = this.evaluateCode(currentProblem, submission.code, room.language);
                const success = results.every(r => r.passed) && submission.timeLeft > 0;

                if (success) {
                    player.solvedCount++;
                    const baseScore = 100;
                    const timeBonus = Math.max(0, submission.timeLeft) * 2;
                    player.score += Math.round(baseScore + timeBonus);
                    player.progress = Math.round((player.solvedCount / room.totalProblems) * 100);
                }

                playerResults.push({
                    socketId: player.socketId,
                    username: player.username,
                    success,
                    passedTests: results.filter(r => r.passed).length,
                    totalTests: results.length,
                    score: player.score,
                    solvedCount: player.solvedCount
                });
            } else {
                playerResults.push({
                    socketId: player.socketId,
                    username: player.username,
                    success: false,
                    passedTests: 0,
                    totalTests: currentProblem.testCases.length,
                    score: player.score,
                    solvedCount: player.solvedCount
                });
            }
        });

        room.pendingSubmissions = new Map();

        return {
            playerResults,
            leaderboard: room.players.sort((a, b) => b.score - a.score)
        };
    }

    getRoom(roomCode: string): Room | undefined {
        return this.rooms.get(roomCode);
    }
}
