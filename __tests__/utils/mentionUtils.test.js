// mentionUtils.test.js
/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

describe('mentionUtils', () => {
  let Logger;
  let mockSlackIdResolver;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();

    // slackIdResolver 함수 모킹
    mockSlackIdResolver = jest.fn();
  });

  describe('extractGitHubMentions', () => {
    let extractGitHubMentions;

    beforeEach(() => {
      jest.isolateModules(() => {
        jest.doMock('../../utils/logger', () => ({
          debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
        }));
        ({ extractGitHubMentions } = require('../../utils/mentionUtils'));
      });
    });

    test.each([
      // 기본 케이스
      ['@enzoseok', ['enzoseok'], '단일 멘션'],
      ['@enzoseok @alton15', ['enzoseok', 'alton15'], '다중 멘션'],
      ['안녕하세요 @enzoseok 님과 @alton15 님', ['enzoseok', 'alton15'], '텍스트 중간 멘션'],

      // 특수 문자 포함
      ['@user-name', ['user-name'], '하이픈 포함'],
      ['@user_name', ['user_name'], '언더스코어 포함'],
      ['@user123', ['user123'], '숫자 포함'],
      ['@User-Name_123', ['User-Name_123'], '복합 특수문자'],

      // bot 계정 포함 (대괄호에서 멈춰서 사용자명만 추출)
      ['@enzoseok @renovate[bot]', ['enzoseok', 'renovate'], 'bot 계정 포함'],
      ['@dependabot[bot] @alton15', ['dependabot', 'alton15'], 'dependabot 포함'],
      ['@user[bot] @normal-user', ['user', 'normal-user'], '일반 bot 계정 포함'],
      ['@bot-user @user[bot]', ['bot-user', 'user'], '[bot] 접미사도 포함'],

      // 중복 제거
      ['@enzoseok @alton15 @enzoseok', ['enzoseok', 'alton15'], '중복 멘션 제거'],
      ['@same @same @different @same', ['same', 'different'], '다중 중복 제거'],

      // 엣지 케이스
      ['텍스트 without mentions', [], '멘션 없음'],
      ['', [], '빈 문자열'],
      ['@ @invalid @', ['invalid'], '잘못된 멘션 형식'],
      ['email@domain.com @valid-user', ['domain', 'valid-user'], '이메일 포함'],
      ['@', [], '@ 기호만'],
      ['@@double', ['double'], '더블 @ 기호'],
      ['@멘션한글', [], '한글 사용자명은 지원 안함'],
      ['@user! @valid', ['user', 'valid'], '특수문자 뒤 멘션'],

      // null/undefined 케이스
      [null, [], 'null 입력'],
      [undefined, [], 'undefined 입력'],
    ])('입력: "%s" → 결과: %j (%s)', (input, expected, _description) => {
      expect(extractGitHubMentions(input)).toEqual(expected);
    });

    test('숫자가 아닌 타입 입력 처리', () => {
      expect(extractGitHubMentions(123)).toEqual([]);
      expect(extractGitHubMentions({})).toEqual([]);
      expect(extractGitHubMentions([])).toEqual([]);
    });

    test('추가 관대한 파싱 케이스', () => {
      expect(extractGitHubMentions('@user1.@user2')).toEqual(['user1', 'user2']);
      expect(extractGitHubMentions('@user1/@user2')).toEqual(['user1', 'user2']);
      expect(extractGitHubMentions('@user1;@user2')).toEqual(['user1', 'user2']);
      expect(extractGitHubMentions('@user1:@user2')).toEqual(['user1', 'user2']);
      expect(extractGitHubMentions('(@user1)@user2')).toEqual(['user1', 'user2']);
      expect(extractGitHubMentions('"@user1"@user2')).toEqual(['user1', 'user2']);

      expect(extractGitHubMentions('@start middle @end')).toEqual(['start', 'end']);
      expect(extractGitHubMentions('@only')).toEqual(['only']);
      expect(extractGitHubMentions('!!!@user!!!')).toEqual(['user']);
      expect(extractGitHubMentions('...@user...')).toEqual(['user']);
    });

    test('다양한 구분자와 상황에서의 멘션 파싱', () => {
      // 기본 단일 멘션
      expect(extractGitHubMentions('@enzo')).toEqual(['enzo']);

      // @ 기호로 연결된 멘션들
      expect(extractGitHubMentions('@enzo@ray')).toEqual(['enzo', 'ray']);
      expect(extractGitHubMentions('@user1@user2@user3')).toEqual(['user1', 'user2', 'user3']);

      // 공백으로 구분된 멘션들 (기존 케이스)
      expect(extractGitHubMentions('@enzo @ray')).toEqual(['enzo', 'ray']);

      // 쉼표로 구분된 멘션들
      expect(extractGitHubMentions('@enzo,@ray')).toEqual(['enzo', 'ray']);
      expect(extractGitHubMentions('@user1,@user2,@user3')).toEqual(['user1', 'user2', 'user3']);

      // 한글 텍스트와 점 뒤의 멘션들
      expect(extractGitHubMentions('안녕하세요.@enzo @ray')).toEqual(['enzo', 'ray']);
      expect(extractGitHubMentions('리뷰 부탁드립니다.@reviewer1 @reviewer2')).toEqual(['reviewer1', 'reviewer2']);

      // 복합 구분자 케이스
      expect(extractGitHubMentions('@user1,@user2.@user3 @user4')).toEqual(['user1', 'user2', 'user3', 'user4']);
      expect(extractGitHubMentions('작업완료!@enzo,감사합니다@ray')).toEqual(['enzo', 'ray']);

      // 특수 상황들
      expect(extractGitHubMentions('(@enzo)(@ray)')).toEqual(['enzo', 'ray']);
      expect(extractGitHubMentions('"@enzo","@ray"')).toEqual(['enzo', 'ray']);
      expect(extractGitHubMentions('[@enzo][@ray]')).toEqual(['enzo', 'ray']);

      // bot 계정과 섞인 케이스 (대괄호에서 멈춰서 사용자명만 추출)
      expect(extractGitHubMentions('@enzo@renovate[bot]@ray')).toEqual(['enzo', 'renovate', 'ray']);
      expect(extractGitHubMentions('@user,@dependabot[bot],@reviewer')).toEqual(['user', 'dependabot', 'reviewer']);
    });
  });

  describe('convertMentionsToSlack', () => {
    let convertMentionsToSlack;
    let LoggerSpy;

    beforeEach(() => {
      jest.isolateModules(() => {
        const loggerMock = {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };
        jest.doMock('../../utils/logger', () => loggerMock);

        const MentionUtils = require('../../utils/mentionUtils');
        ({ convertMentionsToSlack } = MentionUtils);
        Logger = require('../../utils/logger');
        LoggerSpy = Logger;
      });
    });

    test('정상적인 멘션 변환', () => {
      const text = 'Hello @enzoseok and @alton15!';
      const mapping = new Map([
        ['enzoseok', 'U123456'],
        ['alton15', 'U789012'],
      ]);

      const result = convertMentionsToSlack(text, mapping);
      expect(result).toBe('Hello <@U123456> and <@U789012>!');
      expect(LoggerSpy.debug).toHaveBeenCalledWith(
        'GitHub 멘션 변환 완료: 2개',
        expect.objectContaining({
          originalLength: text.length,
          convertedLength: expect.any(Number),
        }),
      );
    });

    test('bot 계정 멘션 변환', () => {
      const text = 'Review needed @renovate[bot] and @dependabot[bot]';
      const mapping = new Map([
        ['renovate', 'U111111'],
      ]);

      const result = convertMentionsToSlack(text, mapping);
      expect(result).toBe('Review needed <@U111111>[bot] and @dependabot[bot]');
    });

    test('부분 매핑만 있는 경우', () => {
      const text = 'Hello @enzoseok and @unknown and @alton15!';
      const mapping = new Map([
        ['enzoseok', 'U123456'],
        ['alton15', 'U789012'],
      ]);

      const result = convertMentionsToSlack(text, mapping);
      expect(result).toBe('Hello <@U123456> and @unknown and <@U789012>!');
    });

    test('단어 경계 처리', () => {
      const text = '@user and @username and @mention';
      const mapping = new Map([
        ['user', 'U111111'],
        ['username', 'U222222'],
      ]);

      const result = convertMentionsToSlack(text, mapping);
      expect(result).toBe('<@U111111> and <@U222222> and @mention');
    });

    test.each([
      ['', '빈 문자열'],
      [null, 'null'],
      [undefined, 'undefined'],
    ])('잘못된 텍스트 입력: %s (%s)', (input, _description) => {
      const mapping = new Map([['user', 'U123']]);
      expect(convertMentionsToSlack(input, mapping)).toBe(input);
    });

    test.each([
      [null, 'null 매핑'],
      [undefined, 'undefined 매핑'],
      [new Map(), '빈 매핑'],
    ])('잘못된 매핑 입력: %s', (mapping, _description) => {
      const text = 'Hello @user!';
      expect(convertMentionsToSlack(text, mapping)).toBe(text);
    });

    test('변환 없는 경우 로그 없음', () => {
      const text = 'No mentions here';
      const mapping = new Map([['user', 'U123']]);

      convertMentionsToSlack(text, mapping);
      expect(LoggerSpy.debug).not.toHaveBeenCalled();
    });

    test('이메일 패턴에서의 멘션 변환', () => {
      const text = 'Contact user@domain.com for help';
      const mapping = new Map([
        ['domain', 'U999999'],
      ]);

      const result = convertMentionsToSlack(text, mapping);
      expect(result).toBe('Contact user<@U999999>.com for help');
    });
  });

  describe('createGitHubToSlackMapping', () => {
    let createGitHubToSlackMapping;
    let LoggerSpy;

    beforeEach(() => {
      jest.isolateModules(() => {
        const loggerMock = {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };
        jest.doMock('../../utils/logger', () => loggerMock);

        const MentionUtils = require('../../utils/mentionUtils');
        ({ createGitHubToSlackMapping } = MentionUtils);
        Logger = require('../../utils/logger');
        LoggerSpy = Logger;
      });
    });

    test('정상적인 매핑 생성', async () => {
      const githubUsernames = ['enzoseok', 'alton15'];

      mockSlackIdResolver.mockResolvedValue(new Map([
        ['enzoseok', 'U123456'],
        ['alton15', 'U789012'],
      ]));

      const result = await createGitHubToSlackMapping(githubUsernames, mockSlackIdResolver);

      expect(result).toEqual(new Map([
        ['enzoseok', 'U123456'],
        ['alton15', 'U789012'],
      ]));

      expect(mockSlackIdResolver).toHaveBeenCalledWith(['enzoseok', 'alton15'], 'id');
      expect(LoggerSpy.debug).toHaveBeenCalledWith('GitHub 멘션 매핑 시작: enzoseok, alton15');
      expect(LoggerSpy.info).toHaveBeenCalledWith(
        'GitHub → Slack 멘션 매핑 생성 완료: 2/2개 성공',
      );
    });

    test('일부 사용자 변환 실패', async () => {
      const githubUsernames = ['enzoseok', 'unknown', 'alton15'];

      // unknown 사용자는 변환 실패로 원본 반환
      mockSlackIdResolver.mockResolvedValue(new Map([
        ['enzoseok', 'U123456'],
        ['unknown', 'unknown'], // 변환 실패 (원본과 동일)
        ['alton15', 'U789012'],
      ]));

      const result = await createGitHubToSlackMapping(githubUsernames, mockSlackIdResolver);

      expect(result).toEqual(new Map([
        ['enzoseok', 'U123456'],
        ['alton15', 'U789012'],
      ]));

      expect(LoggerSpy.info).toHaveBeenCalledWith(
        'GitHub → Slack 멘션 매핑 생성 완료: 2/3개 성공',
      );
    });

    test('빈 사용자명 배열', async () => {
      const githubUsernames = [];

      const result = await createGitHubToSlackMapping(githubUsernames, mockSlackIdResolver);

      expect(result).toEqual(new Map());
      expect(mockSlackIdResolver).not.toHaveBeenCalled();
    });

    test('null/undefined 사용자명 배열', async () => {
      const result1 = await createGitHubToSlackMapping(null, mockSlackIdResolver);
      const result2 = await createGitHubToSlackMapping(undefined, mockSlackIdResolver);

      expect(result1).toEqual(new Map());
      expect(result2).toEqual(new Map());
      expect(mockSlackIdResolver).not.toHaveBeenCalled();
    });

    test('slackIdResolver가 함수가 아닌 경우', async () => {
      const githubUsernames = ['enzoseok'];

      await expect(createGitHubToSlackMapping(githubUsernames, 'not-a-function'))
        .rejects.toThrow('slackIdResolver는 함수여야 합니다');

      await expect(createGitHubToSlackMapping(githubUsernames, null))
        .rejects.toThrow('slackIdResolver는 함수여야 합니다');
    });

    test('slackIdResolver 에러 처리', async () => {
      const githubUsernames = ['enzoseok'];
      const error = new Error('Slack API Error');

      mockSlackIdResolver.mockRejectedValue(error);

      await expect(createGitHubToSlackMapping(githubUsernames, mockSlackIdResolver))
        .rejects.toThrow('Slack API Error');

      expect(LoggerSpy.error).toHaveBeenCalledWith(
        'GitHub 멘션 매핑 생성 실패',
        error,
      );
    });

    test('모든 사용자 변환 실패', async () => {
      const githubUsernames = ['unknown1', 'unknown2'];

      mockSlackIdResolver.mockResolvedValue(new Map([
        ['unknown1', 'unknown1'],
        ['unknown2', 'unknown2'],
      ]));

      const result = await createGitHubToSlackMapping(githubUsernames, mockSlackIdResolver);

      expect(result).toEqual(new Map());
      expect(LoggerSpy.info).toHaveBeenCalledWith(
        'GitHub → Slack 멘션 매핑 생성 완료: 0/2개 성공',
      );
    });
  });

  describe('convertCommentMentions', () => {
    let convertCommentMentions;
    let LoggerSpy;

    beforeEach(() => {
      jest.isolateModules(() => {
        const loggerMock = {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };
        jest.doMock('../../utils/logger', () => loggerMock);

        const MentionUtils = require('../../utils/mentionUtils');
        ({ convertCommentMentions } = MentionUtils);
        Logger = require('../../utils/logger');
        LoggerSpy = Logger;
      });
    });

    test('전체 통합 변환 성공', async () => {
      const commentText = 'Good job! @enzoseok @alton15';

      mockSlackIdResolver.mockResolvedValue(new Map([
        ['enzoseok', 'U123456'],
        ['alton15', 'U789012'],
      ]));

      const result = await convertCommentMentions(commentText, mockSlackIdResolver);

      expect(result).toBe('Good job! <@U123456> <@U789012>');
      expect(mockSlackIdResolver).toHaveBeenCalledWith(
        ['enzoseok', 'alton15'],
        'id',
      );
    });

    test('멘션이 없는 경우', async () => {
      const commentText = 'No mentions here';

      const result = await convertCommentMentions(commentText, mockSlackIdResolver);

      expect(result).toBe(commentText);
      expect(mockSlackIdResolver).not.toHaveBeenCalled();
    });

    test('에러 발생 시 원본 텍스트 반환', async () => {
      const commentText = 'Hello @enzoseok';
      const error = new Error('Service error');

      mockSlackIdResolver.mockRejectedValue(error);

      const result = await convertCommentMentions(commentText, mockSlackIdResolver);

      expect(result).toBe(commentText);
      expect(LoggerSpy.error).toHaveBeenCalledWith(
        '코멘트 멘션 변환 실패',
        error,
      );
    });

    test('복합 케이스: 성공/실패/봇 혼재', async () => {
      const commentText = 'Review needed: @enzoseok @unknown @renovate[bot] @alton15';

      mockSlackIdResolver.mockResolvedValue(new Map([
        ['enzoseok', 'U123456'],
        ['unknown', 'unknown'], // 변환 실패
        ['renovate', 'U999999'], // bot 계정은 사용자명만 변환
        ['alton15', 'U789012'],
      ]));

      const result = await convertCommentMentions(commentText, mockSlackIdResolver);

      // renovate는 변환되고 [bot] 접미사는 그대로 유지, unknown은 변환 실패로 원본 유지
      expect(result).toBe('Review needed: <@U123456> @unknown <@U999999>[bot] <@U789012>');
      expect(mockSlackIdResolver).toHaveBeenCalledWith(
        ['enzoseok', 'unknown', 'renovate', 'alton15'],
        'id',
      );
    });

    test('slackIdResolver 함수 검증', async () => {
      const commentText = 'Hello @user';

      await expect(convertCommentMentions(commentText, 'not-a-function'))
        .resolves.toBe(commentText); // 에러 시 원본 반환

      expect(LoggerSpy.error).toHaveBeenCalledWith(
        '코멘트 멘션 변환 실패',
        expect.any(Error),
      );
    });
  });
});
