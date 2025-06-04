const { expectErrorWithDetails } = require('@test/helpers');

describe('ConfigValidator.validatePayload', () => {
  let ConfigValidator;

  beforeAll(() => {
    ConfigValidator = require('@/utils/configValidator');
  });

  describe('유효한 페이로드', () => {
    test('완전한 페이로드', () => {
      const validPayload = global.testUtils.createMockPayload({
        action: 'opened',
        pull_request: {
          number: 1,
          title: 'Test PR',
        },
        sender: {
          login: 'testuser',
        },
      });

      expect(() => ConfigValidator.validatePayload(validPayload)).not.toThrow();
    });

    test('최소한의 유효한 페이로드', () => {
      const minimalPayload = { repository: {} };
      expect(() => ConfigValidator.validatePayload(minimalPayload)).not.toThrow();
    });

    test('repository만 있는 페이로드', () => {
      const repoOnlyPayload = { repository: { name: 'test' } };
      expect(() => ConfigValidator.validatePayload(repoOnlyPayload)).not.toThrow();
    });
  });

  describe('유효하지 않은 페이로드 타입', () => {
    test.each([
      [[], ['payload'], '유효하지 않은 페이로드', '빈 배열'],
      [[1, 2, 3], ['payload'], '유효하지 않은 페이로드', '배열'],
      [new Date(), ['payload'], '유효하지 않은 페이로드', 'Date'],
      ['string', ['payload'], '유효하지 않은 페이로드', '문자열'],
    ])('유효하지 않은 페이로드 타입: %s → %j (%s)', (payload, expectedMissingFields, expectedMessage, _description) => {
      expect.assertions(1);
      expectErrorWithDetails(
        () => ConfigValidator.validatePayload(payload),
        expectedMessage,
        expectedMissingFields,
      );
    });
  });

  describe('repository 누락 케이스 (배열 및 객체)', () => {
    test.each([
      [[], ['payload'], '유효하지 않은 페이로드', '빈 배열'],
      [[1, 2, 3], ['payload'], '유효하지 않은 페이로드', '배열'],
      [new Date(), ['payload'], '유효하지 않은 페이로드', 'Date 객체'],
      ['문자열', ['payload'], '유효하지 않은 페이로드', '문자열'],
      [123, ['payload'], '유효하지 않은 페이로드', '숫자'],
      [{ action: 'opened' }, ['payload.repository'], '페이로드에 repository 정보가 없습니다', 'repository 정보 누락'],
      [{ repository: null }, ['payload.repository'], '페이로드에 repository 정보가 없습니다', 'repository가 null'],
      [{}, ['payload.repository'], '페이로드에 repository 정보가 없습니다', '빈 객체'],
    ])('repository 누락 페이로드: %j → %j (%s)', (payload, expectedMissingFields, expectedMessage, _description) => {
      expect.assertions(1);
      expectErrorWithDetails(
        () => ConfigValidator.validatePayload(payload),
        expectedMessage,
        expectedMissingFields,
      );
    });
  });

  describe('경계값 및 특수 케이스', () => {
    test('repository가 빈 객체인 경우는 유효', () => {
      const payloadWithEmptyRepo = {
        repository: {},
        action: 'opened',
      };

      expect(() => ConfigValidator.validatePayload(payloadWithEmptyRepo)).not.toThrow();
    });

    test('특수 문자가 포함된 repository 정보', () => {
      const payloadWithSpecialChars = {
        repository: {
          name: 'test-repo_123.special',
          full_name: 'owner-123/test-repo_123.special',
          description: 'Test repo with émojis 🚀 and spëcial chars',
        },
      };

      expect(() => ConfigValidator.validatePayload(payloadWithSpecialChars)).not.toThrow();
    });
  });

  describe('GitHub 웹훅 실제 사례', () => {
    test('Pull Request 이벤트 페이로드', () => {
      const prPayload = {
        action: 'opened',
        number: 123,
        pull_request: {
          id: 456,
          number: 123,
          title: 'Add new feature',
          body: 'This PR adds a new feature',
          user: {
            login: 'contributor',
          },
        },
        repository: {
          id: 789,
          name: 'test-repo',
          full_name: 'org/test-repo',
          owner: {
            login: 'org',
          },
        },
        sender: {
          login: 'contributor',
        },
      };

      expect(() => ConfigValidator.validatePayload(prPayload)).not.toThrow();
    });
  });

  describe('성능 테스트 (완화된 기준)', () => {
    test('대량의 페이로드를 처리', () => {
      const payloads = Array.from({ length: 100 }, (_, i) => ({
        repository: { name: `repo_${i}` },
        action: `action_${i}`,
      }));

      const start = Date.now();
      payloads.forEach((payload) => {
        expect(() => ConfigValidator.validatePayload(payload)).not.toThrow();
      });
      const duration = Date.now() - start;

      // 완화된 기준: 100개 처리에 100ms 이내
      expect(duration).toBeLessThan(100);
    });
  });
});
