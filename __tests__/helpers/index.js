/**
 * 예외와 예외 내용을 함께 검증하는 헬퍼
 * @param {Function} fn - 실행할 함수
 * @param {string} expectedMessage - 예상 에러 메시지
 * @param {Array} expectedMissingFields - 예상 누락 필드
 * @returns {Error} 발생한 에러 객체
 */
const expectErrorWithDetails = (fn, expectedMessage, expectedMissingFields = []) => {
  let thrownError;
  expect(() => {
    try {
      fn();
    } catch (error) {
      thrownError = error;
      throw error;
    }
  }).toThrow();

  expect(thrownError).toBeDefined();
  expect(thrownError.message).toBe(expectedMessage);

  if (expectedMissingFields.length > 0) {
    expect(thrownError.missingFields).toEqual(expectedMissingFields);
  }

  return thrownError;
};

/**
 * 비동기 함수의 에러를 안전하게 테스트
 * @param {Function} asyncFn - 테스트할 비동기 함수
 * @param {string} expectedMessage - 예상 에러 메시지 (포함 확인)
 * @returns {Promise<Error>} 발생한 에러
 */
const expectAsyncError = async (asyncFn, expectedMessage) => {
  let thrownError;
  try {
    await asyncFn();
  } catch (error) {
    thrownError = error;
  }

  expect(thrownError).toBeDefined();
  if (expectedMessage) {
    expect(thrownError.message).toContain(expectedMessage);
  }

  return thrownError;
};

/**
 * 정확한 에러 메시지 매칭을 위한 비동기 헬퍼
 * @param {Function} asyncFn - 테스트할 비동기 함수
 * @param {string} exactMessage - 정확한 에러 메시지
 * @param {Array} expectedMissingFields - 예상 누락 필드
 * @returns {Promise<Error>} 발생한 에러
 */
const expectAsyncErrorExact = async (asyncFn, exactMessage, expectedMissingFields = []) => {
  let thrownError;
  try {
    await asyncFn();
  } catch (error) {
    thrownError = error;
  }

  expect(thrownError).toBeDefined();
  expect(thrownError.message).toBe(exactMessage);

  if (expectedMissingFields.length > 0) {
    expect(thrownError.missingFields).toEqual(expectedMissingFields);
  }

  return thrownError;
};

/**
 * 모든 Promise가 완료될 때까지 대기
 * @param {number} ms - 대기 시간 (밀리초)
 * @returns {Promise<void>}
 */
const wait = (ms = 0) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

/**
 * 다음 tick까지 대기
 * @returns {Promise<void>}
 */
const nextTick = () => new Promise((resolve) => {
  process.nextTick(resolve);
});

/**
 * 마이크로태스크 큐까지 대기
 * @returns {Promise<void>}
 */
const waitForMicrotasks = () => Promise.resolve();

/**
 * 성능 측정 헬퍼
 * @param {Function} fn - 측정할 함수
 * @param {number} iterations - 반복 횟수 (기본: 1)
 * @returns {Object} 실행 시간과 결과
 */
const measurePerformance = (fn, iterations = 1) => {
  const start = process.hrtime.bigint();
  let result;

  for (let i = 0; i < iterations; i++) {
    result = fn();
  }

  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1_000_000; // 나노초를 밀리초로 변환

  return {
    duration: durationMs,
    averageDuration: durationMs / iterations,
    result,
    iterations,
  };
};

/**
 * 비동기 성능 측정 헬퍼
 * @param {Function} asyncFn - 측정할 비동기 함수
 * @param {number} iterations - 반복 횟수 (기본: 1)
 * @returns {Promise<Object>} 실행 시간과 결과
 */
const measureAsyncPerformance = async (asyncFn, iterations = 1) => {
  const start = process.hrtime.bigint();
  let result;

  for (let i = 0; i < iterations; i++) {
    result = await asyncFn();
  }

  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1_000_000;

  return {
    duration: durationMs,
    averageDuration: durationMs / iterations,
    result,
    iterations,
  };
};

/**
 * 메모리 사용량 측정 헬퍼
 * @param {Function} fn - 측정할 함수
 * @returns {Object} 메모리 사용량과 결과
 */
