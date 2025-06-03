const Core = require('@actions/core');
const { ConfigurationError } = require('./errors');
const { ACTION_TYPES } = require('../constants');

/**
 * 설정 검증 클래스
 */
class ConfigValidator {
  /**
   * 필수 설정 검증
   * @returns {boolean} 모든 필수 항목이 존재하면 true
   * @throws {ConfigurationError}
   */
  static validateRequired() {
    const required = ['SLACK_TOKEN', 'GITHUB_TOKEN', 'ACTION_TYPE'];
    const inputs = required.map((k) => ({ k, v: Core.getInput(k) }));
    const missingKeys = inputs.filter(
      ({ v }) => v == null || (typeof v === 'string' && v.trim() === ''),
    ).map(({ k }) => k);

    if (missingKeys.length) {
      throw new ConfigurationError(`필수 설정 누락: ${missingKeys.join(', ')}`, missingKeys);
    }
    return true;
  }

  /**
   * 액션 타입 검증
   * @param {ActionType} actionType - 검증할 액션 타입
   * @throws {ConfigurationError} 유효하지 않은 액션 타입인 경우
   */
  static validateActionType(actionType) {
    const validTypes = Object.values(ACTION_TYPES);

    if (!validTypes.includes(actionType)) {
      let typeStr = '';
      try {
        typeStr = typeof actionType === 'symbol' ?
          actionType.toString() :
          String(actionType);
      } catch {
        typeStr = '[변환 불가능한 타입]';
      }
      throw new ConfigurationError(
        `유효하지 않은 액션 타입: ${typeStr}. 가능한 값: ${validTypes.join(', ')}`,
        ['ACTION_TYPE'],
      );
    }
  }

  /**
   * 액션별 추가 설정 검증
   * @param {ActionType} actionType - 액션 타입
   * @throws {ConfigurationError} 필수 설정이 누락된 경우
   */
  static validateActionSpecificConfig(actionType) {
    const actionRequirements = {
      [ACTION_TYPES.DEPLOY]: ['EC2_NAME', 'IMAGE_TAG', 'JOB_STATUS'],
      [ACTION_TYPES.CI]: ['BRANCH_NAME', 'IMAGE_TAG', 'JOB_NAME', 'JOB_STATUS'],
    };

    const required = actionRequirements[actionType];
    if (!required) return;

    const missing = required.filter((key) => !Core.getInput(key));

    if (missing.length > 0) {
      throw new ConfigurationError(
        `${actionType} 액션에 필요한 설정이 누락되었습니다: ${missing.join(', ')}`,
        missing,
      );
    }
  }

  /**
   * 토큰 형식 검증
   * @static
   * @param {string} token - 검증할 토큰
   * @param {string} tokenType - 토큰 타입
   * @returns {void}
   * @throws {ConfigurationError} 토큰 형식이 잘못된 경우
   */
  static validateTokenFormat(token, tokenType) {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new ConfigurationError(
        `${tokenType}이 비어있거나 유효하지 않습니다`,
        [tokenType],
      );
    }

    // Slack 토큰 형식 검증 (xoxb- 또는 xoxp-로 시작)
    if (tokenType === 'SLACK_TOKEN' && !token.match(/^xox[bp]-/)) {
      throw new ConfigurationError(
        'Slack 토큰 형식이 올바르지 않습니다. xoxb- 또는 xoxp-로 시작해야 합니다',
        ['SLACK_TOKEN'],
      );
    }

    // GitHub 토큰 기본 길이 검증
    if (tokenType === 'GITHUB_TOKEN' && token.length < 20) {
      throw new ConfigurationError(
        'GitHub 토큰이 너무 짧습니다',
        ['GITHUB_TOKEN'],
      );
    }
  }

  /**
   * 전체 설정 검증
   * @returns {{slackToken: string, githubToken: string, actionType: ActionType}}
   * @throws {ConfigurationError} 검증 실패 시
   */
  static validateAll() {
    // 필수 설정 검증
    ConfigValidator.validateRequired();

    const slackToken = Core.getInput('SLACK_TOKEN');
    const githubToken = Core.getInput('GITHUB_TOKEN');
    const actionType = Core.getInput('ACTION_TYPE');

    // 토큰 형식 검증
    ConfigValidator.validateTokenFormat(slackToken, 'SLACK_TOKEN');
    ConfigValidator.validateTokenFormat(githubToken, 'GITHUB_TOKEN');

    // 액션 타입 검증
    ConfigValidator.validateActionType(actionType);

    // 액션별 추가 설정 검증
    ConfigValidator.validateActionSpecificConfig(actionType);

    return { slackToken, githubToken, actionType };
  }

  /**
   * 페이로드 검증
   * @static
   * @param {Object} payload - GitHub 이벤트 페이로드
   * @returns {void}
   * @throws {ConfigurationError} 페이로드가 유효하지 않은 경우
   */
  static validatePayload(payload) {
    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      payload instanceof Date
    ) {
      throw new ConfigurationError('유효하지 않은 페이로드', ['payload']);
    }

    if (!('repository' in payload) || payload.repository == null) {
      throw new ConfigurationError('페이로드에 repository 정보가 없습니다', ['payload.repository']);
    }
  }
}

module.exports = ConfigValidator;
