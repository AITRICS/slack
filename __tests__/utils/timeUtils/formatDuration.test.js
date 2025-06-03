/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

const { measurePerformance } = require('@test/helpers');

describe('timeUtils.formatDuration', () => {
  let formatDuration;

  beforeAll(() => {
    ({ formatDuration } = require('@/utils/timeUtils'));
  });

  describe('정수 분 포맷팅', () => {
    test.each([
      [0, '0분 0초', '0분'],
      [1, '1분 0초', '1분'],
      [5, '5분 0초', '5분'],
      [30, '30분 0초', '30분'],
      [60, '60분 0초', '1시간'],
      [90, '90분 0초', '1시간 30분'],
      [120, '120분 0초', '2시간'],
    ])('입력: %s분 → 결과: "%s" (%s)', (totalMinutes, expected, _description) => {
      expect(formatDuration(totalMinutes)).toBe(expected);
    });
  });

  describe('소수점 분 포맷팅', () => {
    test.each([
      [0.5, '0분 30초', '30초'],
      [1.5, '1분 30초', '1분 30초'],
      [2.25, '2분 15초', '2분 15초'],
      [5.75, '5분 45초', '5분 45초'],
      [10.1, '10분 6초', '10분 6초'],
      [15.9, '15분 54초', '15분 54초'],
      [30.333, '30분 20초', '30분 20초 (반올림)'],
      [45.666, '45분 40초', '45분 40초 (반올림)'],
    ])('입력: %s분 → 결과: "%s" (%s)', (totalMinutes, expected, _description) => {
      expect(formatDuration(totalMinutes)).toBe(expected);
    });
  });

  describe('음수 값 처리 (Math.floor 동작)', () => {
    test.each([
      [-1, '-1분 0초', '음수 1분'],
      [-0.5, '-1분 30초', '음수 30초 (Math.floor(-0.5) = -1)'],
      [-1.5, '-2분 30초', '음수 1분 30초 (Math.floor(-1.5) = -2)'],
      [-10, '-10분 0초', '음수 10분'],
      [-15.75, '-16분 15초', '음수 15분 45초 (Math.floor(-15.75) = -16)'],
    ])('입력: %s분 → 결과: "%s" (%s)', (totalMinutes, expected, _description) => {
      expect(formatDuration(totalMinutes)).toBe(expected);
    });
  });

  describe('60초 버그 수정 확인', () => {
    test('59.999분은 이제 "60분 0초"로 올바르게 포맷됨', () => {
      // 60초 버그가 수정되어 올바르게 동작
      expect(formatDuration(59.999)).toBe('60분 0초');
    });

    test('1.9916667분 (1분 59.5초)는 이제 "2분 0초"로 올바르게 포맷됨', () => {
      // 반올림으로 인한 60초가 1분으로 올라감
      expect(formatDuration(1.9916667)).toBe('2분 0초');
    });

    test('1.99분 (1분 59.4초)는 "1분 59초"로 포맷됨', () => {
      expect(formatDuration(1.99)).toBe('1분 59초');
    });
  });

  describe('반올림 정확성 테스트', () => {
    test.each([
      [1.008333, '1분 0초', '1분 0.5초 → 0초로 반올림'],
      [1.016667, '1분 1초', '1분 1초 정확'],
      [1.024999, '1분 1초', '1분 1.5초 미만 → 1초로 반올림'],
      [1.025001, '1분 2초', '1분 1.5초 초과 → 2초로 반올림'],
      [1.983333, '1분 59초', '1분 59초'],
    ])('반올림: %s분 → "%s" (%s)', (totalMinutes, expected, _description) => {
      expect(formatDuration(totalMinutes)).toBe(expected);
    });
  });

  describe('경계값 테스트', () => {
    test('정확히 0분', () => {
      expect(formatDuration(0)).toBe('0분 0초');
    });

    test('매우 작은 값들', () => {
      expect(formatDuration(0.001)).toBe('0분 0초'); // 반올림으로 0초
      expect(formatDuration(0.01)).toBe('0분 1초');
      expect(formatDuration(0.25)).toBe('0분 15초');
    });

    test('큰 값들', () => {
      expect(formatDuration(1440)).toBe('1440분 0초'); // 하루
      expect(formatDuration(10080)).toBe('10080분 0초'); // 일주일
    });
  });

  describe('특수 값 처리', () => {
    test.each([
      [NaN, 'NaN분 NaN초', 'NaN 입력'],
      [Infinity, 'Infinity분 NaN초', '양의 무한대'],
      [-Infinity, '-Infinity분 NaN초', '음의 무한대'],
    ])('특수값: %s → "%s" (%s)', (totalMinutes, expected, _description) => {
      expect(formatDuration(totalMinutes)).toBe(expected);
    });
  });

  describe('타입 변환 처리 (JavaScript 기본 동작)', () => {
    test.each([
      ['5', '5분 0초', '문자열 숫자'],
      ['5.5', '5분 30초', '문자열 소수'],
      ['0', '0분 0초', '문자열 0'],
      ['abc', 'NaN분 NaN초', '문자열 (숫자 아님)'],
      [true, '1분 0초', 'true → 1'],
      [false, '0분 0초', 'false → 0'],
      [null, '0분 0초', 'null → 0'],
      [undefined, 'NaN분 NaN초', 'undefined → NaN'],
    ])('타입 변환: %s → "%s" (%s)', (input, expected, _description) => {
      expect(formatDuration(input)).toBe(expected);
    });
  });

  describe('실제 사용 사례', () => {
    test('GitHub Actions 워크플로우 시간 (5분 23초)', () => {
      const duration = 5.383333; // calculateDurationInMinutes 결과
      expect(formatDuration(duration)).toBe('5분 23초');
    });

    test('PR 리뷰 시간 (45분 30초)', () => {
      const duration = 45.5;
      expect(formatDuration(duration)).toBe('45분 30초');
    });

    test('배포 시간 (12분 45초)', () => {
      const duration = 12.75;
      expect(formatDuration(duration)).toBe('12분 45초');
    });

    test('빠른 빌드 (2분 5초)', () => {
      const duration = 2.083333;
      expect(formatDuration(duration)).toBe('2분 5초');
    });

    test('매우 빠른 작업 (15초)', () => {
      const duration = 0.25;
      expect(formatDuration(duration)).toBe('0분 15초');
    });

    test('긴 통합 테스트 (1시간 30분)', () => {
      const duration = 90;
      expect(formatDuration(duration)).toBe('90분 0초');
    });
  });

  describe('성능 테스트', () => {
    test('대량 포맷팅 성능', () => {
      const durations = Array.from({ length: 100 }, (_, i) => i * 0.5);

      const { duration } = measurePerformance(() => {
        durations.forEach((d) => {
          formatDuration(d);
        });
      });

      expect(duration).toBeLessThan(5); // 100회 포맷팅이 5ms 이내
    });
  });

  describe('통합 테스트 (calculateDurationInMinutes와 함께)', () => {
    test('워크플로우 시작부터 포맷까지 전체 플로우', () => {
      const { calculateDurationInMinutes } = require('@/utils/timeUtils');

      const workflowStart = '2024-01-01T10:00:00Z';
      const workflowEnd = '2024-01-01T10:07:30Z';

      const duration = calculateDurationInMinutes(workflowStart, workflowEnd);
      const formatted = formatDuration(duration);

      expect(formatted).toBe('7분 30초');
    });

    test('실시간 계산과 포맷팅', () => {
      const { calculateDurationInMinutes } = require('@/utils/timeUtils');

      const start = new Date();
      const end = new Date(start.getTime() + 3 * 60 * 1000); // 3분 후

      const duration = calculateDurationInMinutes(start, end);
      const formatted = formatDuration(duration);

      expect(formatted).toBe('3분 0초');
    });
  });

  describe('60초 처리 엣지 케이스', () => {
    test('정확히 60초가 되는 케이스들', () => {
      // 반올림으로 정확히 60초가 되는 값들
      expect(formatDuration(0.999)).toBe('1분 0초');
      expect(formatDuration(1.999)).toBe('2분 0초');
      expect(formatDuration(2.999)).toBe('3분 0초');
    });

    test('59초까지는 정상 처리', () => {
      expect(formatDuration(0.98)).toBe('0분 59초');
      expect(formatDuration(1.98)).toBe('1분 59초');
    });
  });
});
