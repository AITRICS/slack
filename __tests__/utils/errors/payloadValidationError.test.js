/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

describe('errors.PayloadValidationError', () => {
  let PayloadValidationError;
  let SlackNotificationError;

  beforeAll(() => {
    ({ PayloadValidationError, SlackNotificationError } = require('@/utils/errors'));
  });

  describe('기본 생성자 동작', () => {
    test('메시지만으로 에러 생성', () => {
      const error = new PayloadValidationError('Invalid payload');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SlackNotificationError);
      expect(error).toBeInstanceOf(PayloadValidationError);
      expect(error.name).toBe('PayloadValidationError');
      expect(error.message).toBe('Invalid payload');
      expect(error.code).toBe('PAYLOAD_VALIDATION_ERROR');
      expect(error.details).toEqual({ payload: null });
      expect(error.timestamp).toBeDefined();
    });

    test('메시지와 payload로 에러 생성', () => {
      const payload = { action: 'opened', number: 123 };
      const error = new PayloadValidationError('Missing repository field', payload);

      expect(error.message).toBe('Missing repository field');
      expect(error.code).toBe('PAYLOAD_VALIDATION_ERROR');
      expect(error.details.payload).toEqual(payload);
    });

    test('모든 매개변수로 에러 생성', () => {
      const payload = { invalid: 'data' };
      const cause = new Error('JSON parse error');
      const error = new PayloadValidationError('Payload parsing failed', payload, { cause });

      expect(error.message).toBe('Payload parsing failed');
      expect(error.details.payload).toEqual(payload);
      expect(error.cause).toBe(cause);
    });
  });

  describe('상속 관계 검증', () => {
    test('SlackNotificationError 상속', () => {
      const error = new PayloadValidationError('Test');
      expect(error instanceof SlackNotificationError).toBe(true);
    });

    test('Error 상속', () => {
      const error = new PayloadValidationError('Test');
      expect(error instanceof Error).toBe(true);
    });

    test('코드가 자동으로 설정됨', () => {
      const error = new PayloadValidationError('Test');
      expect(error.code).toBe('PAYLOAD_VALIDATION_ERROR');
    });

    test('name이 올바르게 설정됨', () => {
      const error = new PayloadValidationError('Test');
      expect(error.name).toBe('PayloadValidationError');
    });
  });

  describe('payload 처리', () => {
    test('payload 기본값은 null', () => {
      const error = new PayloadValidationError('Test');
      expect(error.details.payload).toBeNull();
    });

    test('빈 객체 payload', () => {
      const error = new PayloadValidationError('Empty payload', {});
      expect(error.details.payload).toEqual({});
    });

    test('복잡한 payload 객체', () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 123,
          title: 'Test PR',
          user: { login: 'testuser' },
        },
        repository: {
          name: 'test-repo',
          full_name: 'owner/test-repo',
        },
      };

      const error = new PayloadValidationError('Validation failed', payload);
      expect(error.details.payload).toEqual(payload);
      expect(error.details.payload.pull_request.number).toBe(123);
    });

    test('null payload 명시적 전달', () => {
      const error = new PayloadValidationError('No payload', null);
      expect(error.details.payload).toBeNull();
    });

    test('undefined payload 전달 시 기본값 적용', () => {
      const error = new PayloadValidationError('Test', undefined);
      expect(error.details.payload).toBeNull();
    });
  });

  describe('GitHub webhook 페이로드 검증 시나리오', () => {
    test('repository 필드 누락', () => {
      const invalidPayload = {
        action: 'opened',
        pull_request: { number: 123 },
        // repository 필드 누락
      };

      const error = new PayloadValidationError(
        '페이로드에 repository 정보가 없습니다',
        invalidPayload,
      );

      expect(error.details.payload.action).toBe('opened');
      expect(error.details.payload.repository).toBeUndefined();
    });

    test('잘못된 페이로드 타입', () => {
      const invalidPayload = 'not an object';

      const error = new PayloadValidationError(
        '유효하지 않은 페이로드',
        invalidPayload,
      );

      expect(error.details.payload).toBe('not an object');
    });

    test('배열 페이로드', () => {
      const arrayPayload = [1, 2, 3];

      const error = new PayloadValidationError(
        '페이로드는 객체여야 합니다',
        arrayPayload,
      );

      expect(error.details.payload).toEqual([1, 2, 3]);
      expect(Array.isArray(error.details.payload)).toBe(true);
    });

    test('PR 정보 누락', () => {
      const payload = {
        action: 'review_requested',
        repository: { name: 'test-repo' },
        // pull_request 필드 누락
      };

      const error = new PayloadValidationError(
        'PR 정보가 누락되었습니다',
        payload,
      );

      expect(error.details.payload.action).toBe('review_requested');
      expect(error.details.payload.pull_request).toBeUndefined();
    });

    test('코멘트 정보 누락', () => {
      const payload = {
        action: 'created',
        repository: { name: 'test-repo' },
        // comment 필드 누락
      };

      const error = new PayloadValidationError(
        '코멘트 정보가 누락되었습니다',
        payload,
      );

      expect(error.details.payload.comment).toBeUndefined();
    });

    test('리뷰 정보 누락', () => {
      const payload = {
        action: 'submitted',
        repository: { name: 'test-repo' },
        pull_request: { number: 123 },
        // review 필드 누락
      };

      const error = new PayloadValidationError(
        '리뷰 정보가 누락되었습니다',
        payload,
      );

      expect(error.details.payload.review).toBeUndefined();
    });
  });

  describe('페이로드 타입별 검증', () => {
    test('문자열 페이로드', () => {
      const stringPayload = '{"action": "opened"}';
      const error = new PayloadValidationError('JSON 파싱 필요', stringPayload);
      expect(error.details.payload).toBe(stringPayload);
    });

    test('숫자 페이로드', () => {
      const numberPayload = 123;
      const error = new PayloadValidationError('숫자는 유효한 페이로드가 아닙니다', numberPayload);
      expect(error.details.payload).toBe(123);
    });

    test('불린 페이로드', () => {
      const booleanPayload = false;
      const error = new PayloadValidationError('불린은 유효한 페이로드가 아닙니다', booleanPayload);
      expect(error.details.payload).toBe(false);
    });

    test('Date 객체 페이로드', () => {
      const datePayload = new Date('2024-01-01');
      const error = new PayloadValidationError('Date 객체는 유효한 페이로드가 아닙니다', datePayload);
      expect(error.details.payload).toBe(datePayload);
    });
  });

  describe('에러 체이닝', () => {
    test('JSON 파싱 에러 체이닝', () => {
      const jsonError = new SyntaxError('Unexpected token in JSON');
      const invalidPayload = '{"action": opened}'; // 잘못된 JSON

      const error = new PayloadValidationError(
        'JSON 페이로드 파싱 실패',
        invalidPayload,
        { cause: jsonError },
      );

      expect(error.cause).toBe(jsonError);
      expect(error.cause.message).toBe('Unexpected token in JSON');
    });

    test('스키마 검증 에러 체이닝', () => {
      const schemaError = new Error('Required property "repository" is missing');
      const payload = { action: 'opened' };

      const error = new PayloadValidationError(
        '페이로드 스키마 검증 실패',
        payload,
        { cause: schemaError },
      );

      expect(error.cause.message).toContain('Required property');
    });
  });

  describe('payload 크기 및 구조 검증', () => {
    test('큰 페이로드 처리', () => {
      const largePayload = {
        action: 'opened',
        large_field: 'x'.repeat(10000),
        nested: {
          deep: {
            structure: {
              data: Array.from({ length: 1000 }, (_, i) => ({ id: i })),
            },
          },
        },
      };

      const error = new PayloadValidationError('페이로드가 너무 큽니다', largePayload);

      expect(error.details.payload.large_field).toHaveLength(10000);
      expect(error.details.payload.nested.deep.structure.data).toHaveLength(1000);
    });

    test('순환 참조가 있는 페이로드', () => {
      const circularPayload = { action: 'opened' };
      circularPayload.self = circularPayload; // 순환 참조 생성

      const error = new PayloadValidationError('순환 참조가 있는 페이로드', circularPayload);

      expect(error.details.payload.action).toBe('opened');
      expect(error.details.payload.self).toBe(circularPayload);

      // JSON 직렬화 시 에러 발생
      expect(() => JSON.stringify(error)).toThrow();
    });
  });

  describe('로깅 및 디버깅', () => {
    test('페이로드 정보가 로그에 포함됨', () => {
      const payload = {
        action: 'opened',
        pull_request: { number: 123 },
      };

      const error = new PayloadValidationError('Validation failed', payload);

      const logData = {
        message: error.message,
        code: error.code,
        payloadAction: error.details.payload?.action,
        payloadType: typeof error.details.payload,
        timestamp: error.timestamp,
      };

      expect(logData.payloadAction).toBe('opened');
      expect(logData.payloadType).toBe('object');
    });

    test('민감한 정보 마스킹 고려사항', () => {
      const payload = {
        action: 'opened',
        token: 'secret_token_123',
        user: {
          email: 'user@example.com',
          private_data: 'sensitive',
        },
      };

      const error = new PayloadValidationError('Validation failed', payload);

      expect(error.details.payload.token).toBe('secret_token_123');
      expect(error.details.payload.user.email).toBe('user@example.com');
    });
  });

  describe('실제 사용 패턴', () => {
    test('페이로드 검증 함수에서 사용', () => {
      const validatePayload = (payload) => {
        if (!payload || typeof payload !== 'object') {
          throw new PayloadValidationError('유효하지 않은 페이로드', payload);
        }

        if (!payload.repository) {
          throw new PayloadValidationError('페이로드에 repository 정보가 없습니다', payload);
        }
      };

      const invalidPayload = { action: 'opened' }; // repository 누락

      expect(() => validatePayload(invalidPayload)).toThrow(PayloadValidationError);

      let error;
      try {
        validatePayload(invalidPayload);
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(PayloadValidationError);
      expect(error.details.payload).toEqual(invalidPayload);
    });

    test('에러 핸들링에서 페이로드 정보 활용', () => {
      const handleValidationError = (error) => {
        if (error instanceof PayloadValidationError) {
          return {
            hasPayload: error.details.payload !== null,
            payloadType: typeof error.details.payload,
            action: error.details.payload?.action,
          };
        }
        return null;
      };

      const payload = { action: 'closed', number: 456 };
      const error = new PayloadValidationError('Test', payload);
      const result = handleValidationError(error);

      expect(result.hasPayload).toBe(true);
      expect(result.payloadType).toBe('object');
      expect(result.action).toBe('closed');
    });
  });

  describe('타입 검증', () => {
    test('PayloadValidationError 타입 가드', () => {
      const isPayloadValidationError = (error) => error instanceof PayloadValidationError;

      const payloadError = new PayloadValidationError('Test', {});
      const genericError = new Error('Test');

      expect(isPayloadValidationError(payloadError)).toBe(true);
      expect(isPayloadValidationError(genericError)).toBe(false);
    });

    test('에러 코드로 구분', () => {
      const error = new PayloadValidationError('Test');
      expect(error.code).toBe('PAYLOAD_VALIDATION_ERROR');

      const isPayloadErrorByCode = (err) => err.code === 'PAYLOAD_VALIDATION_ERROR';
      expect(isPayloadErrorByCode(error)).toBe(true);
    });
  });
});
