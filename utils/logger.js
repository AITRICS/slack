const environment = require('../config/environment');

/**
 * 로그 레벨 우선순위
 */
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
  static _getCurrentLevel() {
    const level = environment.get('logging.level', 'info');
    return LOG_LEVELS[level] || LOG_LEVELS.info;
  }

  /**
   * 로그 포맷팅
   * @private
   * @param {string} level - 로그 레벨
   * @param {string} message - 메시지
   * @param {Array} args - 추가 인자들
   * @returns {Object|string}
   */
  static _format(level, message, args) {
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
   * @param {string} level - 로그 레벨
   * @param {string} message - 메시지
   * @param {Array} args - 추가 인자들
   */
  static _log(level, message, args) {
    const currentLevel = this._getCurrentLevel();
    const messageLevel = LOG_LEVELS[level];

    // 현재 로그 레벨보다 낮으면 출력하지 않음
    if (messageLevel < currentLevel) {
      return;
    }

    const formatted = this._format(level, message, args);
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
   * 디버그 로그
   * @param {string} message - 메시지
   * @param {...any} args - 추가 데이터
   */
  static debug(message, ...args) {
    this._log('debug', message, args);
  }

  /**
   * 정보 로그
   * @param {string} message - 메시지
   * @param {...any} args - 추가 데이터
   */
  static info(message, ...args) {
    this._log('info', message, args);
  }

  /**
   * 경고 로그
   * @param {string} message - 메시지
   * @param {...any} args - 추가 데이터
   */
  static warn(message, ...args) {
    this._log('warn', message, args);
  }

  /**
   * 에러 로그
   * @param {string} message - 메시지
   * @param {Error|any} [error] - 에러 객체 또는 추가 데이터
   * @param {...any} args - 추가 데이터
   */
  static error(message, error = null, ...args) {
    const isJsonFormat = environment.get('logging.formatJson', false);

    if (error instanceof Error) {
      if (isJsonFormat) {
        const errorData = {
          message: error.message,
          stack: error.stack,
          name: error.name,
          // 커스텀 에러의 추가 정보
          ...(error.code && { code: error.code }),
          ...(error.details && { details: error.details }),
        };
        this._log('error', message, [errorData, ...args]);
      } else {
        this._log('error', message, []);
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
    } else if (error) {
      this._log('error', message, [error, ...args]);
    } else {
      this._log('error', message, args);
    }
  }

  /**
   * 성능 측정 시작
   * @param {string} label - 측정 레이블
   */
  static time(label) {
    if (environment.isDebug()) {
      console.time(label);
    }
  }

  /**
   * 성능 측정 종료
   * @param {string} label - 측정 레이블
   */
  static timeEnd(label) {
    if (environment.isDebug()) {
      console.timeEnd(label);
    }
  }

  /**
   * 그룹 로깅 시작
   * @param {string} label - 그룹 레이블
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
   * @param {any} data - 테이블로 표시할 데이터
   */
  static table(data) {
    if (environment.isDebug() && !environment.get('logging.formatJson', false)) {
      console.table(data);
    }
  }
}

module.exports = Logger;
