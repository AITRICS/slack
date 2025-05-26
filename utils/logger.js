const environment = require('../config/environment');

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * 개선된 로거 클래스
 * 타임스탬프, 로그 레벨, JSON 포맷 지원
 */
class Logger {
  /**
   * 현재 로그 레벨 가져오기
   * @private
   * @returns {number}
   */
  static #getCurrentLevel() {
    const level = environment.get('logging.level', 'info');
    return LOG_LEVELS[level] || LOG_LEVELS.info;
  }

  /**
   * 로그 메시지 포맷팅
   * @private
   * @param {string} level
   * @param {string} message
   * @param {Array} args
   * @returns {Object|string}
   */
  static #formatLogMessage(level, message, args) {
    const timestamp = new Date().toISOString();
    const isJsonFormat = environment.get('logging.formatJson', false);

    if (isJsonFormat) {
      return JSON.stringify({
        timestamp,
        level: level.toUpperCase(),
        message,
        data: args.length > 0 ? args : undefined,
      });
    }

    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  /**
   * 로그 출력
   * @private
   * @param {string} level
   * @param {string} message
   * @param {Array} args
   */
  static #writeLog(level, message, args) {
    const currentLevel = this.#getCurrentLevel();
    const messageLevel = LOG_LEVELS[level];

    if (messageLevel < currentLevel) {
      return;
    }

    const formatted = this.#formatLogMessage(level, message, args);
    const isJsonFormat = environment.get('logging.formatJson', false);

    if (level === 'error') {
      if (isJsonFormat) {
        console.error(formatted);
      } else {
        console.error(formatted, ...args);
      }
    } else if (isJsonFormat) {
      console.log(formatted);
    } else {
      console.log(formatted, ...args);
    }
  }

  /**
   * 에러 객체를 로그용 데이터로 변환
   * @private
   * @param {Error} error
   * @returns {Object}
   */
  static #formatErrorForLogging(error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...(error.code && { code: error.code }),
      ...(error.details && { details: error.details }),
    };
  }

  /**
   * 에러를 상세하게 출력 (JSON 형식이 아닐 때)
   * @private
   * @param {Error} error
   */
  static #logErrorDetails(error) {
    console.error('상세 에러:', error.message);

    if (error.stack && environment.isDebug()) {
      console.error('스택 트레이스:', error.stack);
    }

    if (error.code) {
      console.error('에러 코드:', error.code);
    }

    if (error.details) {
      console.error('추가 정보:', error.details);
    }
  }

  /**
   * 디버그 로그
   * @param {string} message
   * @param {...any} args
   */
  static debug(message, ...args) {
    this.#writeLog('debug', message, args);
  }

  /**
   * 정보 로그
   * @param {string} message
   * @param {...any} args
   */
  static info(message, ...args) {
    this.#writeLog('info', message, args);
  }

  /**
   * 경고 로그
   * @param {string} message
   * @param {...any} args
   */
  static warn(message, ...args) {
    this.#writeLog('warn', message, args);
  }

  /**
   * 에러 로그
   * @param {string} message
   * @param {Error|any} [error]
   * @param {...any} args
   */
  static error(message, error = null, ...args) {
    const isJsonFormat = environment.get('logging.formatJson', false);

    if (error instanceof Error) {
      if (isJsonFormat) {
        const errorData = this.#formatErrorForLogging(error);
        this.#writeLog('error', message, [errorData, ...args]);
      } else {
        this.#writeLog('error', message, []);
        this.#logErrorDetails(error);
      }
    } else if (error) {
      this.#writeLog('error', message, [error, ...args]);
    } else {
      this.#writeLog('error', message, args);
    }
  }

  /**
   * 성능 측정 시작
   * @param {string} label
   */
  static time(label) {
    if (environment.isDebug()) {
      console.time(label);
    }
  }

  /**
   * 성능 측정 종료
   * @param {string} label
   */
  static timeEnd(label) {
    if (environment.isDebug()) {
      console.timeEnd(label);
    }
  }

  /**
   * 그룹 로깅 시작
   * @param {string} label
   */
  static group(label) {
    if (!environment.get('logging.formatJson', false)) {
      console.group(label);
    }
  }

  /**
   * 그룹 로깅 종료
   */
  static groupEnd() {
    if (!environment.get('logging.formatJson', false)) {
      console.groupEnd();
    }
  }

  /**
   * 테이블 형태로 로깅
   * @param {any} data
   */
  static table(data) {
    if (environment.isDebug() && !environment.get('logging.formatJson', false)) {
      console.table(data);
    }
  }
}

module.exports = Logger;