const measureMemoryUsage = (fn) => {
  const initialMemory = process.memoryUsage();
  const result = fn();
  const finalMemory = process.memoryUsage();

  return {
    result,
    memoryDelta: {
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      external: finalMemory.external - initialMemory.external,
      arrayBuffers: finalMemory.arrayBuffers - initialMemory.arrayBuffers,
    },
    initialMemory,
    finalMemory,
  };
};

/**
 * 랜덤 테스트 데이터 생성 헬퍼
 */
const createRandomData = {
  /**
   * 랜덤 문자열 생성
   * @param {number} length - 문자열 길이
   * @param {string} charset - 사용할 문자 집합
   * @returns {string}
   */
  string: (length = 10, charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') => {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  },

  /**
   * 랜덤 정수 생성
   * @param {number} min - 최솟값
   * @param {number} max - 최댓값
   * @returns {number}
   */
  integer: (min = 0, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min,

  /**
   * 랜덤 배열 요소 선택
   * @param {Array} array - 선택할 배열
   * @returns {*}
   */
  choice: (array) => array[Math.floor(Math.random() * array.length)],

  /**
   * 랜덤 토큰 생성
   * @param {string} type - 토큰 타입 ('slack' | 'github')
   * @returns {string}
   */
  token: (type = 'github') => {
    if (type === 'slack') {
      const prefix = createRandomData.choice(['xoxb-', 'xoxp-']);
      return prefix + createRandomData.string(40, 'abcdefghijklmnopqrstuvwxyz0123456789');
    }

    if (type === 'github') {
      const prefixes = ['ghp_', 'github_pat_', 'gho_', 'ghs_'];
      const prefix = createRandomData.choice(prefixes);
      const length = createRandomData.integer(20, 80);
      return prefix + createRandomData.string(length, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_');
    }

    return createRandomData.string(createRandomData.integer(20, 50));
  },
};

/**
 * 병렬 테스트 실행 헬퍼
 * @param {Array<Function>} testFunctions - 실행할 테스트 함수들
 * @param {number} concurrency - 동시 실행 수 (기본: 4)
 * @returns {Promise<Array>} 모든 결과
 */
const runConcurrentTests = async (testFunctions, concurrency = 4) => {
  const results = [];

  for (let i = 0; i < testFunctions.length; i += concurrency) {
    const batch = testFunctions.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((fn) => Promise.resolve().then(fn)),
    );
    results.push(...batchResults);
  }

  return results;
};

/**
 * 테스트 격리 헬퍼 (환경 변수, 모듈 캐시 등)
 * @param {Function} testFn - 격리된 환경에서 실행할 테스트
 * @returns {Promise<*>} 테스트 결과
 */
const runIsolated = async (testFn) => {
  // 환경 변수 백업
  const originalEnv = { ...process.env };

  // 모듈 캐시 백업 (필요한 경우)
  const originalModules = Object.keys(require.cache);

  try {
    return await testFn();
  } finally {
    // 환경 변수 복원
    process.env = originalEnv;

    // 새로 추가된 모듈 캐시 정리
    Object.keys(require.cache).forEach((key) => {
      if (!originalModules.includes(key)) {
        delete require.cache[key];
      }
    });
  }
};

/**
 * 재시도 테스트 헬퍼 (불안정한 테스트용)
 * @param {Function} testFn - 재시도할 테스트 함수
 * @param {number} maxRetries - 최대 재시도 횟수
 * @param {number} delay - 재시도 간 지연 시간 (ms)
 * @returns {Promise<*>} 테스트 결과
 */
const retryTest = async (testFn, maxRetries = 3, delay = 100) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await testFn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await wait(delay);
      }
    }
  }

  throw lastError;
};

module.exports = {
  expectErrorWithDetails,
  expectAsyncError,
  expectAsyncErrorExact,
  wait,
  nextTick,
  waitForMicrotasks,
  measurePerformance,
  measureAsyncPerformance,
  measureMemoryUsage,
  createRandomData,
  runConcurrentTests,
  runIsolated,
  retryTest,
};
