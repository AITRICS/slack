const Core = require('@actions/core');

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
        maxRetries: parseInt(process.env.MAX_RETRIES, 10) || 3,
        retryDelay: parseInt(process.env.RETRY_DELAY_MS, 10) || 1000,
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        debug: process.env.DEBUG === 'true',
        formatJson: process.env.LOG_FORMAT === 'json',
      },
      runtime: {
        timezone: process.env.TZ || 'Asia/Seoul',
      },
    };

    return this.#config;
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

  /**
   * 설정 재설정 (주로 테스트용)
   */
  reset() {
    this.#config = null;
  }

  /**
   * 안전한 로깅을 위한 설정 복사 (민감한 정보 제거)
   * @returns {Object}
   */
  toSafeObject() {
    const config = this.load();

    return {
      slack: {
        token: Environment.#maskToken(config.slack.token),
      },
      github: {
        token: Environment.#maskToken(config.github.token),
      },
      action: config.action,
      features: config.features,
      logging: config.logging,
      runtime: config.runtime,
    };
  }

  /**
   * 토큰 마스킹
   * @private
   * @param {string} token - 마스킹할 토큰
   * @returns {string} 마스킹된 토큰
   */
  static #maskToken(token) {
    if (!token || token.length < 8) return '***';
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }
}

const environment = new Environment();

module.exports = environment;
