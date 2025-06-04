/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

describe('imageUtils', () => {
  let ImageUtils;
  let Logger;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  beforeAll(() => {
    jest.isolateModules(() => {
      jest.doMock('@/utils/logger', () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }));

      ImageUtils = require('@/utils/imageUtils');
      Logger = require('@/utils/logger');
    });
  });

  describe('extractImageUrls', () => {
    test.each([
      [
        '<img width="628" alt="image" src="https://github.com/user-attachments/assets/5c6e8c99-b15f-4742-91a2-4d89de708f1e" />',
        ['https://github.com/user-attachments/assets/5c6e8c99-b15f-4742-91a2-4d89de708f1e'],
        'HTML 이미지 태그',
      ],
      [
        '![image](https://github.com/user-attachments/assets/be608751-3bb1-467c-9df8-65e771ef6ced)',
        ['https://github.com/user-attachments/assets/be608751-3bb1-467c-9df8-65e771ef6ced'],
        'Markdown 이미지 문법',
      ],
      [
        `![image](https://github.com/user-attachments/assets/image1.jpg)
         <img src="https://github.com/user-attachments/assets/image2.png" alt="html image" />`,
        [
          'https://github.com/user-attachments/assets/image1.jpg',
          'https://github.com/user-attachments/assets/image2.png',
        ],
        'HTML + Markdown 혼합',
      ],
      [
        '![external](https://example.com/image.jpg)',
        ['https://example.com/image.jpg'],
        '외부 이미지 URL도 추출',
      ],
      [
        '일반 텍스트 내용입니다.',
        [],
        '이미지 없는 텍스트',
      ],
      [
        '',
        [],
        '빈 문자열',
      ],
      [
        null,
        [],
        'null 입력',
      ],
    ])('extractImageUrls: %s → %j (%s)', (input, expected, _description) => {
      expect(ImageUtils.extractImageUrls(input)).toEqual(expected);
    });
  });

  describe('convertImagesToSlackLinks', () => {
    test.each([
      [
        '<img width="745" alt="image" src="https://github.com/user-attachments/assets/13273685-9e58-4a0a-b47c-311648fad564" />',
        '<https://github.com/user-attachments/assets/13273685-9e58-4a0a-b47c-311648fad564|[첨부이미지]>',
        'HTML 이미지를 Slack 링크로 변환',
      ],
      [
        '![image](https://github.com/user-attachments/assets/test.jpg)',
        '<https://github.com/user-attachments/assets/test.jpg|[첨부이미지]>',
        'Markdown 이미지를 Slack 링크로 변환',
      ],
      [
        '<img width="745" alt="image" src="https://github.com/user-attachments/assets/13273685-9e58-4a0a-b47c-311648fad564" />여기도 봐주세요~ 이미지 테스트',
        '<https://github.com/user-attachments/assets/13273685-9e58-4a0a-b47c-311648fad564|[첨부이미지]>여기도 봐주세요~ 이미지 테스트',
        '실제 사용 예시',
      ],
      [
        '<img src="https://example.com/image.jpg" alt="external" />',
        '<img src="https://example.com/image.jpg" alt="external" />',
        '외부 이미지는 변환하지 않음',
      ],
      [
        '이미지가 없는 일반 텍스트',
        '이미지가 없는 일반 텍스트',
        '이미지 없는 텍스트는 그대로',
      ],
      [
        '',
        '',
        '빈 문자열',
      ],
      [
        null,
        null,
        'null 입력',
      ],
    ])('convertImagesToSlackLinks: %s → %s (%s)', (input, expected, _description) => {
      expect(ImageUtils.convertImagesToSlackLinks(input)).toBe(expected);
    });

    test('다중 GitHub 이미지 변환 및 로그 확인', () => {
      const input = `텍스트 시작
<img src="https://github.com/user-attachments/assets/image1.jpg" alt="first" />
중간 텍스트
![second](https://github.com/user-attachments/assets/image2.jpg)
텍스트 끝`;

      const result = ImageUtils.convertImagesToSlackLinks(input);

      expect(result).toContain('<https://github.com/user-attachments/assets/image1.jpg|[첨부이미지]>');
      expect(result).toContain('<https://github.com/user-attachments/assets/image2.jpg|[첨부이미지]>');
      expect(result).toContain('텍스트 시작');
      expect(result).toContain('중간 텍스트');
      expect(result).toContain('텍스트 끝');

      expect(Logger.debug).toHaveBeenCalledWith(
        '이미지를 Slack 링크로 변환 완료: 2개',
        expect.objectContaining({
          originalLength: expect.any(Number),
          convertedLength: expect.any(Number),
        }),
      );
    });
  });

  describe('processCommentImages', () => {
    test('HTML 이미지가 포함된 코멘트 처리', () => {
      const commentText = '<img width="745" alt="image" src="https://github.com/user-attachments/assets/13273685-9e58-4a0a-b47c-311648fad564" />여기도 봐주세요~ 이미지 테스트';

      const result = ImageUtils.processCommentImages(commentText);

      expect(result.hasImages).toBe(true);
      expect(result.imageCount).toBe(1);
      expect(result.text).toBe('<https://github.com/user-attachments/assets/13273685-9e58-4a0a-b47c-311648fad564|[첨부이미지]>여기도 봐주세요~ 이미지 테스트');

      expect(Logger.debug).toHaveBeenCalledWith(
        '코멘트 이미지 처리 완료',
        expect.objectContaining({
          originalTextLength: expect.any(Number),
          totalImageCount: 1,
          validImageCount: 1,
        }),
      );
    });

    test('Markdown 이미지가 포함된 코멘트 처리', () => {
      const commentText = '![image](https://github.com/user-attachments/assets/test.jpg)\n이미지 설명';

      const result = ImageUtils.processCommentImages(commentText);

      expect(result.hasImages).toBe(true);
      expect(result.imageCount).toBe(1);
      expect(result.text).toBe('<https://github.com/user-attachments/assets/test.jpg|[첨부이미지]>\n이미지 설명');
    });

    test('다중 이미지 처리', () => {
      const commentText = `첫 번째 이미지
![img1](https://github.com/user-attachments/assets/image1.jpg)
두 번째 이미지
<img src="https://github.com/user-attachments/assets/image2.png" />`;

      const result = ImageUtils.processCommentImages(commentText);

      expect(result.hasImages).toBe(true);
      expect(result.imageCount).toBe(2);
      expect(result.text).toContain('[첨부이미지]');
      expect(result.text).toContain('첫 번째 이미지');
      expect(result.text).toContain('두 번째 이미지');
    });

    test('이미지가 없는 코멘트 처리', () => {
      const commentText = '이미지가 없는 일반 코멘트입니다.';

      const result = ImageUtils.processCommentImages(commentText);

      expect(result.hasImages).toBe(false);
      expect(result.imageCount).toBe(0);
      expect(result.text).toBe(commentText);
    });

    test('외부 이미지 포함 코멘트 처리 (GitHub 이미지만 카운트)', () => {
      const commentText = `GitHub 이미지
![github](https://github.com/user-attachments/assets/valid.jpg)
외부 이미지
![external](https://example.com/invalid.jpg)`;

      const result = ImageUtils.processCommentImages(commentText);

      expect(result.hasImages).toBe(true);
      expect(result.imageCount).toBe(1); // GitHub 이미지만 카운트
      expect(result.text).toContain('<https://github.com/user-attachments/assets/valid.jpg|[첨부이미지]>');
      expect(result.text).toContain('![external](https://example.com/invalid.jpg)'); // 외부 이미지는 그대로
    });

    test.each([
      ['', '빈 문자열'],
      [null, 'null 입력'],
      [undefined, 'undefined 입력'],
    ])('processCommentImages 경계값: %s (%s)', (input, _description) => {
      const result = ImageUtils.processCommentImages(input);

      expect(result.hasImages).toBe(false);
      expect(result.imageCount).toBe(0);
      expect(result.text).toBe(input);
    });

    test('에러 발생 시 처리', () => {
      // extractImageUrls를 모킹하여 에러 발생시킴
      const originalExtract = ImageUtils.extractImageUrls;
      ImageUtils.extractImageUrls = jest.fn().mockImplementation(() => {
        throw new Error('Mock error');
      });

      const result = ImageUtils.processCommentImages('test text');

      expect(result.hasImages).toBe(false);
      expect(result.imageCount).toBe(0);
      expect(result.text).toBe('test text');

      expect(Logger.error).toHaveBeenCalledWith(
        '코멘트 이미지 처리 실패',
        expect.any(Error),
      );

      // 원본 함수 복원
      ImageUtils.extractImageUrls = originalExtract;
    });
  });

  describe('hasImages', () => {
    test.each([
      [
        '![image](https://github.com/user-attachments/assets/test.jpg)',
        true,
        'Markdown GitHub 이미지 포함',
      ],
      [
        '<img src="https://github.com/user-attachments/assets/test.jpg" alt="image" />',
        true,
        'HTML GitHub 이미지 포함',
      ],
      [
        '![external](https://example.com/image.jpg)',
        false,
        '외부 이미지는 해당 없음',
      ],
      [
        '일반 텍스트',
        false,
        '이미지 없음',
      ],
      [
        '',
        false,
        '빈 문자열',
      ],
      [
        null,
        false,
        'null 입력',
      ],
    ])('hasImages: %s → %s (%s)', (input, expected, _description) => {
      expect(ImageUtils.hasImages(input)).toBe(expected);
    });
  });

  describe('GitHub URL 검증', () => {
    test('유효한 GitHub 이미지 URL만 처리됨', () => {
      const mixedText = `
        ![valid](https://github.com/user-attachments/assets/valid.jpg)
        ![invalid1](https://example.com/invalid.jpg)
        ![invalid2](https://github.com/other-path/invalid.jpg)
      `;

      const result = ImageUtils.convertImagesToSlackLinks(mixedText);

      expect(result).toContain('<https://github.com/user-attachments/assets/valid.jpg|[첨부이미지]>');
      expect(result).toContain('![invalid1](https://example.com/invalid.jpg)');
      expect(result).toContain('![invalid2](https://github.com/other-path/invalid.jpg)');
    });
  });

  describe('실제 사용 시나리오', () => {
    test('실제 GitHub 코멘트 패턴', () => {
      const realComment = `코멘트 내용:
<img width="628" alt="image" src="https://github.com/user-attachments/assets/5c6e8c99-b15f-4742-91a2-4d89de708f1e" />
여기도 봐주세요~`;

      const result = ImageUtils.processCommentImages(realComment);

      expect(result.hasImages).toBe(true);
      expect(result.imageCount).toBe(1);
      expect(result.text).toBe(`코멘트 내용:
<https://github.com/user-attachments/assets/5c6e8c99-b15f-4742-91a2-4d89de708f1e|[첨부이미지]>
여기도 봐주세요~`);
    });

    test('복합적인 코멘트 패턴', () => {
      const complexComment = `버그 발견했습니다.

스크린샷:
<img width="745" alt="버그화면" src="https://github.com/user-attachments/assets/bug-screenshot.png" />

그리고 로그도 첨부합니다:
![로그파일](https://github.com/user-attachments/assets/log-file.txt)

확인 부탁드립니다.`;

      const result = ImageUtils.processCommentImages(complexComment);

      expect(result.hasImages).toBe(true);
      expect(result.imageCount).toBe(2);
      expect(result.text).toContain('<https://github.com/user-attachments/assets/bug-screenshot.png|[첨부이미지]>');
      expect(result.text).toContain('<https://github.com/user-attachments/assets/log-file.txt|[첨부이미지]>');
      expect(result.text).toContain('버그 발견했습니다.');
      expect(result.text).toContain('확인 부탁드립니다.');
    });
  });

  describe('성능 테스트', () => {
    test('대량의 이미지 처리', () => {
      const manyImages = Array.from({ length: 10 }, (_, i) => (
        `![image${i}](https://github.com/user-attachments/assets/image${i}.jpg)`
      )).join('\n');

      const start = Date.now();
      const result = ImageUtils.processCommentImages(manyImages);
      const duration = Date.now() - start;

      expect(result.hasImages).toBe(true);
      expect(result.imageCount).toBe(10);
      expect(duration).toBeLessThan(100); // 100ms 이내
    });
  });
});
