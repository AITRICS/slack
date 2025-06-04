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
        '단일 이미지 태그',
      ],
      [
        `<img width="745" alt="image" src="https://github.com/user-attachments/assets/13273685-9e58-4a0a-b47c-311648fad564" />
         <img src="https://github.com/user-attachments/assets/another-image-url" alt="second image" />`,
        [
          'https://github.com/user-attachments/assets/13273685-9e58-4a0a-b47c-311648fad564',
          'https://github.com/user-attachments/assets/another-image-url',
        ],
        '다중 이미지 태그',
      ],
      [
        '일반 텍스트 내용입니다.',
        [],
        '이미지 없는 텍스트',
      ],
      [
        '<img src=\'https://github.com/user-attachments/assets/single-quote.jpg\' alt="single quote" />',
        ['https://github.com/user-attachments/assets/single-quote.jpg'],
        '단일 따옴표 src',
      ],
      [
        `<img width="628" alt="image" src="https://github.com/user-attachments/assets/test1.jpg" />
         <img width="628" alt="image" src="https://github.com/user-attachments/assets/test1.jpg" />`,
        ['https://github.com/user-attachments/assets/test1.jpg'],
        '중복 이미지 URL 제거',
      ],
      [
        '<img src="https://example.com/image.jpg" alt="external image" />',
        ['https://example.com/image.jpg'],
        '외부 이미지 URL도 추출',
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
      [
        undefined,
        [],
        'undefined 입력',
      ],
    ])('extractImageUrls: %s → %j (%s)', (input, expected, _description) => {
      expect(ImageUtils.extractImageUrls(input)).toEqual(expected);
    });

    test('복잡한 HTML 구조에서 이미지 추출', () => {
      const complexHtml = `
        <div>
          <p>코멘트 내용입니다.</p>
          <img width="628" alt="image" src="https://github.com/user-attachments/assets/image1.jpg" />
          <p>중간 텍스트</p>
          <img src="https://github.com/user-attachments/assets/image2.png" alt="second" />
        </div>
      `;

      const result = ImageUtils.extractImageUrls(complexHtml);
      expect(result).toEqual([
        'https://github.com/user-attachments/assets/image1.jpg',
        'https://github.com/user-attachments/assets/image2.png',
      ]);
    });
  });

  describe('convertImagesToSlackFormat', () => {
    test.each([
      [
        '<img width="628" alt="image" src="https://github.com/user-attachments/assets/test.jpg" />',
        '\n📷 *첨부 이미지:* https://github.com/user-attachments/assets/test.jpg',
        'GitHub 이미지 변환',
      ],
      [
        '코멘트 내용\n<img src="https://github.com/user-attachments/assets/test.jpg" alt="image" />\n추가 내용',
        '코멘트 내용\n\n📷 *첨부 이미지:* https://github.com/user-attachments/assets/test.jpg\n추가 내용',
        '텍스트와 이미지 혼합',
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
    ])('convertImagesToSlackFormat: %s → %s (%s)', (input, expected, _description) => {
      expect(ImageUtils.convertImagesToSlackFormat(input)).toBe(expected);
    });

    test('다중 GitHub 이미지 변환 및 로그 확인', () => {
      const input = `
        <img src="https://github.com/user-attachments/assets/image1.jpg" alt="first" />
        <img src="https://github.com/user-attachments/assets/image2.jpg" alt="second" />
      `;

      const result = ImageUtils.convertImagesToSlackFormat(input);

      expect(result).toContain('📷 *첨부 이미지:* https://github.com/user-attachments/assets/image1.jpg');
      expect(result).toContain('📷 *첨부 이미지:* https://github.com/user-attachments/assets/image2.jpg');

      expect(Logger.debug).toHaveBeenCalledWith(
        '이미지 태그 변환 완료: 2개',
        expect.objectContaining({
          originalLength: expect.any(Number),
          convertedLength: expect.any(Number),
        }),
      );
    });
  });

  describe('createSlackImageAttachments', () => {
    test('GitHub 이미지 URL들을 Slack attachment로 변환', () => {
      const imageUrls = [
        'https://github.com/user-attachments/assets/image1.jpg',
        'https://github.com/user-attachments/assets/image2.png',
      ];

      const result = ImageUtils.createSlackImageAttachments(imageUrls);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        color: '#36a64f',
        image_url: 'https://github.com/user-attachments/assets/image1.jpg',
        fallback: '첨부 이미지 1',
        title: '첨부 이미지 1',
        title_link: 'https://github.com/user-attachments/assets/image1.jpg',
      });
      expect(result[1]).toEqual({
        color: '#36a64f',
        image_url: 'https://github.com/user-attachments/assets/image2.png',
        fallback: '첨부 이미지 2',
        title: '첨부 이미지 2',
        title_link: 'https://github.com/user-attachments/assets/image2.png',
      });
    });

    test('단일 이미지 URL 처리', () => {
      const imageUrls = ['https://github.com/user-attachments/assets/single.jpg'];

      const result = ImageUtils.createSlackImageAttachments(imageUrls);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('첨부 이미지');
      expect(result[0].fallback).toBe('첨부 이미지 1');
    });

    test.each([
      [[], [], '빈 배열'],
      [null, [], 'null 입력'],
      [undefined, [], 'undefined 입력'],
      [['https://example.com/image.jpg'], [], '유효하지 않은 URL'],
      [
        [
          'https://github.com/user-attachments/assets/valid.jpg',
          'https://example.com/invalid.jpg',
          'https://github.com/user-attachments/assets/another-valid.png',
        ],
        [
          expect.objectContaining({
            image_url: 'https://github.com/user-attachments/assets/valid.jpg',
          }),
          expect.objectContaining({
            image_url: 'https://github.com/user-attachments/assets/another-valid.png',
          }),
        ],
        '유효한 URL만 필터링',
      ],
    ])('createSlackImageAttachments 경계값: %j → %j (%s)', (input, expected, _description) => {
      const result = ImageUtils.createSlackImageAttachments(input);
      expect(result).toEqual(expected);
    });
  });

  describe('processCommentImages', () => {
    test('이미지가 포함된 코멘트 처리', () => {
      const commentText = `
        코멘트 내용입니다.
        <img width="628" alt="image" src="https://github.com/user-attachments/assets/test.jpg" />
        추가 내용
      `;

      const result = ImageUtils.processCommentImages(commentText);

      expect(result.hasImages).toBe(true);
      expect(result.imageAttachments).toHaveLength(1);
      expect(result.text).toContain('📷 *첨부 이미지:*');
      expect(result.imageAttachments[0]).toMatchObject({
        image_url: 'https://github.com/user-attachments/assets/test.jpg',
      });

      expect(Logger.debug).toHaveBeenCalledWith(
        '코멘트 이미지 처리 완료',
        expect.objectContaining({
          originalTextLength: expect.any(Number),
          imageCount: 1,
          validImageCount: 1,
        }),
      );
    });

    test('이미지가 없는 코멘트 처리', () => {
      const commentText = '이미지가 없는 일반 코멘트입니다.';

      const result = ImageUtils.processCommentImages(commentText);

      expect(result.hasImages).toBe(false);
      expect(result.imageAttachments).toHaveLength(0);
      expect(result.text).toBe(commentText);
    });

    test.each([
      ['', '빈 문자열'],
      [null, 'null 입력'],
      [undefined, 'undefined 입력'],
    ])('processCommentImages 경계값: %s (%s)', (input, _description) => {
      const result = ImageUtils.processCommentImages(input);

      expect(result.hasImages).toBe(false);
      expect(result.imageAttachments).toHaveLength(0);
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
      expect(result.imageAttachments).toHaveLength(0);
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
        '<img src="https://github.com/user-attachments/assets/test.jpg" alt="image" />',
        true,
        'GitHub 이미지 포함',
      ],
      [
        '<img src="https://example.com/image.jpg" alt="external" />',
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

  describe('GitHub URL 검증 (간접 테스트)', () => {
    test('유효한 GitHub 이미지 URL만 처리됨', () => {
      const mixedUrls = [
        'https://github.com/user-attachments/assets/valid.jpg',
        'https://example.com/invalid.jpg',
        'https://github.com/other-path/invalid.jpg',
        'invalid-url',
      ];

      const attachments = ImageUtils.createSlackImageAttachments(mixedUrls);
      expect(attachments).toHaveLength(1);
      expect(attachments[0].image_url).toBe('https://github.com/user-attachments/assets/valid.jpg');
    });
  });

  describe('성능 테스트', () => {
    test('대량의 이미지 태그 처리', () => {
      const manyImages = Array.from({ length: 10 }, (_, i) => (
        `<img src="https://github.com/user-attachments/assets/image${i}.jpg" alt="image${i}" />`
      )).join('\n');

      const start = Date.now();
      const result = ImageUtils.processCommentImages(manyImages);
      const duration = Date.now() - start;

      expect(result.hasImages).toBe(true);
      expect(result.imageAttachments).toHaveLength(10);
      expect(duration).toBeLessThan(100); // 100ms 이내
    });
  });
});
