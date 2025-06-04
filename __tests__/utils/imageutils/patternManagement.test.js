/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

describe('ImageUtils 패턴 관리 메서드들', () => {
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

  describe('getSupportedGitHubPatterns', () => {
    test('기본 패턴 목록 반환', () => {
      const patterns = ImageUtils.getSupportedGitHubPatterns();

      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.every((pattern) => pattern instanceof RegExp)).toBe(true);
    });

    test('기본 GitHub 패턴들이 포함되어있는지 확인', () => {
      const patterns = ImageUtils.getSupportedGitHubPatterns();
      const patternStrings = patterns.map((p) => p.toString());

      // 기본적으로 지원해야 하는 패턴들
      expect(patternStrings.some((p) => p.includes('github.com/user-attachments/assets'))).toBe(true);
      expect(patternStrings.some((p) => p.includes('raw.githubusercontent.com'))).toBe(true);
      expect(patternStrings.some((p) => p.includes('github.com/.*?/assets'))).toBe(true);
      expect(patternStrings.some((p) => p.includes('user-images.githubusercontent.com'))).toBe(true);
      expect(patternStrings.some((p) => p.includes('avatars.githubusercontent.com'))).toBe(true);
    });

    test('반환된 패턴이 독립적인 배열인지 확인', () => {
      const patterns1 = ImageUtils.getSupportedGitHubPatterns();
      const patterns2 = ImageUtils.getSupportedGitHubPatterns();

      expect(patterns1).not.toBe(patterns2); // 서로 다른 배열 인스턴스
      expect(patterns1).toEqual(patterns2); // 하지만 내용은 동일
    });

    test('반환된 패턴들의 유효성 검증', () => {
      const patterns = ImageUtils.getSupportedGitHubPatterns();

      patterns.forEach((pattern, index) => {
        expect(pattern).toBeInstanceOf(RegExp);
        expect(pattern.source).toBeTruthy(); // 빈 패턴이 아님
        expect(() => pattern.test('test')).not.toThrow(); // 유효한 정규식
      });
    });

    test('패턴들이 예상된 URL과 매칭되는지 확인', () => {
      const patterns = ImageUtils.getSupportedGitHubPatterns();

      const testUrls = [
        'https://github.com/user-attachments/assets/image.png',
        'https://raw.githubusercontent.com/owner/repo/main/image.jpg',
        'https://github.com/owner/repo/assets/image.gif',
        'https://user-images.githubusercontent.com/123456/image.png',
        'https://avatars.githubusercontent.com/u/123456?v=4',
      ];

      testUrls.forEach((url) => {
        const matched = patterns.some((pattern) => pattern.test(url));
        expect(matched).toBe(true);
      });
    });
  });

  describe('addGitHubPattern', () => {
    describe('성공적인 패턴 추가', () => {
      test('새로운 패턴 추가 성공', () => {
        const newPattern = /^https:\/\/custom\.github\.com\//;
        const result = ImageUtils.addGitHubPattern(newPattern);

        expect(result).toBe(true);
        expect(Logger.debug).toHaveBeenCalledWith(
          '새로운 GitHub 이미지 패턴 추가됨',
          expect.objectContaining({
            pattern: newPattern.toString(),
          }),
        );

        // 패턴이 실제로 추가되었는지 확인
        const patterns = ImageUtils.getSupportedGitHubPatterns();
        expect(patterns).toContain(newPattern);
      });

      test('복잡한 패턴 추가', () => {
        const complexPattern = /^https:\/\/cdn\.github\.io\/[a-zA-Z0-9_-]+\/images\//;
        const result = ImageUtils.addGitHubPattern(complexPattern);

        expect(result).toBe(true);
        expect(Logger.debug).toHaveBeenCalledWith(
          '새로운 GitHub 이미지 패턴 추가됨',
          expect.objectContaining({
            pattern: complexPattern.toString(),
          }),
        );
      });

      test('패턴 추가 후 기능 동작 확인', () => {
        const customPattern = /^https:\/\/test\.github\.example\.com\//;
        const customUrl = 'https://test.github.example.com/image.png';

        // 추가 전에는 매칭되지 않음
        expect(ImageUtils.extractGitHubImageUrls(`<img src="${customUrl}"/>`)).toEqual([]);

        // 패턴 추가
        const result = ImageUtils.addGitHubPattern(customPattern);
        expect(result).toBe(true);

        // 추가 후에는 매칭됨
        expect(ImageUtils.extractGitHubImageUrls(`<img src="${customUrl}"/>`)).toContain(customUrl);
      });

      test('여러 패턴 연속 추가', () => {
        const pattern1 = /^https:\/\/pattern1\.github\.com\//;
        const pattern2 = /^https:\/\/pattern2\.github\.com\//;
        const pattern3 = /^https:\/\/pattern3\.github\.com\//;

        expect(ImageUtils.addGitHubPattern(pattern1)).toBe(true);
        expect(ImageUtils.addGitHubPattern(pattern2)).toBe(true);
        expect(ImageUtils.addGitHubPattern(pattern3)).toBe(true);

        const patterns = ImageUtils.getSupportedGitHubPatterns();
        expect(patterns).toContain(pattern1);
        expect(patterns).toContain(pattern2);
        expect(patterns).toContain(pattern3);

        expect(Logger.debug).toHaveBeenCalledTimes(3);
      });
    });

    describe('실패하는 패턴 추가', () => {
      test.each([
        ['string', '문자열'],
        [123, '숫자'],
        [null, 'null'],
        [undefined, 'undefined'],
        [{}, '객체'],
        [[], '배열'],
        [true, '불린'],
        [() => {}, '함수'],
      ])('유효하지 않은 패턴 추가 실패: %s (%s)', (invalidPattern, _description) => {
        const result = ImageUtils.addGitHubPattern(invalidPattern);

        expect(result).toBe(false);
        expect(Logger.debug).not.toHaveBeenCalled();
        expect(Logger.error).not.toHaveBeenCalled();
      });

      test('잘못된 정규식 패턴', () => {
        // 유효하지만 의미 없는 정규식
        const meaninglessPattern = /(?:)/; // 빈 그룹
        const result = ImageUtils.addGitHubPattern(meaninglessPattern);

        expect(result).toBe(true); // 기술적으로는 유효한 RegExp
        expect(Logger.debug).toHaveBeenCalled();
      });
    });

    describe('에러 처리', () => {
      test('패턴 추가 중 예외 발생', () => {
        // Array.prototype.push를 일시적으로 mock하여 에러 상황 생성
        const originalPush = Array.prototype.push;
        const mockPush = jest.fn(() => {
          throw new Error('Push operation failed');
        });

        // ImageUtils 내부에서 사용하는 배열의 push 메서드를 mock
        Array.prototype.push = mockPush;

        const testPattern = /^https:\/\/test\.com\//;
        const result = ImageUtils.addGitHubPattern(testPattern);

        expect(result).toBe(false);
        expect(Logger.error).toHaveBeenCalledWith(
          'GitHub 이미지 패턴 추가 실패',
          expect.any(Error),
        );

        // 원본 메서드 복원
        Array.prototype.push = originalPush;
      });

      test('toString 메서드 호출 실패', () => {
        // toString 메서드가 실패하는 패턴 객체 생성
        const problematicPattern = /test/;
        Object.defineProperty(problematicPattern, 'toString', {
          value: () => { throw new Error('toString failed'); },
        });

        const result = ImageUtils.addGitHubPattern(problematicPattern);

        expect(result).toBe(false);
        expect(Logger.error).toHaveBeenCalledWith(
          'GitHub 이미지 패턴 추가 실패',
          expect.any(Error),
        );
      });
    });

    describe('패턴 추가의 부작용 테스트', () => {
      test('기존 패턴에 영향 없음', () => {
        const originalPatterns = ImageUtils.getSupportedGitHubPatterns();
        const originalCount = originalPatterns.length;

        const newPattern = /^https:\/\/new-pattern\.github\.com\//;
        ImageUtils.addGitHubPattern(newPattern);

        const updatedPatterns = ImageUtils.getSupportedGitHubPatterns();

        // 기존 패턴들이 모두 여전히 존재
        originalPatterns.forEach((pattern) => {
          expect(updatedPatterns).toContain(pattern);
        });

        // 패턴 수가 1개 증가
        expect(updatedPatterns.length).toBe(originalCount + 1);
      });

      test('중복 패턴 추가', () => {
        const duplicatePattern = /^https:\/\/duplicate\.test\.com\//;

        // 첫 번째 추가
        const result1 = ImageUtils.addGitHubPattern(duplicatePattern);
        expect(result1).toBe(true);

        const patternsAfterFirst = ImageUtils.getSupportedGitHubPatterns();
        const countAfterFirst = patternsAfterFirst.length;

        // 두 번째 추가 (중복)
        const result2 = ImageUtils.addGitHubPattern(duplicatePattern);
        expect(result2).toBe(true); // 기술적으로는 성공

        const patternsAfterSecond = ImageUtils.getSupportedGitHubPatterns();

        // 중복 패턴이 추가됨 (ImageUtils는 중복 체크를 하지 않음)
        expect(patternsAfterSecond.length).toBe(countAfterFirst + 1);

        // 두 개의 동일한 패턴이 존재
        const duplicateCount = patternsAfterSecond.filter((p) => p.toString() === duplicatePattern.toString()).length;
        expect(duplicateCount).toBe(2);
      });
    });

    describe('실제 사용 시나리오', () => {
      test('GitHub Enterprise 도메인 추가', () => {
        const enterprisePattern = /^https:\/\/github\.company\.com\/attachments\//;
        const enterpriseUrl = 'https://github.company.com/attachments/image.png';

        // 추가 전 테스트
        expect(ImageUtils.hasGitHubImages(`<img src="${enterpriseUrl}"/>`)).toBe(false);

        // 패턴 추가
        const result = ImageUtils.addGitHubPattern(enterprisePattern);
        expect(result).toBe(true);

        // 추가 후 테스트
        expect(ImageUtils.hasGitHubImages(`<img src="${enterpriseUrl}"/>`)).toBe(true);
        expect(ImageUtils.extractGitHubImageUrls(`<img src="${enterpriseUrl}"/>`)).toContain(enterpriseUrl);
      });

      test('커스텀 CDN 패턴 추가', () => {
        const cdnPattern = /^https:\/\/cdn\.githubusercontent\.com\//;
        const cdnUrl = 'https://cdn.githubusercontent.com/images/image.png';

        const result = ImageUtils.addGitHubPattern(cdnPattern);
        expect(result).toBe(true);

        // 변환 테스트
        const convertedText = ImageUtils.convertImagesToSlackLinks(`<img src="${cdnUrl}" alt="CDN Image"/>`);
        expect(convertedText).toBe(`<${cdnUrl}|[CDN Image]>`);
      });

      test('베타/테스트 환경 패턴 추가', () => {
        const betaPattern = /^https:\/\/beta-github\.example\.com\/assets\//;
        const testPattern = /^https:\/\/test-github\.example\.com\/uploads\//;

        expect(ImageUtils.addGitHubPattern(betaPattern)).toBe(true);
        expect(ImageUtils.addGitHubPattern(testPattern)).toBe(true);

        const betaUrl = 'https://beta-github.example.com/assets/feature.png';
        const testUrl = 'https://test-github.example.com/uploads/debug.jpg';

        const mixedText = `
          ![Beta](${betaUrl})
          <img src="${testUrl}" alt="Test"/>
        `;

        const result = ImageUtils.processCommentImages(mixedText);
        expect(result.githubImageCount).toBe(2);
        expect(result.text).toContain(`<${betaUrl}|[Beta]>`);
        expect(result.text).toContain(`<${testUrl}|[Test]>`);
      });
    });
  });

  describe('패턴 관리 통합 테스트', () => {
    test('패턴 추가 후 전체 기능 동작 확인', () => {
      const customPattern = /^https:\/\/assets\.github-test\.com\//;
      const customUrl = 'https://assets.github-test.com/test-image.png';

      // 1. 패턴 추가 전 상태 확인
      expect(ImageUtils.hasGitHubImages(`<img src="${customUrl}"/>`)).toBe(false);
      expect(ImageUtils.extractGitHubImageUrls(`<img src="${customUrl}"/>`)).toEqual([]);

      // 2. 패턴 추가
      const addResult = ImageUtils.addGitHubPattern(customPattern);
      expect(addResult).toBe(true);

      // 3. 패턴 목록에 포함되었는지 확인
      const patterns = ImageUtils.getSupportedGitHubPatterns();
      expect(patterns).toContain(customPattern);

      // 4. 모든 기능이 새 패턴으로 동작하는지 확인
      expect(ImageUtils.hasGitHubImages(`<img src="${customUrl}"/>`)).toBe(true);
      expect(ImageUtils.extractGitHubImageUrls(`<img src="${customUrl}"/>`)).toContain(customUrl);

      const convertedText = ImageUtils.convertImagesToSlackLinks(`<img src="${customUrl}" alt="Custom"/>`);
      expect(convertedText).toBe(`<${customUrl}|[Custom]>`);

      const processResult = ImageUtils.processCommentImages(`![Test](${customUrl})`);
      expect(processResult.githubImageCount).toBe(1);
      expect(processResult.text).toBe(`<${customUrl}|[Test]>`);
    });

    test('여러 패턴 추가 후 우선순위 동작', () => {
      const pattern1 = /^https:\/\/priority1\.github\.com\//;
      const pattern2 = /^https:\/\/priority2\.github\.com\//;

      ImageUtils.addGitHubPattern(pattern1);
      ImageUtils.addGitHubPattern(pattern2);

      const url1 = 'https://priority1.github.com/image1.png';
      const url2 = 'https://priority2.github.com/image2.png';

      const mixedText = `<img src="${url1}"/> <img src="${url2}"/>`;
      const extractedUrls = ImageUtils.extractGitHubImageUrls(mixedText);

      expect(extractedUrls).toContain(url1);
      expect(extractedUrls).toContain(url2);
      expect(extractedUrls).toHaveLength(2);
    });

    test('패턴 추가가 성능에 미치는 영향', () => {
      // 많은 패턴 추가
      const additionalPatterns = Array.from({ length: 50 }, (_, i) => (
        new RegExp(`^https:\\/\\/pattern${i}\\.github\\.com\\/`)
      ));

      additionalPatterns.forEach((pattern) => {
        expect(ImageUtils.addGitHubPattern(pattern)).toBe(true);
      });

      // 성능 테스트
      const testUrl = 'https://github.com/user-attachments/assets/test.png';
      const testText = `<img src="${testUrl}"/>`;

      const start = Date.now();
      for (let i = 0; i < 100; i += 1) {
        ImageUtils.hasGitHubImages(testText);
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // 패턴이 많아도 합리적인 성능 유지
    });
  });
});
