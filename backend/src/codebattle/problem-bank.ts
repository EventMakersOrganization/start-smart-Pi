import { CodeProblem } from './interfaces/codebattle.interfaces';

export const PROBLEM_BANK: CodeProblem[] = [
    {
        id: "1",
        title: "Reverse a Linked List",
        description: "Given the head of a singly linked list, reverse the list, and return the reversed list.",
        difficulty: "medium",
        languageTemplates: {
            javascript: "/**\n * @param {ListNode} head\n * @return {ListNode}\n */\nvar reverseList = function(head) {\n    // Write your code here\n};",
            python: "class Solution:\n    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:\n        # Write your code here",
            java: "class Solution {\n    public ListNode reverseList(ListNode head) {\n        // Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    ListNode* reverseList(ListNode* head) {\n        // Write your code here\n    }\n};"
        },
        testCases: [
            { input: [1, 2, 3, 4, 5], expectedOutput: [5, 4, 3, 2, 1] },
            { input: [1, 2], expectedOutput: [2, 1] },
            { input: [], expectedOutput: [] }
        ]
    },
    {
        id: "2",
        title: "Two Sum",
        description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
        difficulty: "easy",
        languageTemplates: {
            javascript: "var twoSum = function(nums, target) {\n    // Write your code here\n};",
            python: "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        # Write your code here",
            java: "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your code here\n    }\n};"
        },
        testCases: [
            { input: [[2, 7, 11, 15], 9], expectedOutput: [0, 1] },
            { input: [[3, 2, 4], 6], expectedOutput: [1, 2] },
            { input: [[3, 3], 6], expectedOutput: [0, 1] }
        ]
    },
    {
        id: "3",
        title: "Palindrome Number",
        description: "Given an integer x, return true if x is a palindrome, and false otherwise.",
        difficulty: "easy",
        languageTemplates: {
            javascript: "var isPalindrome = function(x) {\n    // Write your code here\n};",
            python: "class Solution:\n    def isPalindrome(self, x: int) -> bool:\n        # Write your code here",
            java: "class Solution {\n    public boolean isPalindrome(int x) {\n        // Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    bool isPalindrome(int x) {\n        // Write your code here\n    }\n};"
        },
        testCases: [
            { input: 121, expectedOutput: true },
            { input: -121, expectedOutput: false },
            { input: 10, expectedOutput: false }
        ]
    },
    {
        id: "4",
        title: "Valid Parentheses",
        description: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
        difficulty: "easy",
        languageTemplates: {
            javascript: "var isValid = function(s) {\n    // Write your code here\n};",
            python: "class Solution:\n    def isValid(self, s: str) -> bool:\n        # Write your code here",
            java: "class Solution {\n    public boolean isValid(String s) {\n        // Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    bool isValid(string s) {\n        // Write your code here\n    }\n};"
        },
        testCases: [
            { input: "()", expectedOutput: true },
            { input: "()[]{}", expectedOutput: true },
            { input: "(]", expectedOutput: false }
        ]
    },
    {
        id: "5",
        title: "Median of Two Sorted Arrays",
        description: "Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.",
        difficulty: "hard",
        languageTemplates: {
            javascript: "var findMedianSortedArrays = function(nums1, nums2) {\n    // Write your code here\n};",
            python: "class Solution:\n    def findMedianSortedArrays(self, nums1: List[int], nums2: List[int]) -> float:\n        # Write your code here",
            java: "class Solution {\n    public double findMedianSortedArrays(int[] nums1, int[] nums2) {\n        // Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {\n        // Write your code here\n    }\n};"
        },
        testCases: [
            { input: [[1, 3], [2]], expectedOutput: 2.0 },
            { input: [[1, 2], [3, 4]], expectedOutput: 2.5 },
            { input: [[0, 0], [0, 0]], expectedOutput: 0.0 }
        ]
    },
    {
        id: "6",
        title: "Longest Substring Without Repeating Characters",
        description: "Given a string s, find the length of the longest substring without repeating characters.",
        difficulty: "medium",
        languageTemplates: {
            javascript: "var lengthOfLongestSubstring = function(s) {\n    // Write your code here\n};",
            python: "class Solution:\n    def lengthOfLongestSubstring(self, s: str) -> int:\n        # Write your code here",
            java: "class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        // Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    int lengthOfLongestSubstring(string s) {\n        // Write your code here\n    }\n};"
        },
        testCases: [
            { input: "abcabcbb", expectedOutput: 3 },
            { input: "bbbbb", expectedOutput: 1 },
            { input: "pwwkew", expectedOutput: 3 }
        ]
    },
    {
        id: "7",
        title: "String to Integer (atoi)",
        description: "Implement the myAtoi(string s) function, which converts a string to a 32-bit signed integer.",
        difficulty: "medium",
        languageTemplates: {
            javascript: "var myAtoi = function(s) {\n    // Write your code here\n};",
            python: "class Solution:\n    def myAtoi(self, s: str) -> int:\n        # Write your code here",
            java: "class Solution {\n    public int myAtoi(String s) {\n        // Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    int myAtoi(string s) {\n        // Write your code here\n    }\n};"
        },
        testCases: [
            { input: "42", expectedOutput: 42 },
            { input: "   -42", expectedOutput: -42 },
            { input: "4193 with words", expectedOutput: 4193 }
        ]
    },
    {
        id: "8",
        title: "Merge k Sorted Lists",
        description: "You are given an array of k linked-lists lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list and return it.",
        difficulty: "hard",
        languageTemplates: {
            javascript: "var mergeKLists = function(lists) {\n    // Write your code here\n};",
            python: "class Solution:\n    def mergeKLists(self, lists: List[Optional[ListNode]]) -> Optional[ListNode]:\n        # Write your code here",
            java: "class Solution {\n    public ListNode mergeKLists(ListNode[] lists) {\n        // Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    ListNode* mergeKLists(vector<ListNode*>& lists) {\n        // Write your code here\n    }\n};"
        },
        testCases: [
            { input: [[1, 4, 5], [1, 3, 4], [2, 6]], expectedOutput: [1, 1, 2, 3, 4, 4, 5, 6] },
            { input: [], expectedOutput: [] },
            { input: [[]], expectedOutput: [] }
        ]
    },
    {
        id: "9",
        title: "Trapping Rain Water",
        description: "Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.",
        difficulty: "hard",
        languageTemplates: {
            javascript: "var trap = function(height) {\n    // Write your code here\n};",
            python: "class Solution:\n    def trap(self, height: List[int]) -> int:\n        # Write your code here",
            java: "class Solution {\n    public int trap(int[] height) {\n        // Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    int trap(vector<int>& height) {\n        // Write your code here\n    }\n};"
        },
        testCases: [
            { input: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1], expectedOutput: 6 },
            { input: [4, 2, 0, 3, 2, 5], expectedOutput: 9 }
        ]
    },
    {
        id: "10",
        title: "Binary Tree Inorder Traversal",
        description: "Given the root of a binary tree, return the inorder traversal of its nodes' values.",
        difficulty: "easy",
        languageTemplates: {
            javascript: "var inorderTraversal = function(root) {\n    // Write your code here\n};",
            python: "class Solution:\n    def inorderTraversal(self, root: Optional[TreeNode]) -> List[int]:\n        # Write your code here",
            java: "class Solution {\n    public List<Integer> inorderTraversal(TreeNode root) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    vector<int> inorderTraversal(TreeNode* root) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: [1, null, 2, 3], expectedOutput: [1, 3, 2] },
            { input: [], expectedOutput: [] },
            { input: [1], expectedOutput: [1] }
        ]
    },
    {
        id: "11",
        title: "Group Anagrams",
        description: "Given an array of strings strs, group the anagrams together. You can return the answer in any order.",
        difficulty: "medium",
        languageTemplates: {
            javascript: "var groupAnagrams = function(strs) {\n    // Write your code here\n};",
            python: "class Solution:\n    def groupAnagrams(self, strs: List[str]) -> List[List[str]]:\n        # Write your code here",
            java: "class Solution {\n    public List<List<String>> groupAnagrams(String[] strs) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    vector<vector<string>> groupAnagrams(vector<string>& strs) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: ["eat", "tea", "tan", "ate", "nat", "bat"], expectedOutput: [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]] }
        ]
    },
    {
        id: "12",
        title: "N-Queens",
        description: "The n-queens puzzle is the problem of placing n queens on an n x n chessboard such that no two queens attack each other.",
        difficulty: "hard",
        languageTemplates: {
            javascript: "var solveNQueens = function(n) {\n    // Write your code here\n};",
            python: "class Solution:\n    def solveNQueens(self, n: int) -> List[List[str]]:\n        # Write your code here",
            java: "class Solution {\n    public List<List<String>> solveNQueens(int n) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    vector<vector<string>> solveNQueens(int n) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: 4, expectedOutput: [[".Q..", "...Q", "Q...", "..Q."], ["..Q.", "Q...", "...Q", ".Q.."]] },
            { input: 1, expectedOutput: [["Q"]] }
        ]
    },
    {
        id: "13",
        title: "Same Tree",
        description: "Given the roots of two binary trees p and q, write a function to check if they are the same or not.",
        difficulty: "easy",
        languageTemplates: {
            javascript: "var isSameTree = function(p, q) {\n    // Write your code here\n};",
            python: "class Solution:\n    def isSameTree(self, p: Optional[TreeNode], q: Optional[TreeNode]) -> bool:\n        # Write your code here",
            java: "class Solution {\n    public boolean isSameTree(TreeNode p, TreeNode q) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    bool isSameTree(TreeNode* p, TreeNode* q) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: [[1, 2, 3], [1, 2, 3]], expectedOutput: true },
            { input: [[1, 2], [1, null, 2]], expectedOutput: false }
        ]
    },
    {
        id: "14",
        title: "Symmetric Tree",
        description: "Given the root of a binary tree, check whether it is a mirror of itself (i.e., symmetric around its center).",
        difficulty: "easy",
        languageTemplates: {
            javascript: "var isSymmetric = function(root) {\n    // Write your code here\n};",
            python: "class Solution:\n    def isSymmetric(self, root: Optional[TreeNode]) -> bool:\n        # Write your code here",
            java: "class Solution {\n    public boolean isSymmetric(TreeNode root) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    bool isSymmetric(TreeNode* root) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: [1, 2, 2, 3, 4, 4, 3], expectedOutput: true },
            { input: [1, 2, 2, null, 3, null, 3], expectedOutput: false }
        ]
    },
    {
        id: "15",
        title: "3Sum",
        description: "Given an integer array nums, return all the triplets [nums[i], nums[j], nums[k]] such that i != j, i != k, and j != k, and nums[i] + nums[j] + nums[k] == 0.",
        difficulty: "medium",
        languageTemplates: {
            javascript: "var threeSum = function(nums) {\n    // Write your code here\n};",
            python: "class Solution:\n    def threeSum(self, nums: List[int]) -> List[List[int]]:\n        # Write your code here",
            java: "class Solution {\n    public List<List<Integer>> threeSum(int[] nums) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    vector<vector<int>> threeSum(vector<int>& nums) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: [-1, 0, 1, 2, -1, -4], expectedOutput: [[-1, -1, 2], [-1, 0, 1]] }
        ]
    },
    {
        id: "16",
        title: "Search in Rotated Sorted Array",
        description: "There is an integer array nums sorted in ascending order (with distinct values). Prior to being passed to your function, nums is possibly rotated. Given the array nums after the possible rotation and an integer target, return the index of target if it is in nums, or -1 if it is not in nums.",
        difficulty: "medium",
        languageTemplates: {
            javascript: "var search = function(nums, target) {\n    // Write your code here\n};",
            python: "class Solution:\n    def search(self, nums: List[int], target: int) -> int:\n        # Write your code here",
            java: "class Solution {\n    public int search(int[] nums, int target) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    int search(vector<int>& nums, int target) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: [[4, 5, 6, 7, 0, 1, 2], 0], expectedOutput: 4 },
            { input: [[4, 5, 6, 7, 0, 1, 2], 3], expectedOutput: -1 }
        ]
    },
    {
        id: "17",
        title: "Edit Distance",
        description: "Given two strings word1 and word2, return the minimum number of operations required to convert word1 to word2.",
        difficulty: "hard",
        languageTemplates: {
            javascript: "var minDistance = function(word1, word2) {\n    // Write your code here\n};",
            python: "class Solution:\n    def minDistance(self, word1: str, word2: str) -> int:\n        # Write your code here",
            java: "class Solution {\n    public int minDistance(String word1, String word2) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    int minDistance(string word1, string word2) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: ["horse", "ros"], expectedOutput: 3 },
            { input: ["intention", "execution"], expectedOutput: 5 }
        ]
    },
    {
        id: "18",
        title: "Sudoku Solver",
        description: "Write a program to solve a Sudoku puzzle by filling the empty cells.",
        difficulty: "hard",
        languageTemplates: {
            javascript: "var solveSudoku = function(board) {\n    // Write your code here\n};",
            python: "class Solution:\n    def solveSudoku(self, board: List[List[str]]) -> None:\n        # Write your code here",
            java: "class Solution {\n    public void solveSudoku(char[][] board) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    void solveSudoku(vector<vector<char>>& board) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: "board_string", expectedOutput: "solved_string" }
        ]
    },
    {
        id: "19",
        title: "Linked List Cycle",
        description: "Given head, the head of a linked list, determine if the linked list has a cycle in it.",
        difficulty: "easy",
        languageTemplates: {
            javascript: "var hasCycle = function(head) {\n    // Write your code here\n};",
            python: "class Solution:\n    def hasCycle(self, head: Optional[ListNode]) -> bool:\n        # Write your code here",
            java: "class Solution {\n    public boolean hasCycle(ListNode head) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    bool hasCycle(ListNode *head) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: [3, 2, 0, -4], expectedOutput: true },
            { input: [1, 2], expectedOutput: false }
        ]
    },
    {
        id: "20",
        title: "Maximum Depth of Binary Tree",
        description: "Given the root of a binary tree, return its maximum depth.",
        difficulty: "easy",
        languageTemplates: {
            javascript: "var maxDepth = function(root) {\n    // Write your code here\n};",
            python: "class Solution:\n    def maxDepth(self, root: Optional[TreeNode]) -> int:\n        # Write your code here",
            java: "class Solution {\n    public int maxDepth(TreeNode root) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    int maxDepth(TreeNode* root) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: [3, 9, 20, null, null, 15, 7], expectedOutput: 3 }
        ]
    },
    {
        id: "21",
        title: "Single Number",
        description: "Given a non-empty array of integers nums, every element appears twice except for one. Find that single one.",
        difficulty: "easy",
        languageTemplates: {
            javascript: "var singleNumber = function(nums) {\n    // Write your code here\n};",
            python: "class Solution:\n    def singleNumber(self, nums: List[int]) -> int:\n        # Write your code here",
            java: "class Solution {\n    public int singleNumber(int[] nums) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    int singleNumber(vector<int>& nums) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: [2, 2, 1], expectedOutput: 1 },
            { input: [4, 1, 2, 1, 2], expectedOutput: 4 }
        ]
    },
    {
        id: "22",
        title: "Excel Sheet Column Number",
        description: "Given a string columnTitle that represents the column title as appears in an Excel sheet, return its corresponding column number.",
        difficulty: "easy",
        languageTemplates: {
            javascript: "var titleToNumber = function(columnTitle) {\n    // Write your code here\n};",
            python: "class Solution:\n    def titleToNumber(self, columnTitle: str) -> int:\n        # Write your code here",
            java: "class Solution {\n    public int titleToNumber(String columnTitle) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    int titleToNumber(string columnTitle) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: "A", expectedOutput: 1 },
            { input: "AB", expectedOutput: 28 }
        ]
    },
    {
        id: "23",
        title: "Longest Palindromic Substring",
        description: "Given a string s, return the longest palindromic substring in s.",
        difficulty: "medium",
        languageTemplates: {
            javascript: "var longestPalindrome = function(s) {\n    // Write your code here\n};",
            python: "class Solution:\n    def longestPalindrome(self, s: str) -> str:\n        # Write your code here",
            java: "class Solution {\n    public String longestPalindrome(String s) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    string longestPalindrome(string s) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: "babad", expectedOutput: "bab" },
            { input: "cbbd", expectedOutput: "bb" }
        ]
    },
    {
        id: "24",
        title: "Kth Smallest Element in a BST",
        description: "Given the root of a binary search tree, and an integer k, return the kth smallest value in the tree.",
        difficulty: "medium",
        languageTemplates: {
            javascript: "var kthSmallest = function(root, k) {\n    // Write your code here\n};",
            python: "class Solution:\n    def kthSmallest(self, root: Optional[TreeNode], k: int) -> int:\n        # Write your code here",
            java: "class Solution {\n    public int kthSmallest(TreeNode root, int k) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    int kthSmallest(TreeNode* root, int k) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: [[3, 1, 4, null, 2], 1], expectedOutput: 1 }
        ]
    },
    {
        id: "25",
        title: "Product of Array Except Self",
        description: "Given an integer array nums, return an array answer such that answer[i] is equal to the product of all the elements of nums except nums[i].",
        difficulty: "medium",
        languageTemplates: {
            javascript: "var productExceptSelf = function(nums) {\n    // Write your code here\n};",
            python: "class Solution:\n    def productExceptSelf(self, nums: List[int]) -> List[int]:\n        # Write your code here",
            java: "class Solution {\n    public int[] productExceptSelf(int[] nums) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    vector<int> productExceptSelf(vector<int>& nums) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: [1, 2, 3, 4], expectedOutput: [24, 12, 8, 6] }
        ]
    },
    {
        id: "26",
        title: "Spiral Matrix",
        description: "Given an m x n matrix, return all elements of the matrix in spiral order.",
        difficulty: "medium",
        languageTemplates: {
            javascript: "var spiralOrder = function(matrix) {\n    // Write your code here\n};",
            python: "class Solution:\n    def spiralOrder(self, matrix: List[List[int]]) -> List[int]:\n        # Write your code here",
            java: "class Solution {\n    public List<Integer> spiralOrder(int[][] matrix) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    vector<int> spiralOrder(vector<vector<int>>& matrix) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: [[1, 2, 3], [4, 5, 6], [7, 8, 9]], expectedOutput: [1, 2, 3, 6, 9, 8, 7, 4, 5] }
        ]
    },
    {
        id: "27",
        title: "Regular Expression Matching",
        description: "Implement regular expression matching with support for '.' and '*'.",
        difficulty: "hard",
        languageTemplates: {
            javascript: "var isMatch = function(s, p) {\n    // Write your code here\n};",
            python: "class Solution:\n    def isMatch(self, s: str, p: str) -> bool:\n        # Write your code here",
            java: "class Solution {\n    public boolean isMatch(String s, String p) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    bool isMatch(string s, string p) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: ["aa", "a*"], expectedOutput: true },
            { input: ["ab", ".*"], expectedOutput: true }
        ]
    },
    {
        id: "28",
        title: "Longest Valid Parentheses",
        description: "Given a string containing just the characters '(' and ')', find the length of the longest valid (well-formed) parentheses substring.",
        difficulty: "hard",
        languageTemplates: {
            javascript: "var longestValidParentheses = function(s) {\n    // Write your code here\n};",
            python: "class Solution:\n    def longestValidParentheses(self, s: str) -> int:\n        # Write your code here",
            java: "class Solution {\n    public int longestValidParentheses(String s) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    int longestValidParentheses(string s) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: "(()", expectedOutput: 2 },
            { input: ")()())", expectedOutput: 4 }
        ]
    },
    {
        id: "29",
        title: "Burst Balloons",
        description: "You are given n balloons, indexed from 0 to n - 1. Each balloon is painted with a number on it represented by an array nums. You are asked to burst all the balloons.",
        difficulty: "hard",
        languageTemplates: {
            javascript: "var maxCoins = function(nums) {\n    // Write your code here\n};",
            python: "class Solution:\n    def maxCoins(self, nums: List[int]) -> int:\n        # Write your code here",
            java: "class Solution {\n    public int maxCoins(int[] nums) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    int maxCoins(vector<int>& nums) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: [3, 1, 5, 8], expectedOutput: 167 }
        ]
    },
    {
        id: "30",
        title: "Word Break II",
        description: "Given a string s and a dictionary of strings wordDict, add spaces in s to construct a sentence where each word is a valid dictionary word.",
        difficulty: "hard",
        languageTemplates: {
            javascript: "var wordBreak = function(s, wordDict) {\n    // Write your code here\n};",
            python: "class Solution:\n    def wordBreak(self, s: str, wordDict: List[str]) -> List[str]:\n        # Write your code here",
            java: "class Solution {\n    public List<String> wordBreak(String s, List<String> wordDict) {\n        # Write your code here\n    }\n}",
            cpp: "class Solution {\npublic:\n    vector<string> wordBreak(string s, vector<string>& wordDict) {\n        # Write your code here\n    }\n};"
        },
        testCases: [
            { input: ["catsanddog", ["cat", "cats", "and", "sand", "dog"]], expectedOutput: ["cats and dog", "cat sand dog"] }
        ]
    }
];
