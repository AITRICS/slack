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
      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('string');
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

    test('options 기본값은 빈 객체', () => {
      const error = new SlackNotificationError('Test', 'TEST', {});
      expect(error.cause).toBeUndefined();
    });

    test('details가 null이면 기본값 적용', () => {
      const error = new SlackNotificationError('Test', 'TEST', null);
      expect(error.details).toEqual({});
    });
  });

  describe('타임스탬프 생성', () => {
    test('타임스탬프는 ISO 형식', () => {
      const error = new SlackNotificationError('Test', 'TEST');
      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(error.timestamp).toMatch(timestampRegex);
    });

    test('각 에러마다 다른 타임스탬프 (시간 차이)', async () => {
      const error1 = new SlackNotificationError('Test1', 'TEST1');
      await new Promise((resolve) => { setTimeout(resolve, 1); });
      const error2 = new SlackNotificationError('Test2', 'TEST2');

      expect(error1.timestamp).not.toBe(error2.timestamp);
    });

    test('타임스탬프는 유효한 Date로 파싱 가능', () => {
      const error = new SlackNotificationError('Test', 'TEST');
      const parsedDate = new Date(error.timestamp);
      expect(parsedDate).toBeInstanceOf(Date);
      expect(parsedDate.getTime()).not.toBeNaN();
    });
  });

  describe('cause 옵션 처리', () => {
    test('cause가 있으면 에러 체이닝', () => {
      const originalError = new Error('Original error');
      const error = new SlackNotificationError('Wrapper error', 'WRAPPER', {}, { cause: originalError });

      expect(error.cause).toBe(originalError);
      expect(error.message).toBe('Wrapper error');
    });

    test('cause가 없으면 undefined', () => {
      const error = new SlackNotificationError('Test', 'TEST');
      expect(error.cause).toBeUndefined();
    });

    test('options에 다른 속성이 있어도 cause만 처리', () => {
      const options = { cause: new Error('Cause'), other: 'ignored' };
      const error = new SlackNotificationError('Test', 'TEST', {}, options);

      expect(error.cause).toBeInstanceOf(Error);
      expect(error.other).toBeUndefined();
    });
  });

  describe('스택 트레이스', () => {
    test('스택 트레이스가 생성됨', () => {
      const error = new SlackNotificationError('Test', 'TEST');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('SlackNotificationError');
    });

    test('cause의 스택 트레이스 보존', () => {
      const originalError = new Error('Original');
      const error = new SlackNotificationError('Wrapper', 'WRAPPER', {}, { cause: originalError });

      expect(error.stack).toBeDefined();
      expect(error.cause.stack).toBeDefined();
      expect(error.cause.stack).toContain('Original');
    });
  });

  describe('에러 타입 검증', () => {
    test('instanceof Error', () => {
      const error = new SlackNotificationError('Test', 'TEST');
      expect(error instanceof Error).toBe(true);
    });

    test('instanceof SlackNotificationError', () => {
      const error = new SlackNotificationError('Test', 'TEST');
      expect(error instanceof SlackNotificationError).toBe(true);
    });

    test('name 속성 확인', () => {
      const error = new SlackNotificationError('Test', 'TEST');
      expect(error.name).toBe('SlackNotificationError');
    });
  });

  describe('details 객체 처리', () => {
    test('복잡한 details 객체 저장', () => {
      const details = {
        user: { id: '123', name: 'John' },
        metadata: { timestamp: Date.now(), version: '1.0' },
        config: { retries: 3, timeout: 5000 },
      };

      const error = new SlackNotificationError('Test', 'TEST', details);
      expect(error.details).toEqual(details);
      expect(error.details.user.id).toBe('123');
      expect(error.details.config.retries).toBe(3);
    });

    test('details 수정이 원본에 영향 없음 (깊은 복사는 아님)', () => {
      const details = { count: 1 };
      const error = new SlackNotificationError('Test', 'TEST', details);

      details.count = 2;
      expect(error.details.count).toBe(2); // 얕은 참조이므로 변경됨
    });
  });

  describe('에러 메시지 및 코드', () => {
    test.each([
      ['', 'EMPTY_MESSAGE', '빈 메시지'],
      ['   ', 'WHITESPACE_MESSAGE', '공백 메시지'],
      ['매우 긴 에러 메시지입니다'.repeat(10), 'LONG_MESSAGE', '긴 메시지'],
      ['특수문자 !@#$%^&*()_+ 메시지', 'SPECIAL_CHARS', '특수문자 메시지'],
      ['한글 에러 메시지', 'KOREAN_CODE', '한글 메시지'],
    ])('다양한 메시지 형식: "%s" (%s)', (message, code, _description) => {
      const error = new SlackNotificationError(message, code);
      expect(error.message).toBe(message);
      expect(error.code).toBe(code);
    });
  });

  describe('JSON 직렬화', () => {
    test('JSON.stringify로 직렬화 가능', () => {
      const error = new SlackNotificationError('Test', 'TEST', { key: 'value' });

      // JSON.stringify는 Error의 기본 속성들을 포함하지 않지만, 커스텀 속성들은 포함
      const json = JSON.stringify(error);
      const parsed = JSON.parse(json);

      expect(parsed.code).toBe('TEST');
      expect(parsed.details).toEqual({ key: 'value' });
      expect(parsed.timestamp).toBeDefined();
    });

    test('순환 참조가 있는 details 처리', () => {
      const details = { self: null };
      details.self = details; // 순환 참조 생성

      const error = new SlackNotificationError('Test', 'TEST', details);

      // JSON.stringify 시 순환 참조로 인한 에러 발생
      expect(() => JSON.stringify(error)).toThrow();
    });
  });

  describe('실제 사용 시나리오', () => {
    test('API 호출 실패 시나리오', () => {
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
      expect(error.cause.message).toBe('Network timeout');
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

      expect(error.details.missingFields).toHaveLength(2);
      expect(error.details.providedFields).toHaveLength(1);
    });
  });
});
