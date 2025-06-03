// __tests__/utils/configValidator/validateActionType.test.js

const { expectErrorWithDetails } = require('@test/utils/configValidator/helpers');

describe('ConfigValidator.validateActionType', () => {
  let ConfigValidator;

  beforeAll(() => {
    ConfigValidator = require('@/utils/configValidator');
  });

  describe('유효한 액션 타입', () => {
    test.each([
      ['schedule', '스케줄 액션'],
      ['approve', '승인 액션'],
      ['comment', '코멘트 액션'],
      ['review_requested', '리뷰 요청 액션'],
      ['changes_requested', '변경 요청 액션'],
      ['deploy', '배포 액션'],
      ['ci', 'CI 액션'],
    ])('유효한 액션 타입: %s (%s)', (actionType, _description) => {
      expect(() => ConfigValidator.validateActionType(actionType)).not.toThrow();
    });
  });

  describe('유효하지 않은 액션 타입', () => {
    // 안전한 에러 메시지 생성 함수
    const getExpectedMessage = (actionType) => {
      try {
        // Symbol이나 다른 타입을 안전하게 문자열로 변환
        const actionStr = actionType?.toString?.() || String(actionType);
        return `유효하지 않은 액션 타입: ${actionStr}. 가능한 값: schedule, approve, comment, review_requested, changes_requested, deploy, ci`;
      } catch (error) {
        // Symbol을 문자열로 변환할 수 없는 경우
        return '유효하지 않은 액션 타입: [변환 불가능한 타입]. 가능한 값: schedule, approve, comment, review_requested, changes_requested, deploy, ci';
      }
    };

    test.each([
      ['invalid_action', '잘못된 액션 타입'],
      ['', '빈 문자열'],
      ['COMMENT', '대문자'],
      ['Schedule', '혼합 대소문자'],
      ['unknown', '알 수 없는 액션'],
      ['deployment', '비슷하지만 다른 액션'],
      ['review', '불완전한 액션명'],
    ])('유효하지 않은 액션 타입: "%s" (%s)', (actionType, _description) => {
      expectErrorWithDetails(
        () => ConfigValidator.validateActionType(actionType),
        getExpectedMessage(actionType),
        ['ACTION_TYPE'],
      );
    });

    // 특수 타입들은 별도로 처리 (Symbol 문제 방지)
    test.each([
      [null, 'null'],
      [undefined, 'undefined'],
      [123, '숫자'],
      [[], '배열'],
      [{}, '객체'],
      [true, '불린'],
      [false, '불린 false'],
    ])('유효하지 않은 액션 타입 (기본 타입): %s (%s)', (actionType, _description) => {
      expectErrorWithDetails(
        () => ConfigValidator.validateActionType(actionType),
        getExpectedMessage(actionType),
        ['ACTION_TYPE'],
      );
    });

    // Symbol은 따로 처리 (문자열 변환 오류 방지)
    test('Symbol 타입 액션은 유효하지 않음', () => {
      const symbolAction = Symbol('action');

      // Symbol을 직접 에러 메시지에 넣지 않고 별도 처리
      expect(() => ConfigValidator.validateActionType(symbolAction)).toThrow();

      // 발생한 에러의 메시지가 적절한지만 확인
      try {
        ConfigValidator.validateActionType(symbolAction);
      } catch (error) {
        expect(error.message).toContain('유효하지 않은 액션 타입');
        expect(error.missingFields).toEqual(['ACTION_TYPE']);
      }
    });

    // Date 객체도 별도 처리
    test('Date 객체 타입 액션은 유효하지 않음', () => {
      const dateAction = new Date();

      expectErrorWithDetails(
        () => ConfigValidator.validateActionType(dateAction),
        getExpectedMessage(dateAction),
        ['ACTION_TYPE'],
      );
    });
  });

  describe('경계값 테스트', () => {
    test('공백으로 둘러싸인 유효한 액션 타입은 무효', () => {
      expectErrorWithDetails(
        () => ConfigValidator.validateActionType(' comment '),
        '유효하지 않은 액션 타입:  comment . 가능한 값: schedule, approve, comment, review_requested, changes_requested, deploy, ci',
        ['ACTION_TYPE'],
      );
    });

    test('탭이나 개행이 포함된 액션 타입은 무효', () => {
      expectErrorWithDetails(
        () => ConfigValidator.validateActionType('comment\n'),
        '유효하지 않은 액션 타입: comment\n. 가능한 값: schedule, approve, comment, review_requested, changes_requested, deploy, ci',
        ['ACTION_TYPE'],
      );
    });
  });

  describe('성능 테스트', () => {
    test('대량의 유효하지 않은 액션 타입을 빠르게 처리', () => {
      const invalidActions = Array.from({ length: 100 }, (_, i) => `invalid_${i}`);

      const start = Date.now();
      invalidActions.forEach((actionType) => {
        expect(() => ConfigValidator.validateActionType(actionType)).toThrow();
      });
      const duration = Date.now() - start;

      // 완화된 기준: 100개 처리에 100ms 이내
      expect(duration).toBeLessThan(100);
    });

    test('여러 스레드에서 동시 검증', async () => {
      const validations = [
        'comment',
        'invalid',
        'deploy',
        'wrong',
        'ci',
      ].map((actionType) => Promise.resolve().then(() => {
        try {
          ConfigValidator.validateActionType(actionType);
          return { actionType, valid: true };
        } catch (error) {
          return { actionType, valid: false, error: error.message };
        }
      }));

      const results = await Promise.all(validations);

      expect(results).toEqual([
        { actionType: 'comment', valid: true },
        { actionType: 'invalid', valid: false, error: expect.stringContaining('유효하지 않은 액션 타입') },
        { actionType: 'deploy', valid: true },
        { actionType: 'wrong', valid: false, error: expect.stringContaining('유효하지 않은 액션 타입') },
        { actionType: 'ci', valid: true },
      ]);
    });
  });
});
