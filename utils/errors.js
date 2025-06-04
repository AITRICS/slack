/**
 * Slack 알림 시스템 기본 에러 클래스
 *  - Error 옵션 객체에 { cause } 전달해 원본 스택 보존
 */
// eslint-disable-next-line max-classes-per-file
class SlackNotificationError extends Error {
  /**
   * @param {string}  message
   * @param {string}  code
   * @param {Object}  [details]
   * @param {Object}  [options]   // { cause?: Error }
   */
  constructor(message, code, details = {}, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'SlackNotificationError';
    this.code = code;
    this.details = details || {};
    this.timestamp = new Date().toISOString();
  }
}

/** Slack API 오류 */
class SlackAPIError extends SlackNotificationError {
  constructor(message, details = {}, options = {}) {
    super(message, 'SLACK_API_ERROR', details || {}, options);
    this.name = 'SlackAPIError';
  }
}

/** GitHub API 오류 */
class GitHubAPIError extends SlackNotificationError {
  constructor(message, details = {}, options = {}) {
    super(message, 'GITHUB_API_ERROR', details || {}, options);
    this.name = 'GitHubAPIError';
  }
}

/** 설정 오류 */
class ConfigurationError extends SlackNotificationError {
  constructor(message, missingFields = [], options = {}) {
    super(message, 'CONFIGURATION_ERROR', { missingFields: missingFields || [] }, options);
    this.name = 'ConfigurationError';
  }
}

/** 페이로드(입력값) 검증 오류 */
class PayloadValidationError extends SlackNotificationError {
  constructor(message, payload = null, options = {}) {
    super(message, 'PAYLOAD_VALIDATION_ERROR', { payload }, options);
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
