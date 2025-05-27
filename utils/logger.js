const environment = require('../config/environment');
const { LOG_LEVELS } = require('../constants');

const LOG_LEVEL_VALUES = {
  [LOG_LEVELS.DEBUG]: 0,
  [LOG_LEVELS.INFO]: 1,
  [LOG_LEVELS.WARN]: 2,
  [LOG_LEVELS.ERROR]: 3,
};

/**
 * 개선된 로거 클래스
 * 타임스탬프, 로그 레벨, JSON 포맷 지원
 */
class Logger {
  /**
   * 현재 로그 레벨 가져오기
   * @private
   * @static
   * @returns {number}
   */
  static #getCurrentLevel() {
    const level = environment.get('logging.level', LOG_LEVELS.INFO);
    return LOG_LEVEL_VALUES[level] ?? LOG_LEVEL_VALUES[LOG_LEVELS.INFO];
  }

  /**
   * 로그 메시지 포맷팅
   * @private
   * @static
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
   * @static
   * @param {string} level
   * @param {string} message
   * @param {Array} args
   */
  static #writeLog(level, message, args) {
    const currentLevel = Logger.#getCurrentLevel();
    const messageLevel = LOG_LEVEL_VALUES[level];

    if (messageLevel < currentLevel) {
      return;
    }

    const formatted = Logger.#formatLogMessage(level, message, args);
    const isJsonFormat = environment.get('logging.formatJson', false);

    if (level === LOG_LEVELS.ERROR) {
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
   * @static
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
   * @static
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
   * @static
   * @param {string} message
   * @param {...any} args
   */
  static debug(message, ...args) {
    Logger.#writeLog(LOG_LEVELS.DEBUG, message, args);
  }

  /**
   * 정보 로그
   * @static
   * @param {string} message
   * @param {...any} args
   */
  static info(message, ...args) {
    Logger.#writeLog(LOG_LEVELS.INFO, message, args);
  }

  /**
   * 경고 로그
   * @static
   * @param {string} message
   * @param {...any} args
   */
  static warn(message, ...args) {
    Logger.#writeLog(LOG_LEVELS.WARN, message, args);
  }

  /**
   * 에러 로그
   * @static
   * @param {string} message
   * @param {Error|any} [error=null]
   * @param {...any} args
   */
  static error(message, error = null, ...args) {
    const isJsonFormat = environment.get('logging.formatJson', false);

    if (error instanceof Error) {
      if (isJsonFormat) {
        const errorData = Logger.#formatErrorForLogging(error);
        Logger.#writeLog(LOG_LEVELS.ERROR, message, [errorData, ...args]);
      } else {
        Logger.#writeLog(LOG_LEVELS.ERROR, message, []);
        Logger.#logErrorDetails(error);
      }
    } else if (error) {
      Logger.#writeLog(LOG_LEVELS.ERROR, message, [error, ...args]);
    } else {
      Logger.#writeLog(LOG_LEVELS.ERROR, message, args);
    }
  }

  /**
   * 성능 측정 시작
   * @static
   * @param {string} label
   */
  static time(label) {
    if (environment.isDebug()) {
      console.time(label);
    }
  }

  /**
   * 성능 측정 종료
   * @static
   * @param {string} label
   */
  static timeEnd(label) {
    if (environment.isDebug()) {
      console.timeEnd(label);
    }
  }

  /**
   * 조건부 로깅 (디버그 모드에서만)
   * @static
   * @param {string} message
   * @param {...any} args
   */
  static debugOnly(message, ...args) {
    if (environment.isDebug()) {
      Logger.debug(message, ...args);
    }
  }

  /**
   * 로깅 레벨 확인
   * @static
   * @param {string} level
   * @returns {boolean}
   */
  static isLevelEnabled(level) {
    const currentLevel = Logger.#getCurrentLevel();
    const targetLevel = LOG_LEVEL_VALUES[level];
    return targetLevel >= currentLevel;
  }
}

module.exports = Logger;
