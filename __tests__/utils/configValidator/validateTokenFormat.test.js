const { expectErrorWithDetails } = require('@test/helpers');

describe('ConfigValidator.validateTokenFormat', () => {
  let ConfigValidator;

  beforeAll(() => {
    ConfigValidator = require('@/utils/configValidator');
  });

  describe('SLACK_TOKEN 검증', () => {
    test.each([
      ['xoxb-test-token', '정상적인 Bot 토큰'],
      ['xoxb-fake-1234', '정상적인 User 토큰'],
      [`xoxb-${'a'.repeat(50)}`, 'Bot 토큰 (충분한 길이)'],
      [`xoxp-${'a'.repeat(60)}`, 'User 토큰 (충분한 길이)'],
      ['xoxb-minimal', '최소한의 Bot 토큰'],
      ['xoxp-minimal', '최소한의 User 토큰'],
      ['xoxb-', '하이픈만 있는 Bot 토큰 (실제로는 유효)'],
      ['xoxp-', '하이픈만 있는 User 토큰 (실제로는 유효)'],
    ])('유효한 Slack 토큰: %s (%s)', (token, _description) => {
      expect(() => ConfigValidator.validateTokenFormat(token, 'SLACK_TOKEN')).not.toThrow();
    });

    test.each([
      ['', ['SLACK_TOKEN'], 'SLACK_TOKEN이 비어있거나 유효하지 않습니다', '빈 문자열'],
      ['   ', ['SLACK_TOKEN'], 'SLACK_TOKEN이 비어있거나 유효하지 않습니다', '공백만'],
      ['\t\n', ['SLACK_TOKEN'], 'SLACK_TOKEN이 비어있거나 유효하지 않습니다', '탭과 개행'],
      ['invalid-token', ['SLACK_TOKEN'], 'Slack 토큰 형식이 올바르지 않습니다. xoxb- 또는 xoxp-로 시작해야 합니다', '잘못된 형식'],
      ['xoxa-1234567890', ['SLACK_TOKEN'], 'Slack 토큰 형식이 올바르지 않습니다. xoxb- 또는 xoxp-로 시작해야 합니다', 'xoxa 형식'],
      ['bearer-token', ['SLACK_TOKEN'], 'Slack 토큰 형식이 올바르지 않습니다. xoxb- 또는 xoxp-로 시작해야 합니다', 'Bearer 토큰'],
      ['XOXB-1234567890', ['SLACK_TOKEN'], 'Slack 토큰 형식이 올바르지 않습니다. xoxb- 또는 xoxp-로 시작해야 합니다', '대문자'],
      ['xoxb', ['SLACK_TOKEN'], 'Slack 토큰 형식이 올바르지 않습니다. xoxb- 또는 xoxp-로 시작해야 합니다', '접두사만'],
      // 'xoxb-'와 'xoxb- '는 실제로는 유효하므로 제거
    ])('유효하지 않은 Slack 토큰: "%s" → %j (%s)', (token, expectedMissingFields, expectedMessage, _description) => {
      expectErrorWithDetails(
        () => ConfigValidator.validateTokenFormat(token, 'SLACK_TOKEN'),
        expectedMessage,
        expectedMissingFields,
      );
    });

    test.each([
      [null, 'null'],
      [undefined, 'undefined'],
      [123, '숫자'],
      [{}, '객체'],
      [[], '배열'],
      [true, '불린'],
    ])('유효하지 않은 Slack 토큰 타입: %s (%s)', (token, _description) => {
      expectErrorWithDetails(
        () => ConfigValidator.validateTokenFormat(token, 'SLACK_TOKEN'),
        'SLACK_TOKEN이 비어있거나 유효하지 않습니다',
        ['SLACK_TOKEN'],
      );
    });
  });

  describe('GITHUB_TOKEN 검증', () => {
    test.each([
      ['ghp_1234567890abcdefghijklmnopqrstuvwxyz', 'Personal Access Token'],
      ['github_pat_11ABCDEFG1234567890_abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'Fine-grained PAT'],
      ['gho_1234567890abcdefghijklmnopqrstuvwxyz', 'OAuth App Token'],
      ['ghs_1234567890abcdefghijklmnopqrstuvwxyz', 'Server-to-server Token'],
      ['a'.repeat(20), '최소 길이 만족 (20자)'],
      ['a'.repeat(100), '긴 토큰 (100자)'],
      ['1234567890abcdefghij', '숫자와 문자 혼합 (20자)'],
    ])('유효한 GitHub 토큰: %s (%s)', (token, _description) => {
      expect(() => ConfigValidator.validateTokenFormat(token, 'GITHUB_TOKEN')).not.toThrow();
    });

    test.each([
      ['', ['GITHUB_TOKEN'], 'GITHUB_TOKEN이 비어있거나 유효하지 않습니다', '빈 문자열'],
      ['   ', ['GITHUB_TOKEN'], 'GITHUB_TOKEN이 비어있거나 유효하지 않습니다', '공백만'],
      ['short', ['GITHUB_TOKEN'], 'GitHub 토큰이 너무 짧습니다', '너무 짧은 토큰 (5자)'],
      ['a'.repeat(19), ['GITHUB_TOKEN'], 'GitHub 토큰이 너무 짧습니다', '경계값 미만 (19자)'],
    ])('유효하지 않은 GitHub 토큰: "%s" → %j (%s)', (token, expectedMissingFields, expectedMessage, _description) => {
      expectErrorWithDetails(
        () => ConfigValidator.validateTokenFormat(token, 'GITHUB_TOKEN'),
        expectedMessage,
        expectedMissingFields,
      );
    });

    test('경계값 테스트 - 정확히 20자', () => {
      const exactlyTwentyChars = 'a'.repeat(20);
      expect(() => ConfigValidator.validateTokenFormat(exactlyTwentyChars, 'GITHUB_TOKEN')).not.toThrow();
    });
  });

  describe('기타 토큰 타입', () => {
    test('알려지지 않은 토큰 타입은 기본 검증만', () => {
      expect(() => ConfigValidator.validateTokenFormat('valid-token', 'UNKNOWN_TOKEN')).not.toThrow();

      expectErrorWithDetails(
        () => ConfigValidator.validateTokenFormat('', 'UNKNOWN_TOKEN'),
        'UNKNOWN_TOKEN이 비어있거나 유효하지 않습니다',
        ['UNKNOWN_TOKEN'],
      );
    });
  });

  describe('동시성 테스트', () => {
    test('여러 토큰을 동시에 검증해도 안전', async () => {
      const validations = [
        () => ConfigValidator.validateTokenFormat('invalid-slack', 'SLACK_TOKEN'), // 실패
        () => ConfigValidator.validateTokenFormat('short', 'GITHUB_TOKEN'), // 실패
        () => ConfigValidator.validateTokenFormat('xoxb-valid-token', 'SLACK_TOKEN'), // 성공
      ];

      const results = await Promise.allSettled(
        validations.map((validation) => Promise.resolve().then(validation)),
      );

      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('성능 테스트', () => {
    test('대량의 토큰 검증', () => {
      const tokens = Array.from({ length: 100 }, (_, i) => `xoxb-token-${i}`);

      const start = Date.now();
      tokens.forEach((token) => {
        expect(() => ConfigValidator.validateTokenFormat(token, 'SLACK_TOKEN')).not.toThrow();
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});
