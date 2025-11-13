/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

describe('errors.SlackNotificationError', () => {
  let SlackNotificationError;

  beforeAll(() => {
    ({ SlackNotificationError } = require('@/utils/errors'));
  });

  describe('기본 생성자 동작', () => {
    test('필수 매개변수로 에러 생성', () => {
      const error = new SlackNotificationError('Test error', 'TEST_ERROR');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SlackNotificationError);
      expect(error.name).toBe('SlackNotificationError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({});
      expect(typeof error.timestamp).toBe('string');
      expect(error.timestamp).toBeDefined();
    });

    test('모든 매개변수로 에러 생성', () => {
      const details = { userId: '123', action: 'send' };
      const cause = new Error('Original error');
      const options = { cause };

      const error = new SlackNotificationError('Test error', 'TEST_ERROR', details, options);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual(details);
      expect(error.cause).toBe(cause);
      expect(error.timestamp).toBeDefined();
    });
  });

  describe('기본값 처리', () => {
    test('details 기본값은 빈 객체', () => {
      const error = new SlackNotificationError('Test', 'TEST');
      expect(error.details).toEqual({});
    });

    test('details가 null이면 빈 객체로 처리', () => {
      const error = new SlackNotificationError('Test', 'TEST', null);
      expect(error.details).toEqual({});
    });

    test('options가 생략되면 cause는 undefined', () => {
      const error = new SlackNotificationError('Test', 'TEST', {});
      expect(error.cause).toBeUndefined();
    });
  });

  describe('타임스탬프', () => {
    test('타임스탬프는 ISO 형식 문자열', () => {
      const error = new SlackNotificationError('Test', 'TEST');
      const isoRegex =
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

      expect(error.timestamp).toMatch(isoRegex);
    });

    test('타임스탬프는 유효한 Date로 파싱 가능', () => {
      const error = new SlackNotificationError('Test', 'TEST');
      const parsed = new Date(error.timestamp);

      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getTime()).not.toBeNaN();
    });
  });

  describe('cause 옵션 처리', () => {
    test('cause가 있으면 에러 체이닝', () => {
      const originalError = new Error('Original error');
      const error = new SlackNotificationError(
        'Wrapper error',
        'WRAPPER',
        { foo: 'bar' },
        { cause: originalError },
      );

      expect(error.cause).toBe(originalError);
      expect(error.message).toBe('Wrapper error');
      expect(error.code).toBe('WRAPPER');
    });

    test('cause가 없으면 undefined', () => {
      const error = new SlackNotificationError('Test', 'TEST');
      expect(error.cause).toBeUndefined();
    });
  });

  describe('에러 타입 및 메타데이터', () => {
    test('Error / SlackNotificationError 타입과 name 확인', () => {
      const error = new SlackNotificationError('Test', 'TEST');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof SlackNotificationError).toBe(true);
      expect(error.name).toBe('SlackNotificationError');
    });
  });

  describe('JSON 직렬화', () => {
    test('JSON.stringify 시 커스텀 필드가 포함된다', () => {
      const error = new SlackNotificationError('Test', 'TEST', { key: 'value' });

      const json = JSON.stringify(error);
      const parsed = JSON.parse(json);

      // Error 기본 필드는 구현에 따라 달라질 수 있으므로
      // 우리 쪽에서 추가한 필드들만 검증
      expect(parsed.code).toBe('TEST');
      expect(parsed.details).toEqual({ key: 'value' });
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe('스택 트레이스', () => {
    test('스택 트레이스가 생성됨', () => {
      const error = new SlackNotificationError('Test', 'TEST');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('SlackNotificationError');
    });
  });

  describe('실제 사용 시나리오', () => {
    test('Slack API 호출 실패 시나리오', () => {
      const apiError = new Error('Network timeout');
      const details = {
        endpoint: '/api/slack/send',
        method: 'POST',
        timeout: 5000,
        retryCount: 3,
      };

      const error = new SlackNotificationError(
        'Slack API 호출 실패',
        'API_CALL_FAILED',
        details,
        { cause: apiError },
      );

      expect(error.message).toBe('Slack API 호출 실패');
      expect(error.code).toBe('API_CALL_FAILED');
      expect(error.details.endpoint).toBe('/api/slack/send');
      expect(error.cause).toBe(apiError);
    });

    test('설정 누락 시나리오', () => {
      const details = {
        missingFields: ['SLACK_TOKEN', 'CHANNEL_ID'],
        providedFields: ['GITHUB_TOKEN'],
      };

      const error = new SlackNotificationError(
        '필수 설정이 누락되었습니다',
        'MISSING_CONFIG',
        details,
      );

      expect(error.details.missingFields).toEqual(['SLACK_TOKEN', 'CHANNEL_ID']);
      expect(error.details.providedFields).toEqual(['GITHUB_TOKEN']);
    });
  });
});
