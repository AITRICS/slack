/**
 * Slack 알림 시스템 기본 에러 클래스
 */
// eslint-disable-next-line max-classes-per-file
class SlackNotificationError extends Error {
  /**
   * @param {string} message - 에러 메시지
   * @param {string} code - 에러 코드
   * @param {Object} [details] - 추가 상세 정보
   */
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SlackNotificationError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // 스택 트레이스 유지
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * GitHub API 에러
 */
class GitHubAPIError extends SlackNotificationError {
  /**
   * @param {string} message - 에러 메시지
   * @param {Object} [details] - API 응답 상세 정보
   */
  constructor(message, details = {}) {
    super(message, 'GITHUB_API_ERROR', details);
    this.name = 'GitHubAPIError';
  }
}

/**
 * Slack API 에러
 */
class SlackAPIError extends SlackNotificationError {
  /**
   * @param {string} message - 에러 메시지
   * @param {Object} [details] - API 응답 상세 정보
   */
  constructor(message, details = {}) {
    super(message, 'SLACK_API_ERROR', details);
    this.name = 'SlackAPIError';
  }
}

/**
 * 설정 에러
 */
class ConfigurationError extends SlackNotificationError {
  /**
   * @param {string} message - 에러 메시지
   * @param {string[]} [missingFields] - 누락된 필드들
   */
  constructor(message, missingFields = []) {
    super(message, 'CONFIGURATION_ERROR', { missingFields });
    this.name = 'ConfigurationError';
  }
}

/**
 * 페이로드 검증 에러
 */
class PayloadValidationError extends SlackNotificationError {
  /**
   * @param {string} message - 에러 메시지
   * @param {Object} [payload] - 문제가 된 페이로드
   */
  constructor(message, payload = null) {
    super(message, 'PAYLOAD_VALIDATION_ERROR', { payload });
    this.name = 'PayloadValidationError';
  }
}

module.exports = {
  SlackNotificationError,
  GitHubAPIError,
  SlackAPIError,
  ConfigurationError,
  PayloadValidationError,
};
