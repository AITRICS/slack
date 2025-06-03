// jest.config.js - 정규표현식 오류 수정
module.exports = {
  testEnvironment: 'node',

  // 기본 테스트 매칭
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.test.js',
  ],

  // 제외할 파일들 (정규표현식으로 수정)
  testPathIgnorePatterns: [
    '/node_modules/',
    '.*\\/index\\.test\\.js$', // index.test.js 파일들 제외
    '.*\\/index\\.spec\\.collector\\.js$', // index.spec.collector.js 파일들 제외
  ],

  // 필수 경로 매핑만 포함
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@test/(.*)$': '<rootDir>/__tests__/$1',
  },

  // setup 파일 (있는 경우만)
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],

  // 기본 mock 설정
  clearMocks: true,
  restoreMocks: true,

  // 타임아웃
  testTimeout: 10000,

  // 성능 설정
  maxWorkers: '50%',
};
