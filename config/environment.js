const Core = require('@actions/core');
const { API_CONFIG, LOG_LEVELS } = require('../constants');

/**
 * 환경 설정 로더
 * GitHub Actions 환경에 최적화된 단순 설정 관리
 */
class Environment {
  #config = null;

  /**
   * 설정 로드 (싱글톤 패턴)
   * @returns {Object} 환경 설정
   */
  load() {
    if (this.#config) {
      return this.#config;
    }

    this.#config = {
      slack: {
        token: Core.getInput('SLACK_TOKEN'),
      },
      github: {
        token: Core.getInput('GITHUB_TOKEN'),
      },
      action: {
        type: Core.getInput('ACTION_TYPE'),
        deploy: {
          ec2Name: Core.getInput('EC2_NAME'),
          imageTag: Core.getInput('IMAGE_TAG'),
          jobStatus: Core.getInput('JOB_STATUS'),
        },
        ci: {
          branchName: Core.getInput('BRANCH_NAME'),
          imageTag: Core.getInput('IMAGE_TAG'),
          jobName: Core.getInput('JOB_NAME'),
          jobStatus: Core.getInput('JOB_STATUS'),
        },
      },
      features: {
        maxRetries: this.#parseInteger(process.env.MAX_RETRIES, API_CONFIG.MAX_RETRIES),
        retryDelay: this.#parseInteger(process.env.RETRY_DELAY_MS, API_CONFIG.RETRY_DELAY_MS),
        requestTimeout: this.#parseInteger(process.env.REQUEST_TIMEOUT_MS, API_CONFIG.REQUEST_TIMEOUT_MS),
      },
      logging: {
        level: this.#validateLogLevel(process.env.LOG_LEVEL, LOG_LEVELS.INFO),
        debug: this.#parseBoolean(process.env.DEBUG, false),
        formatJson: this.#parseBoolean(process.env.LOG_FORMAT === 'json', false),
      },
      runtime: {
        timezone: process.env.TZ || 'Asia/Seoul',
        nodeEnv: process.env.NODE_ENV || 'production',
        isDevelopment: process.env.NODE_ENV === 'development',
        isTest: process.env.NODE_ENV === 'test',
      },
    };

    return this.#config;
  }

  /**
   * 정수 파싱 (기본값 포함)
   * @private
   * @param {string|undefined} value
   * @param {number} defaultValue
   * @returns {number}
   */
  #parseInteger(value, defaultValue) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * 불린 파싱 (기본값 포함)
   * @private
   * @param {string|boolean|undefined} value
   * @param {boolean} defaultValue
   * @returns {boolean}
   */
  #parseBoolean(value, defaultValue) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return defaultValue;
  }

  /**
   * 로그 레벨 검증
   * @private
   * @param {string|undefined} level
   * @param {string} defaultLevel
   * @returns {string}
   */
  #validateLogLevel(level, defaultLevel) {
    const validLevels = Object.values(LOG_LEVELS);
    return validLevels.includes(level) ? level : defaultLevel;
  }

  /**
   * 특정 경로의 설정값 가져오기
   * @param {string} path - 점 표기법 경로
   * @param {*} defaultValue - 기본값
   * @returns {*} 설정값
   */
  get(path, defaultValue = undefined) {
    const config = this.load();

    return path.split('.').reduce((obj, key) => {
      if (obj && typeof obj === 'object' && key in obj) {
        return obj[key];
      }
      return defaultValue;
    }, config);
  }

  /**
   * 디버그 모드 확인
   * @returns {boolean}
   */
  isDebug() {
    return this.get('logging.debug', false);
  }
}

const environment = new Environment();

module.exports = environment;
