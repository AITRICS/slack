/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

describe('ImageUtils.convertImagesToSlackLinks', () => {
  let ImageUtils;
  let Logger;

  beforeAll(() => {
    Logger = {
      debug: jest.fn(),
      error: jest.fn(),
    };

    jest.doMock('@/utils/logger', () => Logger);
    ImageUtils = require('@/utils/imageUtils');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('HTML 이미지 태그 변환', () => {
    test.each([
      [
        '<img src="https://github.com/user-attachments/assets/image1.png" alt="test image"/>',
        '<https://github.com/user-attachments/assets/image1.png|[test image]>',
        'HTML 이미지 태그 - alt 속성 있음',
      ],
      [
        '<img src="https://raw.githubusercontent.com/owner/repo/main/image.jpg"/>',
        '<https://raw.githubusercontent.com/owner/repo/main/image.jpg|[첨부이미지]>',
        'HTML 이미지 태그 - alt 속성 없음',
      ],
      [
        '<img src="https://github.com/owner/repo/assets/image.gif" alt=""/>',
        '<https://github.com/owner/repo/assets/image.gif|[첨부이미지]>',
        'HTML 이미지 태그 - 빈 alt 속성',
      ],
      [
        '<img src="https://user-images.githubusercontent.com/123/image.png" alt="   "/>',
        '<https://user-images.githubusercontent.com/123/image.png|[첨부이미지]>',
        'HTML 이미지 태그 - 공백 alt 속성',
      ],
      [
        '<img src="https://avatars.githubusercontent.com/u/123456?v=4" alt="avatar"/>',
        '<https://avatars.githubusercontent.com/u/123456?v=4|[avatar]>',
        'HTML 이미지 태그 - 쿼리 파라미터 포함',
      ],
    ])('변환 테스트: %s → %s (%s)', (input, expected, _description) => {
      const result = ImageUtils.convertImagesToSlackLinks(input);
      expect(result).toBe(expected);
      expect(Logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('이미지를 Slack 링크로 변환 완료'),
        expect.any(Object),
      );
    });

    test('복잡한 HTML 속성을 가진 이미지 태그', () => {
      const input = '<img class="image" src="https://github.com/assets/test.png" alt="Test Image" width="100"/>';
      const expected = '<https://github.com/assets/test.png|[Test Image]>';

      const result = ImageUtils.convertImagesToSlackLinks(input);
      expect(result).toBe(expected);
    });

    test('여러 HTML 이미지 태그', () => {
      const input = `
        <img src="https://github.com/user-attachments/assets/image1.png" alt="First"/>
        <p>Some text</p>
        <img src="https://raw.githubusercontent.com/repo/image2.jpg" alt="Second"/>
      `;

      const result = ImageUtils.convertImagesToSlackLinks(input);

      expect(result).toContain('<https://github.com/user-attachments/assets/image1.png|[First]>');
      expect(result).toContain('<https://raw.githubusercontent.com/repo/image2.jpg|[Second]>');
      expect(result).toContain('<p>Some text</p>');
    });
  });

  describe('Markdown 이미지 문법 변환', () => {
    test.each([
      [
        '![test image](https://github.com/user-attachments/assets/image1.png)',
        '<https://github.com/user-attachments/assets/image1.png|[test image]>',
        'Markdown 이미지 - alt 텍스트 있음',
      ],
      [
        '![](https://raw.githubusercontent.com/owner/repo/main/image.jpg)',
        '<https://raw.githubusercontent.com/owner/repo/main/image.jpg|[첨부이미지]>',
        'Markdown 이미지 - alt 텍스트 없음',
      ],
      [
        '![  ](https://github.com/owner/repo/assets/image.gif)',
        '<https://github.com/owner/repo/assets/image.gif|[첨부이미지]>',
        'Markdown 이미지 - 공백 alt 텍스트',
      ],
      [
        '![Screenshot 2024](https://user-images.githubusercontent.com/123/screenshot.png)',
        '<https://user-images.githubusercontent.com/123/screenshot.png|[Screenshot 2024]>',
        'Markdown 이미지 - 의미있는 alt 텍스트',
      ],
    ])('변환 테스트: %s → %s (%s)', (input, expected, _description) => {
      const result = ImageUtils.convertImagesToSlackLinks(input);
      expect(result).toBe(expected);
      expect(Logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('이미지를 Slack 링크로 변환 완료'),
        expect.any(Object),
      );
    });

    test('텍스트 중간에 포함된 Markdown 이미지', () => {
      const input = 'Here is an image: ![test](https://github.com/assets/image.png) and more text.';
      const expected = 'Here is an image: <https://github.com/assets/image.png|[test]> and more text.';

      const result = ImageUtils.convertImagesToSlackLinks(input);
      expect(result).toBe(expected);
    });
  });

  describe('복합 케이스 및 중복 처리', () => {
    test('HTML과 Markdown 혼합 - 중복 제거', () => {
      const input = `
        <img src="https://github.com/user-attachments/assets/image1.png" alt="HTML image"/>
        ![Markdown image](https://github.com/user-attachments/assets/image1.png)
        ![Different image](https://raw.githubusercontent.com/owner/repo/main/image2.jpg)
      `;

      const result = ImageUtils.convertImagesToSlackLinks(input);

      // 같은 URL은 한 번만 변환 (첫 번째 발견된 것)
      expect(result).toContain('<https://github.com/user-attachments/assets/image1.png|[HTML image]>');
      expect(result).toContain('<https://raw.githubusercontent.com/owner/repo/main/image2.jpg|[Different image]>');

      // 중복된 URL이 두 번 변환되지 않았는지 확인
      const convertedMatches = result.match(/<https:\/\/github\.com\/user-attachments\/assets\/image1\.png\|/g);
      expect(convertedMatches).toHaveLength(1);
    });

    test('여러 개의 다른 이미지 변환', () => {
      const input = `
        <img src="https://github.com/user-attachments/assets/image1.png" alt="First"/>
        ![Second](https://raw.githubusercontent.com/owner/repo/main/image2.jpg)
        <img src="https://avatars.githubusercontent.com/u/123456?v=4"/>
      `;

      const result = ImageUtils.convertImagesToSlackLinks(input);

      expect(result).toContain('<https://github.com/user-attachments/assets/image1.png|[First]>');
      expect(result).toContain('<https://raw.githubusercontent.com/owner/repo/main/image2.jpg|[Second]>');
      expect(result).toContain('<https://avatars.githubusercontent.com/u/123456?v=4|[첨부이미지]>');
    });

    test('긴 매치를 우선 처리하여 중첩 문제 방지', () => {
      const input = `
        <img src="https://github.com/assets/very-long-image-name-with-details.png" alt="Long name"/>
        <img src="https://github.com/assets/short.png" alt="Short"/>
      `;

      const result = ImageUtils.convertImagesToSlackLinks(input);

      expect(result).toContain('<https://github.com/assets/very-long-image-name-with-details.png|[Long name]>');
      expect(result).toContain('<https://github.com/assets/short.png|[Short]>');
    });
  });

  describe('GitHub 이미지가 아닌 경우', () => {
    test.each([
      [
        '<img src="https://example.com/image.png" alt="external"/>',
        '<img src="https://example.com/image.png" alt="external"/>',
        '외부 이미지는 변환하지 않음',
      ],
      [
        '![test](https://imgur.com/image.jpg)',
        '![test](https://imgur.com/image.jpg)',
        'Imgur 이미지는 변환하지 않음',
      ],
      [
        '<img src="data:image/png;base64,iVBORw0KGgo..."/>',
        '<img src="data:image/png;base64,iVBORw0KGgo..."/>',
        'Data URL은 변환하지 않음',
      ],
      [
        '![local](./local-image.png)',
        '![local](./local-image.png)',
        '상대 경로는 변환하지 않음',
      ],
    ])('비변환 테스트: %s → %s (%s)', (input, expected, _description) => {
      const result = ImageUtils.convertImagesToSlackLinks(input);
      expect(result).toBe(expected);
      expect(Logger.debug).not.toHaveBeenCalled();
    });

    test('GitHub 이미지와 외부 이미지 혼합', () => {
      const input = `
        <img src="https://github.com/assets/github-image.png" alt="GitHub"/>
        <img src="https://example.com/external-image.png" alt="External"/>
        ![GitHub Markdown](https://raw.githubusercontent.com/repo/image.jpg)
      `;

      const result = ImageUtils.convertImagesToSlackLinks(input);

      // GitHub 이미지만 변환
      expect(result).toContain('<https://github.com/assets/github-image.png|[GitHub]>');
      expect(result).toContain('<https://raw.githubusercontent.com/repo/image.jpg|[GitHub Markdown]>');

      // 외부 이미지는 변환되지 않음
      expect(result).toContain('<img src="https://example.com/external-image.png" alt="External"/>');
    });
  });

  describe('유효하지 않은 입력 처리', () => {
    test.each([
      [null, null, 'null 입력'],
      [undefined, undefined, 'undefined 입력'],
      ['', '', '빈 문자열'],
      [123, 123, '숫자 입력'],
      [true, true, '불린 입력'],
    ])('유효하지 않은 입력: %s → %s (%s)', (input, expected, _description) => {
      const result = ImageUtils.convertImagesToSlackLinks(input);
      expect(result).toBe(expected);
      expect(Logger.debug).not.toHaveBeenCalled();
    });

    // 객체와 배열 테스트는 별도로 처리
    test('유효하지 않은 입력: {} → {} (객체 입력)', () => {
      const input = {};
      const expected = {};
      const result = ImageUtils.convertImagesToSlackLinks(input);
      expect(result).toStrictEqual(expected);
      expect(Logger.debug).not.toHaveBeenCalled();
    });

    test('유효하지 않은 입력: [] → [] (배열 입력)', () => {
      const input = [];
      const expected = [];
      const result = ImageUtils.convertImagesToSlackLinks(input);
      expect(result).toStrictEqual(expected);
      expect(Logger.debug).not.toHaveBeenCalled();
    });
  });

  describe('특수 케이스', () => {
    test('빈 src 속성', () => {
      const input = '<img src="" alt="empty"/>';
      const result = ImageUtils.convertImagesToSlackLinks(input);
      expect(result).toBe(input);
    });

    test('공백만 있는 src 속성', () => {
      const input = '<img src="   " alt="whitespace"/>';
      const result = ImageUtils.convertImagesToSlackLinks(input);
      expect(result).toBe(input);
    });

    test('특수 문자가 포함된 URL', () => {
      const specialUrl = 'https://github.com/user-attachments/assets/image-name_123.png?v=1&token=abc';
      const input = `<img src="${specialUrl}" alt="special"/>`;
      const expected = `<${specialUrl}|[special]>`;

      const result = ImageUtils.convertImagesToSlackLinks(input);
      expect(result).toBe(expected);
    });

    test('alt 속성에 특수 문자 포함', () => {
      const input = '<img src="https://github.com/assets/image.png" alt="Test & Demo (v1.0)"/>';
      const expected = '<https://github.com/assets/image.png|[Test & Demo (v1.0)]>';

      const result = ImageUtils.convertImagesToSlackLinks(input);
      expect(result).toBe(expected);
    });
  });

  describe('성능 테스트', () => {
    test('큰 텍스트 처리', () => {
      const largeText = `${'Text content. '.repeat(1000)
      }<img src="https://github.com/assets/image.png"/>${
        'More content. '.repeat(1000)}`;

      const start = Date.now();
      const result = ImageUtils.convertImagesToSlackLinks(largeText);
      const duration = Date.now() - start;

      expect(result).toContain('<https://github.com/assets/image.png|[첨부이미지]>');
      expect(duration).toBeLessThan(100); // 100ms 이내
    });

    test('다수의 이미지 처리', () => {
      const multipleImages = Array.from({ length: 50 }, (_, i) => (
        `<img src="https://github.com/assets/image${i}.png" alt="image ${i}"/>`
      )).join('\n');

      const start = Date.now();
      const result = ImageUtils.convertImagesToSlackLinks(multipleImages);
      const duration = Date.now() - start;

      // 모든 이미지가 변환되었는지 확인
      const convertedCount = (result.match(/<https:\/\/github\.com\/assets\/image\d+\.png\|/g) || []).length;
      expect(convertedCount).toBe(50);
      expect(duration).toBeLessThan(200); // 200ms 이내
    });
  });
});
