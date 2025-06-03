/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

const { measurePerformance } = require('@test/helpers');

describe('timeUtils.calculateDurationInMinutes', () => {
  let calculateDurationInMinutes;

  beforeAll(() => {
    ({ calculateDurationInMinutes } = require('@/utils/timeUtils'));
  });

  describe('정상적인 계산', () => {
    test.each([
      [
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T10:01:00Z'),
        1,
        'Date 객체 - 1분 차이',
      ],
      [
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T10:30:00Z'),
        30,
        'Date 객체 - 30분 차이',
      ],
      [
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T12:00:00Z'),
        120,
        'Date 객체 - 2시간 차이',
      ],
      [
        '2024-01-01T10:00:00Z',
        '2024-01-01T10:01:00Z',
        1,
        'ISO 문자열 - 1분 차이',
      ],
      [
        '2024-01-01 10:00:00',
        '2024-01-01 10:05:30',
        5.5,
        '문자열 날짜 - 5분 30초 차이',
      ],
      [
        new Date('2024-01-01T10:00:00Z'),
        '2024-01-01T10:15:00Z',
        15,
        '혼합 타입 - Date와 문자열',
      ],
      [
        '2024-01-01T10:15:00Z',
        new Date('2024-01-01T10:00:00Z'),
        -15,
        '역순 입력 - 음수 결과',
      ],
    ])('입력: %s, %s → 결과: %s분 (%s)', (startTime, endTime, expected, _description) => {
      const result = calculateDurationInMinutes(startTime, endTime);
      expect(result).toBeCloseTo(expected, 1);
    });
  });

  describe('경계값 테스트', () => {
    test('동일한 시간 - 0분', () => {
      const sameTime = new Date('2024-01-01T10:00:00Z');
      expect(calculateDurationInMinutes(sameTime, sameTime)).toBe(0);
    });

    test('매우 작은 시간 차이 - 밀리초 단위', () => {
      const start = new Date('2024-01-01T10:00:00.000Z');
      const end = new Date('2024-01-01T10:00:00.500Z');
      const result = calculateDurationInMinutes(start, end);
      expect(result).toBeCloseTo(0.00833, 3); // 500ms = 0.00833분
    });

    test('하루 차이', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-02T00:00:00Z');
      expect(calculateDurationInMinutes(start, end)).toBe(1440); // 24 * 60
    });
  });

  describe('다양한 날짜 형식', () => {
    test.each([
      ['2024-01-01', '2024-01-01', 0, 'YYYY-MM-DD 형식'],
      ['Jan 1, 2024', 'Jan 1, 2024 01:00', 60, '영문 월명 형식'],
      ['2024/01/01 10:00', '2024/01/01 11:30', 90, 'YYYY/MM/DD 형식'],
    ])('형식: %s → %s = %s분 (%s)', (startTime, endTime, expected, _description) => {
      const result = calculateDurationInMinutes(startTime, endTime);
      expect(result).toBeCloseTo(expected, 1);
    });
  });

  describe('타임존 처리', () => {
    test('다른 타임존 - UTC vs KST', () => {
      const utcTime = '2024-01-01T10:00:00Z';
      const kstTime = '2024-01-01T19:00:00+09:00'; // 같은 시각
      const result = calculateDurationInMinutes(utcTime, kstTime);
      expect(result).toBeCloseTo(0, 1);
    });

    test('타임존 차이로 인한 계산', () => {
      const time1 = '2024-01-01T10:00:00Z';
      const time2 = '2024-01-01T10:00:00+01:00'; // 1시간 앞선 타임존
      const result = calculateDurationInMinutes(time1, time2);
      expect(result).toBeCloseTo(-60, 1); // 1시간 = 60분 차이
    });
  });

  describe('잘못된 입력 처리', () => {
    test.each([
      ['invalid-date', '2024-01-01T10:00:00Z', '잘못된 시작 시간'],
      ['2024-01-01T10:00:00Z', 'invalid-date', '잘못된 종료 시간'],
      ['', '2024-01-01T10:00:00Z', '빈 문자열 시작'],
      ['2024-01-01T10:00:00Z', '', '빈 문자열 종료'],
      [undefined, '2024-01-01T10:00:00Z', 'undefined 시작 시간'],
      ['2024-01-01T10:00:00Z', undefined, 'undefined 종료 시간'],
    ])('잘못된 입력: %s, %s (%s)', (startTime, endTime, _description) => {
      const result = calculateDurationInMinutes(startTime, endTime);
      expect(result).toBeNaN();
    });

    test('null 입력 처리 (특별 케이스)', () => {
      // new Date(null)은 new Date(0)과 같아서 1970-01-01 00:00:00 UTC가 됨
      const result1 = calculateDurationInMinutes(null, '2024-01-01T10:00:00Z');
      const result2 = calculateDurationInMinutes('2024-01-01T10:00:00Z', null);

      // null은 1970년으로 변환되므로 실제 숫자가 나옴
      expect(typeof result1).toBe('number');
      expect(typeof result2).toBe('number');
      expect(result1).not.toBeNaN();
      expect(result2).not.toBeNaN();
    });
  });

  describe('성능 테스트', () => {
    test('대량 계산 성능', () => {
      const start = new Date('2024-01-01T10:00:00Z');
      const testData = Array.from({ length: 100 }, (_, i) => [
        start,
        new Date(start.getTime() + i * 60000), // i분씩 증가
      ]);

      const { duration } = measurePerformance(() => {
        testData.forEach(([startDate, endDate]) => {
          calculateDurationInMinutes(startDate, endDate);
        });
      });

      expect(duration).toBeLessThan(10); // 100회 계산이 10ms 이내
    });
  });

  describe('실제 사용 사례', () => {
    test('GitHub Actions 워크플로우 실행 시간', () => {
      const workflowStart = '2024-01-01T10:00:00Z';
      const workflowEnd = '2024-01-01T10:05:23Z';
      const result = calculateDurationInMinutes(workflowStart, workflowEnd);
      expect(result).toBeCloseTo(5.383, 2); // 5분 23초
    });

    test('PR 리뷰 소요 시간', () => {
      const prCreated = new Date('2024-01-01T09:00:00Z');
      const reviewCompleted = new Date('2024-01-01T09:45:30Z');
      const result = calculateDurationInMinutes(prCreated, reviewCompleted);
      expect(result).toBeCloseTo(45.5, 1); // 45분 30초
    });

    test('배포 프로세스 소요 시간', () => {
      const deployStart = new Date('2024-01-01T14:00:00Z');
      const deployEnd = new Date('2024-01-01T14:12:45Z');
      const result = calculateDurationInMinutes(deployStart, deployEnd);
      expect(result).toBeCloseTo(12.75, 1); // 12분 45초
    });

    test('빠른 테스트 실행 (30초)', () => {
      const testStart = new Date('2024-01-01T10:00:00Z');
      const testEnd = new Date('2024-01-01T10:00:30Z');
      const result = calculateDurationInMinutes(testStart, testEnd);
      expect(result).toBeCloseTo(0.5, 1); // 30초 = 0.5분
    });
  });
});
