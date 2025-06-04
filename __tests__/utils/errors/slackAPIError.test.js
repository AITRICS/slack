// SlackAPIError.test.js
/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

describe('errors.SlackAPIError', () => {
  let SlackAPIError;
  let SlackNotificationError;

  beforeAll(() => {
    ({ SlackAPIError, SlackNotificationError } = require('@/utils/errors'));
  });

  describe('기본 생성자 동작', () => {
    test('메시지만으로 에러 생성', () => {
      const error = new SlackAPIError('Slack API failed');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SlackNotificationError);
      expect(error).toBeInstanceOf(SlackAPIError);
      expect(error.name).toBe('SlackAPIError');
      expect(error.message).toBe('Slack API failed');
      expect(error.code).toBe('SLACK_API_ERROR');
      expect(error.details).toEqual({});
      expect(error.timestamp).toBeDefined();
    });

    test('메시지와 details로 에러 생성', () => {
      const details = { channel: 'C123456', error: 'channel_not_found' };
      const error = new SlackAPIError('Channel not found', details);

      expect(error.message).toBe('Channel not found');
      expect(error.code).toBe('SLACK_API_ERROR');
      expect(error.details).toEqual(details);
    });

    test('모든 매개변수로 에러 생성', () => {
      const details = { response: { status: 429 } };
      const cause = new Error('Rate limited');
      const error = new SlackAPIError('Rate limit exceeded', details, { cause });

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.details.response.status).toBe(429);
      expect(error.cause).toBe(cause);
    });
  });

  describe('상속 관계 검증', () => {
    test('SlackNotificationError 상속', () => {
      const error = new SlackAPIError('Test');
      expect(error instanceof SlackNotificationError).toBe(true);
    });

    test('Error 상속', () => {
      const error = new SlackAPIError('Test');
      expect(error instanceof Error).toBe(true);
    });

    test('코드가 자동으로 설정됨', () => {
      const error = new SlackAPIError('Test');
      expect(error.code).toBe('SLACK_API_ERROR');
    });

    test('name이 올바르게 설정됨', () => {
      const error = new SlackAPIError('Test');
      expect(error.name).toBe('SlackAPIError');
    });
  });

  describe('매개변수 기본값 처리', () => {
    test('details 기본값은 빈 객체', () => {
      const error = new SlackAPIError('Test');
      expect(error.details).toEqual({});
    });

    test('options 기본값은 빈 객체', () => {
      const error = new SlackAPIError('Test', {});
      expect(error.cause).toBeUndefined();
    });

    test('details가 null이면 기본값 적용', () => {
      const error = new SlackAPIError('Test', null);
      expect(error.details).toEqual({});
    });
  });

  describe('Slack API 관련 실제 시나리오', () => {
    test('인증 실패', () => {
      const details = {
        error: 'invalid_auth',
        response: { status: 401 },
        token: 'xoxb-***masked***',
      };

      const error = new SlackAPIError('Slack 인증 실패', details);

      expect(error.message).toBe('Slack 인증 실패');
      expect(error.details.error).toBe('invalid_auth');
      expect(error.details.response.status).toBe(401);
    });

    test('채널 없음', () => {
      const details = {
        error: 'channel_not_found',
        channel: 'C1234567890',
        response: {
          ok: false,
          error: 'channel_not_found',
        },
      };

      const error = new SlackAPIError('채널을 찾을 수 없습니다', details);

      expect(error.details.error).toBe('channel_not_found');
      expect(error.details.channel).toBe('C1234567890');
      expect(error.details.response.ok).toBe(false);
    });

    test('Rate Limit 초과', () => {
      const details = {
        error: 'rate_limited',
        retryAfter: 60,
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
        },
      };

      const cause = new Error('HTTP 429: Too Many Requests');
      const error = new SlackAPIError('Slack API rate limit 초과', details, { cause });

      expect(error.details.retryAfter).toBe(60);
      expect(error.cause.message).toBe('HTTP 429: Too Many Requests');
    });

    test('메시지 전송 실패', () => {
      const details = {
        error: 'msg_too_long',
        channel: 'C1234567890',
        messageLength: 4001,
        maxLength: 4000,
        response: {
          ok: false,
          error: 'msg_too_long',
        },
      };

      const error = new SlackAPIError('메시지가 너무 깁니다', details);

      expect(error.details.messageLength).toBe(4001);
      expect(error.details.maxLength).toBe(4000);
    });

    test('네트워크 오류', () => {
      const networkError = new Error('ECONNREFUSED');
      const details = {
        endpoint: 'https://slack.com/api/chat.postMessage',
        method: 'POST',
        timeout: 5000,
      };

      const error = new SlackAPIError('Slack API 네트워크 오류', details, { cause: networkError });

      expect(error.cause.message).toBe('ECONNREFUSED');
      expect(error.details.endpoint).toContain('slack.com');
    });
  });

  describe('에러 체이닝', () => {
    test('원본 HTTP 에러 체이닝', () => {
      const httpError = new Error('Request failed with status code 500');
      httpError.response = { status: 500, data: { error: 'internal_error' } };

      const error = new SlackAPIError('Slack 서버 오류', { status: 500 }, { cause: httpError });

      expect(error.cause).toBe(httpError);
      expect(error.cause.response.status).toBe(500);
    });

    test('다중 레벨 에러 체이닝', () => {
      const networkError = new Error('Connection timeout');
      const httpError = new SlackAPIError('HTTP request failed', {}, { cause: networkError });
      const finalError = new SlackAPIError('Slack API 호출 실패', {}, { cause: httpError });

      expect(finalError.cause).toBe(httpError);
      expect(finalError.cause.cause).toBe(networkError);
    });
  });

  describe('JSON 직렬화 및 로깅', () => {
    test('로깅을 위한 직렬화', () => {
      const details = {
        channel: 'C1234567890',
        user: 'U0987654321',
        timestamp: '1234567890.123456',
      };

      const error = new SlackAPIError('Slack API 오류', details);
      const json = JSON.stringify(error);
      const parsed = JSON.parse(json);

      expect(parsed.code).toBe('SLACK_API_ERROR');
      expect(parsed.details.channel).toBe('C1234567890');
      expect(parsed.timestamp).toBeDefined();
    });

    test('민감한 정보 마스킹 (실제로는 details에서 처리)', () => {
      const details = {
        token: 'xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwxyz',
        maskedToken: 'xoxb-***masked***',
        error: 'invalid_auth',
      };

      const error = new SlackAPIError('인증 실패', details);

      // 실제로는 애플리케이션에서 토큰을 마스킹해야 함
      expect(error.details.token).toBeDefined();
      expect(error.details.maskedToken).toBe('xoxb-***masked***');
    });
  });

  describe('에러 처리 패턴', () => {
    test('재시도 가능한 에러 구분', () => {
      const retryableErrors = [
        new SlackAPIError('Rate limited', { error: 'rate_limited' }),
        new SlackAPIError('Server error', { error: 'internal_error' }),
        new SlackAPIError('Network timeout', { error: 'timeout' }),
      ];

      retryableErrors.forEach((error) => {
        expect(error.code).toBe('SLACK_API_ERROR');
        expect(['rate_limited', 'internal_error', 'timeout']).toContain(error.details.error);
      });
    });

    test('재시도 불가능한 에러 구분', () => {
      const nonRetryableErrors = [
        new SlackAPIError('Invalid token', { error: 'invalid_auth' }),
        new SlackAPIError('Channel not found', { error: 'channel_not_found' }),
        new SlackAPIError('Permission denied', { error: 'not_in_channel' }),
      ];

      nonRetryableErrors.forEach((error) => {
        expect(error.code).toBe('SLACK_API_ERROR');
        expect(['invalid_auth', 'channel_not_found', 'not_in_channel']).toContain(error.details.error);
      });
    });
  });

  describe('타입 검증', () => {
    test('타입 가드 함수', () => {
      const isSlackAPIError = (error) => error instanceof SlackAPIError;

      const slackError = new SlackAPIError('Test');
      const genericError = new Error('Test');

      expect(isSlackAPIError(slackError)).toBe(true);
      expect(isSlackAPIError(genericError)).toBe(false);
    });

    test('에러 코드로 구분', () => {
      const error = new SlackAPIError('Test');
      expect(error.code).toBe('SLACK_API_ERROR');

      const isSlackAPIErrorByCode = (err) => err.code === 'SLACK_API_ERROR';
      expect(isSlackAPIErrorByCode(error)).toBe(true);
    });
  });
});
