// __tests__/setup.js
// Jest 전역 설정 및 공통 Mock 설정

// 공통 Mock 설정
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
}));

// jest.mock('@/utils/errors', () => ({
//   ConfigurationError: class extends Error {
//     constructor(message, missingFields = []) {
//       super(message);
//       this.name = 'ConfigurationError';
//       this.missingFields = missingFields;
//     }
//   },
//   ValidationError: class extends Error {
//     constructor(message, field) {
//       super(message);
//       this.name = 'ValidationError';
//       this.field = field;
//     }
//   },
// }));

jest.mock('@/constants', () => ({
  ACTION_TYPES: {
    SCHEDULE: 'schedule',
    APPROVE: 'approve',
    COMMENT: 'comment',
    REVIEW_REQUESTED: 'review_requested',
    CHANGES_REQUESTED: 'changes_requested',
    DEPLOY: 'deploy',
    CI: 'ci',
  },
}));

// 전역 beforeEach 설정
beforeEach(() => {
  // 모든 테스트 전에 mock 초기화
  jest.clearAllMocks();

  // 환경 변수 초기화
  process.env = { ...process.env };

  // Console spy 설정 (필요시)
  if (global.consoleSpy) {
    global.consoleSpy.mockClear();
  }
});

// 전역 afterEach 설정
afterEach(() => {
  // 각 테스트 후 정리
  jest.restoreAllMocks();
});

// 공통 유틸리티 함수들
global.testUtils = {
  // Mock 데이터 생성 헬퍼
  createMockPayload: (overrides = {}) => ({
    repository: {
      name: 'test-repo',
      full_name: 'owner/test-repo',
      html_url: 'https://github.com/owner/test-repo',
    },
    action: 'opened',
    ...overrides,
  }),

  // Core.getInput Mock 헬퍼
  mockCoreInputs: (inputs) => {
    const mockCore = require('@actions/core');
    mockCore.getInput.mockImplementation((key) => inputs[key] || '');
    return mockCore;
  },

  // 유효한 토큰 생성 헬퍼
  createValidTokens: () => ({
    SLACK_TOKEN: 'xoxb-test-token-1234567890',
    GITHUB_TOKEN: 'ghp_test_token_1234567890abcdefghijklmnopqrstuvwxyz',
  }),
};
