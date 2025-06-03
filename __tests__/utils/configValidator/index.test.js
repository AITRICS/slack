// __tests__/utils/configValidator/index.test.js
/**
 * ConfigValidator 통합 테스트 스위트
 *
 * 이 파일은 모든 개별 테스트 파일들을 임포트하여
 * 전체 ConfigValidator 클래스의 기능을 테스트합니다.
 *
 * 테스트 구조:
 * - validateRequired.test.js: 필수 설정 검증
 * - validateActionType.test.js: 액션 타입 검증
 * - validateActionSpecificConfig.test.js: 액션별 설정 검증
 * - validateTokenFormat.test.js: 토큰 형식 검증
 * - validatePayload.test.js: 페이로드 검증
 * - validateAll.test.js: 통합 검증
 */

// Jest auto-mocking 설정
jest.mock('@actions/core');
jest.mock('../../../utils/errors');
jest.mock('../../../constants');

describe('ConfigValidator 통합 테스트 스위트', () => {
  // 개별 기능 테스트들
  require('./validateRequired.test.js');
  require('./validateActionType.test.js');
  require('./validateActionSpecificConfig.test.js');
  require('./validateTokenFormat.test.js');
  require('./validatePayload.test.js');

  // 통합 테스트는 마지막에 실행
  require('./validateAll.test.js');

  describe('전체 테스트 완료 확인', () => {
    test('모든 ConfigValidator 메서드가 테스트됨', () => {
      const ConfigValidator = require('../../../utils/configValidator');

      // ConfigValidator의 모든 static 메서드가 존재하는지 확인
      expect(typeof ConfigValidator.validateRequired).toBe('function');
      expect(typeof ConfigValidator.validateActionType).toBe('function');
      expect(typeof ConfigValidator.validateActionSpecificConfig).toBe('function');
      expect(typeof ConfigValidator.validateTokenFormat).toBe('function');
      expect(typeof ConfigValidator.validatePayload).toBe('function');
      expect(typeof ConfigValidator.validateAll).toBe('function');
    });
  });
});
