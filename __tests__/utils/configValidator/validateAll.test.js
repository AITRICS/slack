const { expectAsyncError } = require('@test/helpers');

describe('ConfigValidator.validateAll (통합 테스트)', () => {
  let ConfigValidator;

  beforeAll(() => {
    ConfigValidator = require('@/utils/configValidator');
  });

  describe('성공 케이스', () => {
    test('기본 액션 (comment) 모든 검증 통과', () => {
      const validTokens = global.testUtils.createValidTokens();

      global.testUtils.mockCoreInputs({
        ...validTokens,
        ACTION_TYPE: 'comment',
      });

      const result = ConfigValidator.validateAll();

      expect(result).toEqual({
        slackToken: validTokens.SLACK_TOKEN,
        githubToken: validTokens.GITHUB_TOKEN,
        actionType: 'comment',
      });
    });

    test('DEPLOY 액션 완전한 검증 통과', () => {
      const deployInputs = {
        SLACK_TOKEN: 'xoxp-production-token-1234567890',
        GITHUB_TOKEN: 'github_pat_11ABC_very_long_fine_grained_token_with_specific_permissions',
        ACTION_TYPE: 'deploy',
        EC2_NAME: 'production-server',
        IMAGE_TAG: 'v2.1.0',
        JOB_STATUS: 'success',
      };

      global.testUtils.mockCoreInputs(deployInputs);

      const result = ConfigValidator.validateAll();

      expect(result.actionType).toBe('deploy');
      expect(result.slackToken).toBe('xoxp-production-token-1234567890');
    });

    test('CI 액션 완전한 검증 통과', () => {
      const ciInputs = {
        SLACK_TOKEN: 'xoxb-ci-bot-token-1234567890',
        GITHUB_TOKEN: 'gho_oauth_token_1234567890abcdefghijklmnopqrstuvwxyz',
        ACTION_TYPE: 'ci',
        BRANCH_NAME: 'feature/user-authentication',
        IMAGE_TAG: 'latest',
        JOB_NAME: 'build,test,lint,security-scan',
        JOB_STATUS: 'failure',
      };

      global.testUtils.mockCoreInputs(ciInputs);

      const result = ConfigValidator.validateAll();
      expect(result.actionType).toBe('ci');
    });
  });

  describe('검증 실패 케이스 (단계별)', () => {
    test('1단계 실패: 필수 설정 누락', () => {
      global.testUtils.mockCoreInputs({
        SLACK_TOKEN: '', // 누락
        GITHUB_TOKEN: 'valid-token-12345678901234567890',
        ACTION_TYPE: 'comment',
      });

      expect(() => ConfigValidator.validateAll()).toThrow('필수 설정 누락: SLACK_TOKEN');
    });

    test('2단계 실패: Slack 토큰 형식 오류', () => {
      global.testUtils.mockCoreInputs({
        SLACK_TOKEN: 'invalid-slack-token',
        GITHUB_TOKEN: 'valid-token-12345678901234567890',
        ACTION_TYPE: 'comment',
      });

      expect(() => ConfigValidator.validateAll()).toThrow('Slack 토큰 형식이 올바르지 않습니다');
    });

    test('3단계 실패: GitHub 토큰 형식 오류', () => {
      global.testUtils.mockCoreInputs({
        SLACK_TOKEN: 'xoxb-valid-token',
        GITHUB_TOKEN: 'short', // 너무 짧음
        ACTION_TYPE: 'comment',
      });

      expect(() => ConfigValidator.validateAll()).toThrow('GitHub 토큰이 너무 짧습니다');
    });

    test('4단계 실패: 액션 타입 오류', () => {
      const validTokens = global.testUtils.createValidTokens();

      global.testUtils.mockCoreInputs({
        ...validTokens,
        ACTION_TYPE: 'invalid_action_type',
      });

      expect(() => ConfigValidator.validateAll()).toThrow('유효하지 않은 액션 타입: invalid_action_type');
    });
  });

  describe('비동기 테스트', () => {
    const validTokens = global.testUtils.createValidTokens();

    test.each([
      {
        name: 'comment 액션 성공',
        inputs: { ...validTokens, ACTION_TYPE: 'comment' },
      },
      {
        name: 'deploy 액션 성공',
        inputs: {
          ...validTokens, ACTION_TYPE: 'deploy', EC2_NAME: 'server', IMAGE_TAG: 'v1.0.0', JOB_STATUS: 'success',
        },
      },
    ])('여러 설정을 동시에 검증 - 성공: $name', async ({ inputs }) => {
      global.testUtils.mockCoreInputs(inputs);

      expect(() => {
        ConfigValidator.validateAll();
      }).not.toThrow();
    });

    test.each([
      {
        name: 'SLACK_TOKEN 누락 실패',
        inputs: { SLACK_TOKEN: '', GITHUB_TOKEN: 'valid-token-12345678901234567890', ACTION_TYPE: 'comment' },
      },
      {
        name: 'invalid 액션 실패',
        inputs: { ...validTokens, ACTION_TYPE: 'invalid' },
      },
    ])('여러 설정을 동시에 검증 - 실패: $name', async ({ inputs }) => {
      global.testUtils.mockCoreInputs(inputs);

      expect(() => {
        ConfigValidator.validateAll();
      }).toThrow();
    });

    test('비동기 에러 헬퍼를 사용한 검증', async () => {
      const error = await expectAsyncError(
        async () => {
          global.testUtils.mockCoreInputs({
            SLACK_TOKEN: '',
            GITHUB_TOKEN: '',
            ACTION_TYPE: '',
          });

          await Promise.resolve();
          ConfigValidator.validateAll();
        },
        '필수 설정 누락',
      );

      expect(error).toBeDefined();
      expect(error.message).toContain('필수 설정 누락');
    });
  });
});
