const { expectErrorWithDetails } = require('@test/helpers');

describe('ConfigValidator.validateRequired', () => {
  let ConfigValidator;

  beforeAll(() => {
    ConfigValidator = require('@/utils/configValidator');
  });

  test('모든 필수 설정이 있으면 true 반환', () => {
    const validInputs = {
      SLACK_TOKEN: 'xoxb-test-token',
      GITHUB_TOKEN: 'ghp_test_token_1234567890',
      ACTION_TYPE: 'comment',
    };

    global.testUtils.mockCoreInputs(validInputs);

    expect(ConfigValidator.validateRequired()).toBe(true);
  });

  test.each([
    [
      { SLACK_TOKEN: '', GITHUB_TOKEN: 'token', ACTION_TYPE: 'comment' },
      ['SLACK_TOKEN'],
      'SLACK_TOKEN 단일 누락',
    ],
    [
      { SLACK_TOKEN: 'token', GITHUB_TOKEN: '', ACTION_TYPE: 'comment' },
      ['GITHUB_TOKEN'],
      'GITHUB_TOKEN 단일 누락',
    ],
    [
      { SLACK_TOKEN: 'token', GITHUB_TOKEN: 'token', ACTION_TYPE: '' },
      ['ACTION_TYPE'],
      'ACTION_TYPE 단일 누락',
    ],
    [
      { SLACK_TOKEN: '', GITHUB_TOKEN: '', ACTION_TYPE: 'comment' },
      ['SLACK_TOKEN', 'GITHUB_TOKEN'],
      '다중 설정 누락',
    ],
    [
      { SLACK_TOKEN: '', GITHUB_TOKEN: '', ACTION_TYPE: '' },
      ['SLACK_TOKEN', 'GITHUB_TOKEN', 'ACTION_TYPE'],
      '모든 설정 누락',
    ],
  ])('필수 설정 누락: %j → %j (%s)', (inputs, expectedMissing, _description) => {
    expect.assertions(1);
    global.testUtils.mockCoreInputs(inputs);

    expectErrorWithDetails(
      () => ConfigValidator.validateRequired(),
      `필수 설정 누락: ${expectedMissing.join(', ')}`,
      expectedMissing,
    );
  });

  test('null/undefined 값도 누락으로 처리', () => {
    expect.assertions(1);

    global.testUtils.mockCoreInputs({
      SLACK_TOKEN: null,
      GITHUB_TOKEN: undefined,
      ACTION_TYPE: 'comment',
    });

    expectErrorWithDetails(
      () => ConfigValidator.validateRequired(),
      '필수 설정 누락: SLACK_TOKEN, GITHUB_TOKEN',
      ['SLACK_TOKEN', 'GITHUB_TOKEN'],
    );
  });

  test('공백 문자열은 누락으로 처리', () => {
    expect.assertions(1);

    global.testUtils.mockCoreInputs({
      SLACK_TOKEN: '   ',
      GITHUB_TOKEN: '\t\n',
      ACTION_TYPE: '',
    });

    expectErrorWithDetails(
      () => ConfigValidator.validateRequired(),
      '필수 설정 누락: SLACK_TOKEN, GITHUB_TOKEN, ACTION_TYPE',
      ['SLACK_TOKEN', 'GITHUB_TOKEN', 'ACTION_TYPE'],
    );
  });

  describe('경계값 테스트', () => {
    test('최소한의 유효한 값들', () => {
      global.testUtils.mockCoreInputs({
        SLACK_TOKEN: 'x',
        GITHUB_TOKEN: 'g',
        ACTION_TYPE: 'c',
      });

      expect(() => ConfigValidator.validateRequired()).not.toThrow();
    });

    test('매우 긴 값들도 처리 가능', () => {
      global.testUtils.mockCoreInputs({
        SLACK_TOKEN: 'x'.repeat(1000),
        GITHUB_TOKEN: 'g'.repeat(1000),
        ACTION_TYPE: 'very_long_action_type_name',
      });

      expect(() => ConfigValidator.validateRequired()).not.toThrow();
    });
  });

  describe('성능 테스트', () => {
    test('반복적인 검증이 빠름', () => {
      const validInputs = {
        SLACK_TOKEN: 'xoxb-test',
        GITHUB_TOKEN: 'ghp_test_token_1234567890',
        ACTION_TYPE: 'comment',
      };

      global.testUtils.mockCoreInputs(validInputs);

      const start = Date.now();
      for (let i = 0; i < 100; i += 1) {
        expect(ConfigValidator.validateRequired()).toBe(true);
      }
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50);
    });
  });
});
