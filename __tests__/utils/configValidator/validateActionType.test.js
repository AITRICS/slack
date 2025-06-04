const { expectErrorWithDetails } = require('@test/helpers');

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
    const getExpectedMessage = (actionType) => {
      try {
        const actionStr = actionType?.toString?.() || String(actionType);
        return `유효하지 않은 액션 타입: ${actionStr}. 가능한 값: schedule, approve, comment, review_requested, changes_requested, deploy, ci`;
      } catch (error) {
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
      expect.assertions(1);
      expectErrorWithDetails(
        () => ConfigValidator.validateActionType(actionType),
        getExpectedMessage(actionType),
        ['ACTION_TYPE'],
      );
    });

    test.each([
      [null, 'null'],
      [undefined, 'undefined'],
      [123, '숫자'],
      [[], '배열'],
      [{}, '객체'],
      [true, '불린'],
      [false, '불린 false'],
    ])('유효하지 않은 액션 타입 (기본 타입): %s (%s)', (actionType, _description) => {
      expect.assertions(1);
      expectErrorWithDetails(
        () => ConfigValidator.validateActionType(actionType),
        getExpectedMessage(actionType),
        ['ACTION_TYPE'],
      );
    });

    test('Symbol 타입 액션은 유효하지 않음', () => {
      const symbolAction = Symbol('action');
      expect(() => ConfigValidator.validateActionType(symbolAction)).toThrow();
      let thrownError = null;
      try {
        ConfigValidator.validateActionType(symbolAction);
      } catch (error) {
        thrownError = error;
      }
      expect(thrownError).not.toBeNull();
      expect(thrownError.message).toContain('유효하지 않은 액션 타입');
      expect(thrownError.details?.missingFields).toEqual(['ACTION_TYPE']);
    });

    test('Date 객체 타입 액션은 유효하지 않음', () => {
      expect.assertions(1);
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
      expect.assertions(1);
      expectErrorWithDetails(
        () => ConfigValidator.validateActionType(' comment '),
        '유효하지 않은 액션 타입:  comment . 가능한 값: schedule, approve, comment, review_requested, changes_requested, deploy, ci',
        ['ACTION_TYPE'],
      );
    });

    test('탭이나 개행이 포함된 액션 타입은 무효', () => {
      expect.assertions(1);
      expectErrorWithDetails(
        () => ConfigValidator.validateActionType('comment\n'),
        '유효하지 않은 액션 타입: comment\n. 가능한 값: schedule, approve, comment, review_requested, changes_requested, deploy, ci',
        ['ACTION_TYPE'],
      );
    });
  });

  describe('성능 테스트', () => {
    test.each(Array.from({ length: 100 }, (_, i) => [`invalid_${i}`]))(
      '유효하지 않은 액션 타입 %s은(는) 예외를 발생시킨다',
      (actionType) => {
        expect(() => ConfigValidator.validateActionType(actionType)).toThrow();
      },
    );

    // 성공 케이스
    test.each([
      ['comment'],
      ['deploy'],
      ['ci'],
    ])('액션 타입 "%s"는 예외 없이 동작해야 한다', (actionType) => {
      expect(() => ConfigValidator.validateActionType(actionType)).not.toThrow();
    });

    // 실패 케이스
    test.each([
      ['invalid'],
      ['wrong'],
    ])('액션 타입 "%s"는 예외를 발생시켜야 한다', (actionType) => {
      expect(() => ConfigValidator.validateActionType(actionType)).toThrow();
    });
  });
});
