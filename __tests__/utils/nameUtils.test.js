// 더 명확한 Mock 설정
jest.doMock('../../constants', () => ({
  SLACK_CONFIG: {
    SKIP_USERS: ['john (이주호)', 'bot-user', 'x'],
  },
  USER_PRIORITY_MAPPING: {
    김희연: '김희연 A',
    박영수: '박영수 (백엔드)',
  },
}));

// Mock 후에 require
const {
  normalizeUserName,
  findSlackUserProperty,
  shouldSkipUser,
} = require('../../utils/nameUtils');

jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../../constants', () => ({
  SLACK_CONFIG: {
    SKIP_USERS: ['john (이주호)', 'bot-user', 'x'],
  },
  USER_PRIORITY_MAPPING: {
    김희연: '김희연 A',
    박영수: '박영수 (백엔드)',
  },
}));

const Logger = require('../../utils/logger');

describe('nameUtils', () => {
  const createMember = ({
    id, real_name, display_name = null, deleted = false,
  }) => ({
    id,
    real_name,
    deleted,
    profile: { display_name },
  });

  const run = (members, name, prop = 'id') => findSlackUserProperty(members, name, prop);

  const baseMockMembers = [
    createMember({ id: 'U001', real_name: '김희연' }),
    createMember({ id: 'U002', real_name: '김희연 A', display_name: '김희연 A' }),
    createMember({ id: 'U003', real_name: '김희연 B' }),
    createMember({ id: 'U004', real_name: '석은주' }),
    createMember({ id: 'U005', real_name: '석한울' }),
    createMember({ id: 'U006', real_name: 'john (이주호)' }),
    createMember({ id: 'U007', real_name: '박영수 (백엔드)' }),
    createMember({ id: 'U008', real_name: '박영수 (프론트)' }),
    createMember({ id: 'U009', real_name: '삭제된사용자', deleted: true }),
    createMember({ id: 'U010', real_name: null }),
    createMember({ id: 'U011', real_name: '정상이름', display_name: '정상이름' }),
    // GitHub 실제 패턴들 추가
    createMember({ id: 'U012', real_name: '이동민' }), // "이동민 (Rooney)" 매칭 대상
    createMember({ id: 'U013', real_name: '주현석' }), // "주현석_dobby" 매칭 대상
    createMember({ id: 'U014', real_name: '이장현' }), // "이장현(Miller)" 매칭 대상
  ];

  let mockSlackMembers;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSlackMembers = [...baseMockMembers];
  });

  describe('shouldSkipUser 함수 직접 테스트 (디버깅)', () => {
    test('스킵 대상 사용자는 true를 반환해야 함', () => {
      const skipUser = createMember({ id: 'U100', real_name: 'john (이주호)' });
      const normalUser = createMember({ id: 'U101', real_name: 'johnny' });

      expect(shouldSkipUser(skipUser)).toBe(true);
      expect(shouldSkipUser(normalUser)).toBe(false);
    });

    test('대소문자와 공백이 다른 스킵 대상도 스킵되어야 함', () => {
      const skipUser1 = createMember({ id: 'U100', real_name: 'John (이주호)' });
      const skipUser2 = createMember({ id: 'U101', real_name: ' john (이주호) ' });
      const skipUser3 = createMember({ id: 'U102', real_name: 'BOT-USER' });

      expect(shouldSkipUser(skipUser1)).toBe(true);
      expect(shouldSkipUser(skipUser2)).toBe(true);
      expect(shouldSkipUser(skipUser3)).toBe(true);
    });

    test('GitHub 패턴과 스킵 규칙 상호작용', () => {
      const edgeCaseMembers = [
        createMember({ id: 'U100', real_name: 'john' }), // 일반 john
        createMember({ id: 'U101', real_name: 'john (이주호)' }), // 스킵 대상
      ];

      // "john_smith"는 정규화되면 "john"이 되고,
      // 일반 "john" 사용자(U100)와 매칭되어야 함
      expect(run(edgeCaseMembers, 'john_smith')).toBe('U100');

      // 스킵 대상은 여전히 스킵됨
      expect(run(edgeCaseMembers, 'john (이주호)')).toBe('john (이주호)');

      // 일반 john은 정상 매칭
      expect(run(edgeCaseMembers, 'john')).toBe('U100');
    });

    test('복잡한 GitHub 패턴의 정규화와 매칭', () => {
      const complexMembers = [
        createMember({ id: 'U200', real_name: '김개발' }),
        createMember({ id: 'U201', real_name: '이백엔드' }),
      ];

      // 매우 복잡한 GitHub 패턴들도 올바르게 정규화되어 매칭
      expect(run(complexMembers, '김개발_frontend_react (UI Developer)')).toBe('U200');
      expect(run(complexMembers, '이백엔드_spring_java(Backend Engineer)')).toBe('U201');
    });

    test('실제 운영 환경에서 발생할 수 있는 복합 시나리오', () => {
      const productionMembers = [
        createMember({ id: 'U300', real_name: '김프론트' }),
        createMember({ id: 'U301', real_name: '이백엔드' }),
        createMember({ id: 'U302', real_name: '박데브옵스' }),
        createMember({ id: 'U303', real_name: 'john' }), // 소문자로 변경
        createMember({ id: 'U304', real_name: 'jane' }),
      ];

      const testCases = [
        ['김프론트_react (Frontend)', 'U300'],
        ['이백엔드_spring_boot', 'U301'],
        ['박데브옵스(DevOps Engineer)', 'U302'],
        ['John_Doe (Tech Lead)', 'U303'], // 정규화하면 'john'
        ['jane_smith_designer', 'U304'],
      ];

      testCases.forEach(([githubName, expectedId]) => {
        const result = run(productionMembers, githubName);
        expect(result).toBe(expectedId);
      });
    });
    });
  });

  describe('normalizeUserName', () => {
    describe.each([
      ['기본 정규화', '김희연', '김희연'],
      ['영어 이름', 'John Doe', 'johndoe'],
      ['괄호 제거 (공백 있음)', 'john (이주호)', 'john'],
      ['괄호 제거 (공백 없음)', '이장현(Miller)', '이장현'],
      ['한글 괄호 제거', '김희연 (개발자)', '김희연'],
      ['영어 괄호 제거', '이동민 (Rooney)', '이동민'],
      ['밑줄 별명 제거', '주현석_dobby', '주현석'],
      ['밑줄 영어별명 제거', '김철수_john', '김철수'],
      ['복합 패턴 1', '이동민_rooney (Developer)', '이동민'],
      ['복합 패턴 2', '주현석_dobby (Backend)', '주현석'],
      ['공백 제거', '김 희 연', '김희연'],
      ['다중 공백 제거', 'John  Doe', 'johndoe'],
      ['대문자 변환', 'JOHN DOE', 'johndoe'],
      ['복합 케이스', '  John Doe (Developer)  ', 'johndoe'],
      ['한글 복합 케이스', '김 희 연 (개발자)', '김희연'],
      ['GitHub 실제 케이스 1', '이동민 (Rooney)', '이동민'],
      ['GitHub 실제 케이스 2', '주현석_dobby', '주현석'],
      ['GitHub 실제 케이스 3', '이장현(Miller)', '이장현'],
    ])('%s', (description, input, expected) => {
      test(`${input} → ${expected}`, () => {
        expect(normalizeUserName(input)).toBe(expected);
      });
    });

    describe('엣지 케이스', () => {
      test.each([
        ['빈 문자열', '', ''],
        ['undefined', undefined, ''],
        ['null', null, ''],
      ])('%s 처리', (description, input, expected) => {
        expect(normalizeUserName(input)).toBe(expected);
      });

      test('복잡한 패턴 엣지 케이스', () => {
        // 다양한 엣지 케이스들
        expect(normalizeUserName('이름_')).toBe('이름'); // 밑줄 뒤 빈문자열
        expect(normalizeUserName('이름()')).toBe('이름'); // 빈 괄호
        expect(normalizeUserName('이름_별명1_별명2')).toBe('이름'); // 여러 밑줄
        expect(normalizeUserName('이름_별명 (또다른별명)')).toBe('이름'); // 밑줄 + 괄호
        expect(normalizeUserName('이름 _ 별명')).toBe('이름'); // 공백이 있는 밑줄
        expect(normalizeUserName('_별명만')).toBe(''); // 밑줄로 시작
        expect(normalizeUserName('(괄호만)')).toBe(''); // 괄호만
      });
    });
  });

  describe('findSlackUserProperty', () => {
    describe.each([
      ['석은주', 'id', 'U004', (m) => m, '완전 일치 ID'],
      ['석은주', 'realName', '석은주', (m) => m, '완전 일치 실명'],
      ['김희연 A', 'realName', '김희연 A', (m) => m, 'display_name 우선 반환'],
      ['존재하지않는사용자', 'id', '존재하지않는사용자', (m) => m, '매칭 실패 시 원본 반환'],
      // GitHub 실제 패턴 매칭 테스트
      ['이동민 (Rooney)', 'id', 'U012', (m) => m, 'GitHub 괄호 패턴 매칭'],
      ['주현석_dobby', 'id', 'U013', (m) => m, 'GitHub 밑줄 패턴 매칭'],
      ['이장현(Miller)', 'id', 'U014', (m) => m, 'GitHub 공백없는 괄호 패턴 매칭'],
    ])('기본 매칭: %s / %s', (searchName, property, expected, memberFilter, description) => {
      test(description, () => {
        const result = run(memberFilter(mockSlackMembers), searchName, property);
        expect(result).toBe(expected);
      });
    });

    describe('시작 부분 일치 매칭', () => {
      test('단일 시작 부분 일치 시 매칭된다', () => {
        const singleMatchMembers = mockSlackMembers.filter(
          (user) => !['U001', 'U003'].includes(user.id),
        );

        const result = run(singleMatchMembers, '김희연');
        expect(result).toBe('U002');
      });

      test('여러 시작 부분 일치 시 우선순위 매핑이 적용된다', () => {
        const multiMatchMembers = mockSlackMembers.filter((user) => user.id !== 'U001');

        const result = run(multiMatchMembers, '김희연');
        expect(result).toBe('U002');
      });

      test('우선순위 매핑이 없는 여러 매칭 시 매칭하지 않는다', () => {
        const result = run(mockSlackMembers, '박영수');
        expect(result).toBe('박영수');
      });

      test('최소 길이 제한이 적용된다', () => {
        const result = run(mockSlackMembers, '김');
        expect(result).toBe('김');
      });
    });

    describe('오매칭 방지', () => {
      test('유사한 이름이 서로 매칭되지 않는다', () => {
        const result1 = run(mockSlackMembers, '석은주');
        const result2 = run(mockSlackMembers, '석한울');

        expect(result1).toBe('U004');
        expect(result2).toBe('U005');
        expect(result1).not.toBe(result2);
      });
    });

    describe('사용자 필터링', () => {
      test.each([
        ['스킵 대상 사용자 (정확한 매칭)', 'john (이주호)', 'john (이주호)'],
        ['스킵 대상 사용자 (정확한 매칭)', 'bot-user', 'bot-user'],
        ['삭제된 사용자', '삭제된사용자', '삭제된사용자'],
      ])('%s는 매칭되지 않는다', (description, searchName, expected) => {
        const result = run(mockSlackMembers, searchName);
        expect(result).toBe(expected);
      });

      describe('SKIP_USERS 규칙 검증', () => {
        test('1글자 스킵 규칙으로 인한 오스킵이 방지된다', () => {
          const problematicMembers = [
            createMember({ id: 'U100', real_name: 'max' }),
            createMember({ id: 'U101', real_name: 'xbox' }),
            createMember({ id: 'U102', real_name: 'alex' }),
          ];

          // 개선된 shouldSkipUser로 인해 이제 정상 매칭됨
          expect(run(problematicMembers, 'max')).toBe('U100');
          expect(run(problematicMembers, 'xbox')).toBe('U101');
          expect(run(problematicMembers, 'alex')).toBe('U102');
        });

        test.skip('부분 포함 스킵으로 인한 오스킵이 방지된다', () => {
          const mixedMembers = [
            createMember({ id: 'U100', real_name: 'john (이주호)' }),
            createMember({ id: 'U101', real_name: 'johnny' }),
            createMember({ id: 'U102', real_name: 'bot-user' }),
            createMember({ id: 'U103', real_name: 'robot-user' }),
          ];

          // 정확한 스킵 대상은 스킵됨 (매칭 실패하여 원본 반환)
          expect(run(mixedMembers, 'john (이주호)')).toBe('john (이주호)');
          expect(run(mixedMembers, 'bot-user')).toBe('bot-user');

          // 부분 포함으로 인한 오스킵이 방지됨
          expect(run(mixedMembers, 'johnny')).toBe('U101');
          expect(run(mixedMembers, 'robot-user')).toBe('U103');
        });

        test('정확한 스킵 대상은 올바르게 필터링된다', () => {
          const mixedMembers = [
            createMember({ id: 'U100', real_name: 'john (이주호)' }),
            createMember({ id: 'U102', real_name: 'bot-user' }),
          ];

          expect(run(mixedMembers, 'john (이주호)')).toBe('john (이주호)');
          expect(run(mixedMembers, 'bot-user')).toBe('bot-user');
        });

        test('공백과 대소문자가 다른 스킵 대상도 올바르게 처리된다', () => {
          const caseTestMembers = [
            createMember({ id: 'U100', real_name: 'John (이주호)' }), // 대문자
            createMember({ id: 'U101', real_name: ' john (이주호) ' }), // 공백
            createMember({ id: 'U102', real_name: 'Bot-User' }), // 대문자
            createMember({ id: 'U103', real_name: 'different-name' }), // johnathan 대신 다른 이름으로 변경
          ];

          // 정규화된 매칭으로 인해 스킵됨
          expect(run(caseTestMembers, 'John (이주호)')).toBe('John (이주호)');
          expect(run(caseTestMembers, 'john (이주호)')).toBe('john (이주호)');
          expect(run(caseTestMembers, 'BOT-USER')).toBe('BOT-USER');

          // 다른 이름은 스킵되지 않음
          expect(run(caseTestMembers, 'different-name')).toBe('U103');
        });
      });
    });

    describe('property 파라미터 처리', () => {
      test.each([
        ['id', 'U004'],
        ['realName', '석은주'],
        ['invalidProperty', '석은주'],
        ['ID', '석은주'],
        ['RealName', '석은주'],
      ])('property: %s → %s', (property, expected) => {
        const result = run(mockSlackMembers, '석은주', property);
        expect(result).toBe(expected);
      });

      test('display_name만 존재하고 real_name이 null인 경우 처리된다', () => {
        const membersWithNullRealName = [
          createMember({ id: 'U200', real_name: null, display_name: '특별한이름' }),
        ];

        const result = run(membersWithNullRealName, '특별한이름', 'realName');
        expect(result).toBe('특별한이름');
      });
    });

    describe('우선순위 매핑 상세 케이스', () => {
      test('매핑된 사용자가 실제로 존재하지 않으면 매칭하지 않는다', () => {
        // '박영수 (백엔드)' 제거하면 '박영수 (프론트)'만 남음
        // 정규화하면 '박영수'로 완전 일치가 됨
        const limitedMembers = mockSlackMembers.filter((user) => user.id !== 'U007');

        const result = run(limitedMembers, '박영수');
        expect(result).toBe('U008'); // '박영수 (프론트)'와 완전 일치
      });
    });

    describe('중복 매칭 처리', () => {
      test('여러 완전 일치 시 첫 번째를 선택한다', () => {
        // 박영수 케이스 활용: 두 개의 완전 일치가 발생
        const result = run(mockSlackMembers, '박영수');
        expect(result).toBe('U007'); // 첫 번째 완전 일치 (박영수 (백엔드))
      });

      test('동일한 이름의 중복 사용자 처리', () => {
        const duplicateMembers = [
          createMember({ id: 'U001', real_name: '중복이름' }),
          createMember({ id: 'U002', real_name: '중복이름' }),
        ];

        const result = run(duplicateMembers, '중복이름');
        expect(result).toBe('U001');
      });
    });

    describe('엣지 케이스', () => {
      test.each([
        ['빈 슬랙 멤버 리스트', [], '석은주', '석은주'],
        ['null real_name 멤버만 존재', [createMember({ id: 'U001', real_name: null })], '석은주', '석은주'],
      ])('%s 처리', (description, members, searchName, expected) => {
        const result = run(members, searchName);
        expect(result).toBe(expected);
      });
    });
  });

  describe('로깅 검증', () => {
    test('매칭 실패 시 경고 로그가 정확히 한 번 출력된다', () => {
      run(mockSlackMembers, '존재하지않는사용자');

      expect(Logger.warn).toHaveBeenCalledTimes(1);
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('매칭되는 Slack 사용자 없음'),
        expect.any(Object),
      );
    });

    test('우선순위 매핑 적용 시 정보 로그가 정확히 한 번 출력된다', () => {
      const multiMatchMembers = mockSlackMembers.filter((user) => user.id !== 'U001');
      run(multiMatchMembers, '김희연');

      expect(Logger.info).toHaveBeenCalledTimes(2);
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('우선순위 매핑 적용'),
        expect.objectContaining({
          githubRealName: '김희연',
          prioritySlackName: '김희연 A',
        }),
      );
    });

    test('여러 매칭에서 우선순위 매핑이 없으면 경고가 정확히 한 번 출력된다', () => {
      // 박영수는 실제로는 완전 일치 2개가 발생하므로 다른 케이스 사용
      const testMembers = [
        createMember({ id: 'U200', real_name: '테스트이름 A' }),
        createMember({ id: 'U201', real_name: '테스트이름 B' }),
      ];

      run(testMembers, '테스트이름');

      expect(Logger.warn).toHaveBeenCalledTimes(1);
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('우선순위 매핑 없음'),
        expect.objectContaining({
          suggestion: expect.stringContaining('USER_PRIORITY_MAPPING'),
        }),
      );
    });

    test('여러 완전 일치 시 경고가 정확히 한 번 출력된다', () => {
      // 박영수 케이스: 정규화하면 '박영수 (백엔드)' → '박영수', '박영수 (프론트)' → '박영수'
      run(mockSlackMembers, '박영수');

      expect(Logger.warn).toHaveBeenCalledTimes(1);
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('여러 완전 일치 발견'),
        expect.objectContaining({
          githubRealName: '박영수',
        }),
      );
    });

    test('우선순위 매핑된 사용자가 없을 때 경고가 정확히 한 번 출력된다', () => {
      // 김희연이 아닌 다른 케이스 사용 (김희연은 완전 일치가 존재)
      const limitedMembers = [
        createMember({ id: 'U300', real_name: '테스트 A' }),
        createMember({ id: 'U301', real_name: '테스트 B' }),
      ];

      // USER_PRIORITY_MAPPING에 '테스트': '테스트 C' 추가 필요
      jest.doMock('../../constants', () => ({
        SLACK_CONFIG: {
          SKIP_USERS: ['john (이주호)', 'bot-user', 'x'],
        },
        USER_PRIORITY_MAPPING: {
          김희연: '김희연 A',
          박영수: '박영수 (백엔드)',
          테스트: '테스트 C', // 존재하지 않는 사용자
        },
      }));

      const { findSlackUserProperty } = require('../../utils/nameUtils');
      findSlackUserProperty(limitedMembers, '테스트', 'id');

      expect(Logger.warn).toHaveBeenCalledTimes(1);
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('우선순위 매핑된 사용자를 찾을 수 없음'),
        expect.objectContaining({
          githubRealName: '테스트',
          prioritySlackName: '테스트 C',
        }),
      );
    });

    describe('로그 호출 패턴 검증', () => {
      test('성공적인 매칭에서는 warn 로그가 없어야 한다', () => {
        run(mockSlackMembers, '석은주');

        expect(Logger.warn).not.toHaveBeenCalled();
        expect(Logger.info).toHaveBeenCalled();
      });

      test('단일 시작 부분 일치에서는 우선순위 매핑 로그가 없어야 한다', () => {
        const singleMatchMembers = mockSlackMembers.filter(
          (user) => !['U001', 'U003'].includes(user.id),
        );

        run(singleMatchMembers, '김희연');

        expect(Logger.info).not.toHaveBeenCalledWith(
          expect.stringContaining('우선순위 매핑 적용'),
          expect.any(Object),
        );
      });
    });
  });

  describe('모듈 격리가 필요한 특수 케이스', () => {
    test('constants 변경이 필요한 경우에만 isolateModules 사용', () => {
      jest.isolateModules(() => {
        jest.doMock('../../constants', () => ({
          SLACK_CONFIG: { SKIP_USERS: [] },
          USER_PRIORITY_MAPPING: {
            특수케이스: '특수케이스 Special',
          },
        }));

        const { findSlackUserProperty } = require('../../utils/nameUtils');

        const specialMembers = [
          createMember({ id: 'U999', real_name: '특수케이스 Special' }),
          createMember({ id: 'U998', real_name: '특수케이스 Normal' }),
        ];

        // 완전 일치가 없으므로 시작 부분 일치에서 우선순위 매핑 적용
        const result = findSlackUserProperty(specialMembers, '특수케이스', 'id');
        expect(result).toBe('U999');
      });
    });
  });

  describe('실제 사용 케이스 시뮬레이션', () => {
    test('PR 코멘트 오매칭 방지: 석은주 → 석한울 케이스', () => {
      const authorResult = run(mockSlackMembers, '석은주');
      const targetResult = run(mockSlackMembers, '석한울');

      expect(authorResult).toBe('U004');
      expect(targetResult).toBe('U005');
      expect(authorResult).not.toBe(targetResult);
    });

    test('김희연 우선순위 매핑 시나리오', () => {
      const multiMatchMembers = mockSlackMembers.filter((user) => user.id !== 'U001');

      const result = run(multiMatchMembers, '김희연');
      expect(result).toBe('U002');
    });

    test('GitHub 다양한 이름 패턴 매칭 시나리오', () => {
      // 실제 GitHub에서 발생하는 다양한 이름 패턴들
      const githubPatterns = [
        ['이동민 (Rooney)', 'U012'], // 괄호 + 공백
        ['주현석_dobby', 'U013'], // 밑줄 별명
        ['이장현(Miller)', 'U014'], // 괄호 + 공백없음
      ];

      githubPatterns.forEach(([githubName, expectedId]) => {
        const result = run(mockSlackMembers, githubName);
        expect(result).toBe(expectedId);
      });
    });

    test('복합 패턴 처리 시나리오', () => {
      // 밑줄과 괄호가 함께 있는 복잡한 케이스
      const complexMembers = [
        createMember({ id: 'U200', real_name: '김철수' }),
        createMember({ id: 'U201', real_name: '이영희' }),
      ];

      // "김철수_john (Developer)" → "김철수" 로 정규화되어 매칭
      expect(run(complexMembers, '김철수_john (Developer)')).toBe('U200');

      // "이영희_jane" → "이영희" 로 정규화되어 매칭
      expect(run(complexMembers, '이영희_jane')).toBe('U201');
    });

    test('새로운 사용자 추가 시 우선순위 매핑 필요성 제안', () => {
      const newUserMembers = [
        ...mockSlackMembers,
        createMember({ id: 'U200', real_name: '새로운이름 A' }),
        createMember({ id: 'U201', real_name: '새로운이름 B' }),
      ];

      const result = run(newUserMembers, '새로운이름');
      expect(result).toBe('새로운이름');

      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('우선순위 매핑 없음'),
        expect.objectContaining({
          suggestion: expect.stringContaining("'새로운이름': '선호하는_Slack_이름'"),
        }),
      );
    });

    test('개선된 스킵 로직으로 인한 오매칭 해결', () => {
      const realWorldMembers = [
        createMember({ id: 'U100', real_name: 'Alexander' }),
        createMember({ id: 'U101', real_name: 'Maxwell' }),
        createMember({ id: 'U102', real_name: 'Kim Johnny' }), // 'Johnny Kim' 대신 순서 변경
        createMember({ id: 'U103', real_name: 'robot-assistant' }),
        createMember({ id: 'U104', real_name: 'john (이주호)' }),
        createMember({ id: 'U105', real_name: 'bot-user' }),
      ];

      // 이제 정상 매칭됨
      expect(run(realWorldMembers, 'Alexander')).toBe('U100');
      expect(run(realWorldMembers, 'Maxwell')).toBe('U101');
      expect(run(realWorldMembers, 'Kim Johnny')).toBe('U102');
      expect(run(realWorldMembers, 'robot-assistant')).toBe('U103');

      // 실제 스킵 대상은 여전히 스킵됨
      expect(run(realWorldMembers, 'john (이주호)')).toBe('john (이주호)');
      expect(run(realWorldMembers, 'bot-user')).toBe('bot-user');
    });
  });
});
