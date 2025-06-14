const { expectErrorWithDetails } = require('@test/helpers');

describe('ConfigValidator.validateActionSpecificConfig', () => {
  let ConfigValidator;

  beforeAll(() => {
    ConfigValidator = require('@/utils/configValidator');
  });

  describe('DEPLOY 액션 검증', () => {
    test('모든 필수 설정이 있으면 에러 없음', () => {
      global.testUtils.mockCoreInputs({
        EC2_NAME: 'test-server',
        IMAGE_TAG: 'v1.0.0',
        JOB_STATUS: 'success',
      });

      expect(() => ConfigValidator.validateActionSpecificConfig('deploy')).not.toThrow();
    });

    test.each([
      [
        { EC2_NAME: '', IMAGE_TAG: 'v1.0.0', JOB_STATUS: 'success' },
        ['EC2_NAME'],
        'EC2_NAME 누락',
      ],
      [
        { EC2_NAME: 'server', IMAGE_TAG: '', JOB_STATUS: 'success' },
        ['IMAGE_TAG'],
        'IMAGE_TAG 누락',
      ],
      [
        { EC2_NAME: 'server', IMAGE_TAG: 'v1.0.0', JOB_STATUS: '' },
        ['JOB_STATUS'],
        'JOB_STATUS 누락',
      ],
      [
        { EC2_NAME: '', IMAGE_TAG: '', JOB_STATUS: 'success' },
        ['EC2_NAME', 'IMAGE_TAG'],
        '다중 설정 누락',
      ],
      [
        { EC2_NAME: '', IMAGE_TAG: '', JOB_STATUS: '' },
        ['EC2_NAME', 'IMAGE_TAG', 'JOB_STATUS'],
        '모든 설정 누락',
      ],
    ])('DEPLOY 설정 누락: %j → %j (%s)', (inputs, expectedMissing, _description) => {
      global.testUtils.mockCoreInputs(inputs);

      expectErrorWithDetails(
        () => ConfigValidator.validateActionSpecificConfig('deploy'),
        `deploy 액션에 필요한 설정이 누락되었습니다: ${expectedMissing.join(', ')}`,
        expectedMissing,
      );
    });
  });

  describe('CI 액션 검증', () => {
    test('모든 필수 설정이 있으면 에러 없음', () => {
      global.testUtils.mockCoreInputs({
        BRANCH_NAME: 'main',
        IMAGE_TAG: 'v1.0.0',
        JOB_NAME: 'build',
        JOB_STATUS: 'success',
      });

      expect(() => ConfigValidator.validateActionSpecificConfig('ci')).not.toThrow();
    });

    test.each([
      [
        {
          BRANCH_NAME: '', IMAGE_TAG: 'v1.0.0', JOB_NAME: 'build', JOB_STATUS: 'success',
        },
        ['BRANCH_NAME'],
        'BRANCH_NAME 누락',
      ],
      [
        {
          BRANCH_NAME: 'main', IMAGE_TAG: '', JOB_NAME: 'build', JOB_STATUS: 'success',
        },
        ['IMAGE_TAG'],
        'IMAGE_TAG 누락',
      ],
    ])('CI 설정 누락: %j → %j (%s)', (inputs, expectedMissing, _description) => {
      global.testUtils.mockCoreInputs(inputs);

      expectErrorWithDetails(
        () => ConfigValidator.validateActionSpecificConfig('ci'),
        `ci 액션에 필요한 설정이 누락되었습니다: ${expectedMissing.join(', ')}`,
        expectedMissing,
      );
    });
  });

  describe('추가 설정이 불필요한 액션들', () => {
    test.each([
      ['schedule', '스케줄 액션'],
      ['approve', '승인 액션'],
      ['comment', '코멘트 액션'],
      ['review_requested', '리뷰 요청 액션'],
      ['changes_requested', '변경 요청 액션'],
    ])('추가 설정 불필요: %s (%s)', (actionType, _description) => {
      const mockCore = require('@actions/core');
      expect(() => ConfigValidator.validateActionSpecificConfig(actionType)).not.toThrow();
      expect(mockCore.getInput).not.toHaveBeenCalled();
    });
  });

  describe('정의되지 않은 액션 (커버리지 보완)', () => {
    test.each([
      ['unknown_action', '알 수 없는 액션'],
      ['invalid', '잘못된 액션'],
      ['custom_action', '커스텀 액션'],
      ['', '빈 문자열 액션'],
      [null, 'null 액션'],
      [undefined, 'undefined 액션'],
    ])('정의되지 않은 액션: %s (%s)', (actionType, _description) => {
      const mockCore = require('@actions/core');
      expect(() => ConfigValidator.validateActionSpecificConfig(actionType)).not.toThrow();
      expect(mockCore.getInput).not.toHaveBeenCalled();
    });
  });

  describe('경계값 및 특수 케이스', () => {
    test('공백 값들 처리 (실제 동작 확인)', () => {
      global.testUtils.mockCoreInputs({
        EC2_NAME: '   ',
        IMAGE_TAG: '\t\n',
        JOB_STATUS: '',
      });

      // 핵심: 에러 발생 자체는 toThrow로
      expect(() => ConfigValidator.validateActionSpecificConfig('deploy'))
        .toThrow(/deploy 액션에 필요한 설정이 누락되었습니다/);

      // 추가: missingFields 타입 검증은 조건문 없이 always expect (fail-safe)
      let thrownError = null;
      try {
        ConfigValidator.validateActionSpecificConfig('deploy');
      } catch (error) {
        thrownError = error;
      }
      expect(Array.isArray(thrownError?.missingFields)).toBe(true);
    });

    test('부분적으로 유효한 값들', () => {
      global.testUtils.mockCoreInputs({
        BRANCH_NAME: 'feature/test',
        IMAGE_TAG: 'v1.0.0-alpha',
        JOB_NAME: 'build,test,deploy',
        JOB_STATUS: 'failure',
      });

      expect(() => ConfigValidator.validateActionSpecificConfig('ci')).not.toThrow();
    });
  });

  describe('성능 테스트', () => {
    // 성공해야 하는 케이스
    test.each([
      ['comment', {}],
      ['schedule', {}],
    ])('액션 %s은(는) 성공해야 한다', (actionType, inputs) => {
      global.testUtils.mockCoreInputs(inputs);
      expect(() => ConfigValidator.validateActionSpecificConfig(actionType)).not.toThrow();
    });

    // 실패해야 하는 케이스
    test.each([
      ['deploy', { EC2_NAME: '' }],
      ['ci', { BRANCH_NAME: '' }],
    ])('액션 %s은(는) 실패해야 한다', (actionType, inputs) => {
      global.testUtils.mockCoreInputs(inputs);
      expect(() => ConfigValidator.validateActionSpecificConfig(actionType)).toThrow();
    });
  });
});
