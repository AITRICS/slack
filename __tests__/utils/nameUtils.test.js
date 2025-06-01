// nameUtils.test.js
/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

/* eslint-disable camelcase */
const createMember = ({
  id, real_name, display_name = null, deleted = false,
}) => ({
  id,
  real_name,
  deleted,
  profile: { display_name },
});

/* eslint-disable camelcase */
const buildBaseMembers = () => [
  createMember({ id: 'U001', real_name: '김희연' }),
  createMember({ id: 'U002', real_name: '김희연 A' }),
  createMember({ id: 'U003', real_name: '김희연 B' }),
  createMember({ id: 'U004', real_name: '석은주' }),
  createMember({ id: 'U005', real_name: '석한울' }),
  createMember({ id: 'U006', real_name: 'john (이주호)' }),
  createMember({ id: 'U007', real_name: 'john' }),
  createMember({ id: 'U008', real_name: 'johnny' }),
  createMember({ id: 'U009', real_name: 'bot-user' }),
  createMember({ id: 'U010', real_name: '이동민' }),
  createMember({ id: 'U011', real_name: '주현석' }),
  createMember({ id: 'U012', real_name: 'John Doe' }),
  createMember({ id: 'U013', real_name: 'deleted-user', deleted: true }),
];

const defaultMockConfig = {
  SLACK_CONFIG: {
    SKIP_USERS: ['john (이주호)', 'bot-user'],
  },
  USER_PRIORITY_MAPPING: {
    김희연: '김희연 A',
  },
};

