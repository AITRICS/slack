// ConfigurationError.test.js
/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

describe('errors.ConfigurationError', () => {
  let ConfigurationError;
  let SlackNotificationError;

  beforeAll(() => {
    ({ ConfigurationError, SlackNotificationError } = require('@/utils/errors'));
  });

  describe('기본 생성자 동작', () => {
    test('메시지만으로 에러 생성', () => {
      const error = new ConfigurationError('Configuration error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SlackNotificationError);
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Configuration error');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.details).toEqual({ missingFields: [] });
      expect(error.timestamp).toBeDefined();
    });

    test('메시지와 missingFields로 에러 생성', () => {
      const missingFields = ['SLACK_TOKEN', 'GITHUB_TOKEN'];
      const error = new ConfigurationError('필수 설정 누락', missingFields);

      expect(error.message).toBe('필수 설정 누락');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.details.missingFields).toEqual(missingFields);
    });

    test('모든 매개변수로 에러 생성', () => {
      const missingFields = ['ACTION_TYPE'];
      const cause = new Error('Config file not found');
      const error = new ConfigurationError('설정 파일 오류', missingFields, { cause });

      expect(error.message).toBe('설정 파일 오류');
      expect(error.details.missingFields).toEqual(missingFields);
      expect(error.cause).toBe(cause);
    });
  });

  describe('상속 관계 검증', () => {
    test('SlackNotificationError 상속', () => {
      const error = new ConfigurationError('Test');
      expect(error instanceof SlackNotificationError).toBe(true);
    });

    test('Error 상속', () => {
      const error = new ConfigurationError('Test');
      expect(error instanceof Error).toBe(true);
    });

    test('코드가 자동으로 설정됨', () => {
      const error = new ConfigurationError('Test');
      expect(error.code).toBe('CONFIGURATION_ERROR');
    });

    test('name이 올바르게 설정됨', () => {
      const error = new ConfigurationError('Test');
      expect(error.name).toBe('ConfigurationError');
    });
  });

  describe('missingFields 처리', () => {
    test('missingFields 기본값은 빈 배열', () => {
      const error = new ConfigurationError('Test');
      expect(error.details.missingFields).toEqual([]);
      expect(Array.isArray(error.details.missingFields)).toBe(true);
    });

    test('단일 필드 누락', () => {
      const error = new ConfigurationError('토큰 누락', ['SLACK_TOKEN']);
      expect(error.details.missingFields).toEqual(['SLACK_TOKEN']);
      expect(error.details.missingFields).toHaveLength(1);
    });

    test('다중 필드 누락', () => {
      const missingFields = ['SLACK_TOKEN', 'GITHUB_TOKEN', 'ACTION_TYPE'];
      const error = new ConfigurationError('다중 설정 누락', missingFields);

      expect(error.details.missingFields).toEqual(missingFields);
      expect(error.details.missingFields).toHaveLength(3);
    });

    test('빈 배열 전달', () => {
      const error = new ConfigurationError('설정 오류', []);
      expect(error.details.missingFields).toEqual([]);
    });

    test('null이나 undefined 전달 시 기본값 적용', () => {
      const error1 = new ConfigurationError('Test', null);
      const error2 = new ConfigurationError('Test', undefined);

      expect(error1.details.missingFields).toEqual([]);
      expect(error2.details.missingFields).toEqual([]);
    });
  });

  describe('GitHub Actions 관련 실제 시나리오', () => {
    test('필수 환경변수 누락', () => {
      const missingFields = ['SLACK_TOKEN', 'GITHUB_TOKEN'];
      const error = new ConfigurationError(
        `필수 설정 누락: ${missingFields.join(', ')}`,
        missingFields,
      );

      expect(error.message).toBe('필수 설정 누락: SLACK_TOKEN, GITHUB_TOKEN');
      expect(error.details.missingFields).toEqual(missingFields);
    });

    test('액션 타입별 설정 누락', () => {
      const missingFields = ['EC2_NAME', 'IMAGE_TAG', 'JOB_STATUS'];
      const error = new ConfigurationError(
        'deploy 액션에 필요한 설정이 누락되었습니다: EC2_NAME, IMAGE_TAG, JOB_STATUS',
        missingFields,
      );

      expect(error.details.missingFields).toHaveLength(3);
      expect(error.details.missingFields).toContain('EC2_NAME');
      expect(error.details.missingFields).toContain('IMAGE_TAG');
      expect(error.details.missingFields).toContain('JOB_STATUS');
    });

    test('잘못된 액션 타입', () => {
      const missingFields = ['ACTION_TYPE'];
      const error = new ConfigurationError(
        '유효하지 않은 액션 타입: invalid_action. 가능한 값: schedule, approve, comment, review_requested, changes_requested, deploy, ci',
        missingFields,
      );

      expect(error.details.missingFields).toEqual(['ACTION_TYPE']);
      expect(error.message).toContain('invalid_action');
    });

    test('토큰 형식 오류', () => {
      const missingFields = ['SLACK_TOKEN'];
      const error = new ConfigurationError(
        'Slack 토큰 형식이 올바르지 않습니다. xoxb- 또는 xoxp-로 시작해야 합니다',
        missingFields,
      );

      expect(error.details.missingFields).toEqual(['SLACK_TOKEN']);
      expect(error.message).toContain('xoxb-');
    });

    test('CI 액션 설정 누락', () => {
      const missingFields = ['BRANCH_NAME', 'JOB_NAME'];
      const error = new ConfigurationError(
        'ci 액션에 필요한 설정이 누락되었습니다: BRANCH_NAME, JOB_NAME',
        missingFields,
      );

      expect(error.details.missingFields).toEqual(['BRANCH_NAME', 'JOB_NAME']);
    });
  });

  describe('설정 검증 헬퍼 메서드 지원', () => {
    test('누락된 필드 개수 확인', () => {
      const error = new ConfigurationError('Test', ['FIELD1', 'FIELD2', 'FIELD3']);
      expect(error.details.missingFields.length).toBe(3);
    });

    test('특정 필드 누락 여부 확인', () => {
      const error = new ConfigurationError('Test', ['SLACK_TOKEN', 'GITHUB_TOKEN']);
      expect(error.details.missingFields.includes('SLACK_TOKEN')).toBe(true);
      expect(error.details.missingFields.includes('ACTION_TYPE')).toBe(false);
    });

    test('필드 목록 문자열 생성', () => {
      const missingFields = ['SLACK_TOKEN', 'GITHUB_TOKEN', 'ACTION_TYPE'];
      const error = new ConfigurationError('Test', missingFields);
      const fieldList = error.details.missingFields.join(', ');
      expect(fieldList).toBe('SLACK_TOKEN, GITHUB_TOKEN, ACTION_TYPE');
    });
  });

  describe('에러 체이닝', () => {
    test('설정 파일 읽기 실패 체이닝', () => {
      const fileError = new Error('ENOENT: no such file or directory, open \'.env\'');
      const error = new ConfigurationError(
        '설정 파일을 읽을 수 없습니다',
        ['CONFIG_FILE'],
        { cause: fileError },
      );

      expect(error.cause).toBe(fileError);
      expect(error.cause.message).toContain('ENOENT');
    });

    test('환경변수 파싱 실패 체이닝', () => {
      const parseError = new Error('Invalid JSON in environment variable');
      const error = new ConfigurationError(
        '환경변수 파싱 실패',
        ['JSON_CONFIG'],
        { cause: parseError },
      );

      expect(error.cause.message).toBe('Invalid JSON in environment variable');
    });
  });

  describe('details 구조 확장성', () => {
    test('details 객체가 missingFields 외 추가 정보 보존', () => {
      const error = new ConfigurationError('Test', ['FIELD1']);

      // details는 { missingFields: [...] } 구조
      expect(error.details).toHaveProperty('missingFields');
      expect(typeof error.details).toBe('object');
    });

    test('ConfigurationError만의 고유한 details 구조', () => {
      const error = new ConfigurationError('Test', ['TOKEN']);

      // 다른 에러 클래스와 구별되는 구조
      expect(error.details.missingFields).toBeDefined();
      expect(Array.isArray(error.details.missingFields)).toBe(true);
    });
  });

  describe('JSON 직렬화', () => {
    test('missingFields가 JSON에 포함됨', () => {
      const missingFields = ['SLACK_TOKEN', 'GITHUB_TOKEN'];
      const error = new ConfigurationError('설정 누락', missingFields);

      const json = JSON.stringify(error);
      const parsed = JSON.parse(json);

      expect(parsed.code).toBe('CONFIGURATION_ERROR');
      expect(parsed.details.missingFields).toEqual(missingFields);
    });

    test('로깅 시 유용한 정보 포함', () => {
      const error = new ConfigurationError('Test', ['FIELD1', 'FIELD2']);

      const logData = {
        message: error.message,
        code: error.code,
        missingFields: error.details.missingFields,
        timestamp: error.timestamp,
      };

      expect(logData.missingFields).toHaveLength(2);
      expect(logData.code).toBe('CONFIGURATION_ERROR');
    });
  });

  describe('실제 사용 패턴', () => {
    test('설정 검증기에서 사용하는 패턴', () => {
      const checkRequiredFields = (config, required) => {
        const missing = required.filter((field) => !config[field]);
        if (missing.length > 0) {
          throw new ConfigurationError(
            `필수 설정 누락: ${missing.join(', ')}`,
            missing,
          );
        }
      };

      const config = { SLACK_TOKEN: 'token' };
      const required = ['SLACK_TOKEN', 'GITHUB_TOKEN', 'ACTION_TYPE'];

      expect(() => checkRequiredFields(config, required)).toThrow(ConfigurationError);

      let error;
      try {
        checkRequiredFields(config, required);
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.details.missingFields).toEqual(['GITHUB_TOKEN', 'ACTION_TYPE']);
    });

    test('에러 복구 로직에서 사용하는 패턴', () => {
      const handleConfigError = (error) => {
        if (error instanceof ConfigurationError) {
          return {
            canRecover: error.details.missingFields.length < 3,
            missingCount: error.details.missingFields.length,
            fields: error.details.missingFields,
          };
        }
        return { canRecover: false };
      };

      const error = new ConfigurationError('Test', ['FIELD1', 'FIELD2']);
      const result = handleConfigError(error);

      expect(result.canRecover).toBe(true);
      expect(result.missingCount).toBe(2);
      expect(result.fields).toEqual(['FIELD1', 'FIELD2']);
    });
  });

  describe('타입 검증', () => {
    test('ConfigurationError 타입 가드', () => {
      const isConfigurationError = (error) => error instanceof ConfigurationError;

      const configError = new ConfigurationError('Test', ['FIELD']);
      const genericError = new Error('Test');

      expect(isConfigurationError(configError)).toBe(true);
      expect(isConfigurationError(genericError)).toBe(false);
    });

    test('에러 코드로 구분', () => {
      const error = new ConfigurationError('Test');
      expect(error.code).toBe('CONFIGURATION_ERROR');

      const isConfigErrorByCode = (err) => err.code === 'CONFIGURATION_ERROR';
      expect(isConfigErrorByCode(error)).toBe(true);
    });
  });
});