describe('nameUtils', () => {
  let mockMembers;
  let Logger;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    mockMembers = buildBaseMembers();
  });

  describe('normalizeUserName', () => {
    let normalizeUserName;
    beforeEach(() => {
      jest.isolateModules(() => {
        jest.doMock('../../constants', () => defaultMockConfig);
        jest.doMock('../../utils/logger', () => ({
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
        }));
        ({ normalizeUserName } = require('../../utils/nameUtils'));
      });
    });

    test.each([
      ['김희연 A', '김희연', '한글 + 공백 제거'],
      ['최경환 (Ray)', '최경환', '한글 + 괄호 제거'],
      ['이동민(Rooney)', '이동민', '한글 + 괄호(공백없음) 제거'],
      ['주현석_dobby', '주현석', '한글 + 밑줄 뒤 제거'],
      ['Kim Minho', 'kimminho', '영문 + 공백 제거 + 소문자'],
      [' 박정수 ', '박정수', '앞뒤 공백 제거'],
      ['최경환123 (Ray)!', '최경환', '한글 + 숫자/특수문자 + 괄호 제거'],
      ['John Doe', 'johndoe', '영문 + 공백 제거 + 소문자'],
      ['12345', '', '숫자만 있으면 빈 문자열'],
      ['999', '', '숫자만 있으면 빈 문자열'],
      ['', '', '빈 문자열'],
      [null, '', 'null'],
      [undefined, '', 'undefined'],
      ['(Developer)', '', '괄호만 있으면 빈 문자열'],
      ['_nickname', '', '밑줄로 시작하면 빈 문자열'],
    ])('%s → %s (%s)', (input, expected, _desc) => {
      expect(normalizeUserName(input)).toBe(expected);
    });
  });

  describe('shouldSkipUser', () => {
    let shouldSkipUser;

    beforeEach(() => {
      jest.isolateModules(() => {
        jest.doMock('../../constants', () => defaultMockConfig);
        jest.doMock('../../utils/logger', () => ({
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
        }));

        ({ shouldSkipUser } = require('../../utils/nameUtils'));
      });
    });

    test.each([
      [createMember({ id: 'U100', real_name: 'john (이주호)' }), true, 'real_name이 스킵 대상'],
      [createMember({ id: 'U101', real_name: 'bot-user' }), true, 'real_name이 스킵 대상'],
      [createMember({ id: 'U102', real_name: 'normal', display_name: 'john (이주호)' }), true, 'display_name이 스킵 대상'],
      [createMember({ id: 'U103', real_name: 'john' }), false, '일반 사용자'],
      [createMember({ id: 'U104', real_name: 'johnny' }), false, '부분 포함되지만 스킵 안됨'],
      [createMember({ id: 'U105', real_name: null }), false, 'null real_name'],
    ])('사용자 %s → 스킵: %s (%s)', (user, expectedSkip, _desc) => {
      expect(shouldSkipUser(user)).toBe(expectedSkip);
    });
  });

  describe('findSlackUserProperty', () => {
    let findSlackUserProperty;
    let LoggerSpy;

    beforeEach(() => {
      jest.isolateModules(() => {
        jest.doMock('../../constants', () => defaultMockConfig);

        const loggerMock = {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
        };
        jest.doMock('../../utils/logger', () => loggerMock);

        ({ findSlackUserProperty } = require('../../utils/nameUtils'));
        Logger = require('../../utils/logger');
        LoggerSpy = Logger;
      });
    });

    const run = (members, name, prop = 'id') => findSlackUserProperty(members, name, prop);

    describe('property 파라미터 처리', () => {
      test.each([
        ['id', 'U004', 'id 속성'],
        ['ID', 'U004', '대문자 ID → 정규화'],
        ['Id', 'U004', '혼합 대소문자 → 정규화'],
        ['realName', '석은주', 'realName 속성'],
        ['REALNAME', '석은주', '대문자 REALNAME → 정규화'],
        ['RealName', '석은주', '혼합 대소문자 → 정규화'],
        ['invalidProperty', '석은주', '잘못된 속성 → fallback'],
        [null, '석은주', 'null 속성 → fallback'],
        [undefined, 'U004', 'undefined 속성 → 기본값 id 적용'],
      ])('property: %s → %s (%s)', (property, expected, _desc) => {
        expect(run(mockMembers, '석은주', property)).toBe(expected);
      });
    });

    describe('기본 매칭 시나리오', () => {
      test.each([
        ['석은주', 'U004', '완전 일치'],
        ['석한울', 'U005', '완전 일치'],
        ['이동민(Rooney)', 'U010', 'GitHub 괄호 패턴 매칭'],
        ['주현석_dobby', 'U011', 'GitHub 밑줄 패턴 매칭'],
        ['John Doe', 'U012', '영문 공백 패턴 매칭'],
        ['존재하지않는이름', '존재하지않는이름', '매칭 실패 → 원본 반환'],
        ['12345', '12345', '숫자만 → 원본 반환'],
      ])('GitHub: "%s" → Slack: %s (%s)', (githubName, expected, _desc) => {
        const result = run(mockMembers, githubName);
        expect(result).toBe(expected);
      });
    });

    describe('우선순위 매핑', () => {
      test('기본 우선순위 매핑 적용', () => {
        expect(run(mockMembers, '김희연')).toBe('U002');

        expect(LoggerSpy.info).toHaveBeenCalledWith(
          '우선순위 매핑 적용',
          expect.objectContaining({
            githubRealName: '김희연',
            prioritySlackName: '김희연 A',
            selectedUserId: 'U002',
          }),
        );
      });

      test('커스텀 우선순위 매핑', () => {
        jest.isolateModules(() => {
          jest.doMock('../../constants', () => ({
            SLACK_CONFIG: { SKIP_USERS: [] },
            USER_PRIORITY_MAPPING: { Foo: 'Bar' },
          }));
          jest.doMock('../../utils/logger', () => ({
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
          }));

          const { findSlackUserProperty: localFindSlackUserProperty } = require('../../utils/nameUtils');
          const LocalLogger = require('../../utils/logger');

          const customMembers = [
            createMember({ id: 'U200', real_name: 'Bar' }),
            createMember({ id: 'U201', real_name: 'Normal' }),
          ];

          const result = localFindSlackUserProperty(customMembers, 'Foo', 'id');
          expect(result).toBe('U200');

          expect(LocalLogger.info).toHaveBeenCalledWith(
            '우선순위 매핑 적용',
            expect.objectContaining({
              githubRealName: 'Foo',
              prioritySlackName: 'Bar',
              selectedUserId: 'U200',
            }),
          );
        });
      });

      test('우선순위 매핑 실패 후 완전 일치 처리', () => {
        const testMembers = [
          createMember({ id: 'U300', real_name: '김희연ABC' }), // 정규화 → "김희연"
          createMember({ id: 'U301', real_name: '김희연DEF' }), // 정규화 → "김희연"
        ];

        const result = run(testMembers, '김희연');
        expect(result).toBe('U300'); // 첫 번째 선택

        // 우선순위 매핑 실패 로그
        expect(LoggerSpy.warn).toHaveBeenCalledWith(
          '우선순위 매핑된 사용자를 찾을 수 없음',
          expect.objectContaining({
            githubRealName: '김희연',
            prioritySlackName: '김희연 A',
          }),
        );

        // 여러 완전 일치 발견 로그
        expect(LoggerSpy.warn).toHaveBeenCalledWith(
          '여러 완전 일치 발견, 첫 번째 사용',
          expect.objectContaining({
            githubRealName: '김희연',
          }),
        );
      });
    });

    describe('Skip 사용자 처리', () => {
      test('Skip 대상 제외 후 매칭', () => {
        expect(run(mockMembers, 'john')).toBe('U007');
      });

      test('Skip 대상 자체 검색', () => {
        expect(run(mockMembers, 'john (이주호)')).toBe('john (이주호)');
        expect(run(mockMembers, 'bot-user')).toBe('bot-user');
        expect(LoggerSpy.warn).toHaveBeenCalledWith(
          '검색 대상이 스킵 사용자',
          expect.objectContaining({
            githubRealName: 'john (이주호)',
          }),
        );
      });

      test('display_name만 skip 대상인 사용자', () => {
        const mixedMembers = [
          ...mockMembers,
          createMember({ id: 'U400', real_name: 'normal-user', display_name: 'bot-user' }),
        ];
        // display_name이 skip 대상이면 매칭에서 제외, 완전 일치 없으니 원본 반환
        expect(run(mixedMembers, 'normal-user')).toBe('normal-user');
      });
    });

    describe('다중 매칭 처리', () => {
      test('동일한 이름 여러 명 - 완전 일치', () => {
        const multiExactMembers = [
          createMember({ id: 'U500', real_name: 'duplicate' }),
          createMember({ id: 'U501', real_name: 'duplicate' }),
          createMember({ id: 'U502', real_name: 'john (이주호)' }), // skip 대상
        ];

        expect(run(multiExactMembers, 'duplicate')).toBe('U500');

        expect(LoggerSpy.warn).toHaveBeenCalledWith(
          '여러 완전 일치 발견, 첫 번째 사용',
          expect.objectContaining({
            githubRealName: 'duplicate',
            matches: expect.arrayContaining([
              expect.objectContaining({ id: 'U500' }),
              expect.objectContaining({ id: 'U501' }),
            ]),
          }),
        );
      });
    });

    describe('삭제된 사용자 및 특수 케이스', () => {
      test('deleted: true 사용자 무시', () => {
        const deletedTestMembers = [
          createMember({ id: 'U700', real_name: 'active-user' }),
          createMember({ id: 'U701', real_name: 'active-user', deleted: true }),
        ];

        expect(run(deletedTestMembers, 'active-user')).toBe('U700');
      });

      test('정규화 후 빈 문자열인 경우', () => {
        expect(run(mockMembers, '(Developer)')).toBe('(Developer)');
        expect(run(mockMembers, '_nickname')).toBe('_nickname');

        expect(LoggerSpy.warn).toHaveBeenCalledWith(
          '정규화된 이름이 빈 문자열',
          expect.objectContaining({
            githubRealName: '(Developer)',
          }),
        );
      });

      test('매칭 실패 시 로그 검증', () => {
        expect(run(mockMembers, '존재하지않는이름')).toBe('존재하지않는이름');

        expect(LoggerSpy.warn).toHaveBeenCalledWith(
          '매칭되는 Slack 사용자 없음',
          expect.objectContaining({
            githubRealName: '존재하지않는이름',
            normalizedSearchName: '존재하지않는이름',
          }),
        );
      });
    });
  });
});
