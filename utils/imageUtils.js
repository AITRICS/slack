const Logger = require('@/utils/logger');

/**
 * GitHub 이미지를 Slack 포맷으로 변환하는 유틸리티
 */
class ImageUtils {
  /**
   * GitHub 관련 이미지 URL 패턴들
   * @private
   * @static
   */
  static #GITHUB_IMAGE_PATTERNS = [
    /^https:\/\/github\.com\/user-attachments\/assets\//,
    /^https:\/\/raw\.githubusercontent\.com\//,
    /^https:\/\/github\.com\/(.*\/)?assets\//, // 수정: github.com/assets/ 와 github.com/owner/repo/assets/ 둘 다 지원
    /^https:\/\/user-images\.githubusercontent\.com\//,
    /^https:\/\/avatars\.githubusercontent\.com\//,
    /^https:\/\/.*\.githubusercontent\.com\//,
  ];

  /**
   * HTML 이미지 태그에서 이미지 정보 추출
   * @private
   * @static
   * @param {string} text - 분석할 텍스트
   * @returns {Object[]} 이미지 정보 배열 [{url, match, alt, position}]
   */
  static #extractImageInfoFromHtml(text) {
    const imgTagPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const imageInfos = [];
    let match;

    // 정규식 실행 전 lastIndex 초기화 (중요!)
    imgTagPattern.lastIndex = 0;

    while ((match = imgTagPattern.exec(text)) !== null) {
      const [fullMatch, url] = match;
      if (url && url.trim()) {
        // alt 속성 추출
        const altMatch = fullMatch.match(/alt=["']([^"']*)["']/i);
        const alt = altMatch ? altMatch[1] : '';

        imageInfos.push({
          url: url.trim(),
          match: fullMatch,
          alt: alt && alt.trim() ? alt.trim() : '', // 공백 제거
          position: match.index, // 텍스트 내 위치 저장
        });
      }
    }

    return imageInfos;
  }

  /**
   * Markdown 이미지 문법에서 이미지 정보 추출
   * @private
   * @static
   * @param {string} text - 분석할 텍스트
   * @returns {Object[]} 이미지 정보 배열 [{url, match, alt, position}]
   */
  static #extractImageInfoFromMarkdown(text) {
    // 더 엄격한 Markdown 패턴 - 줄바꿈 방지로 잘못된 매칭 차단
    const markdownPattern = /!\[([^\]\n]*)\]\(([^)\n]+)\)/g;
    const imageInfos = [];
    let match;

    // 정규식 실행 전 lastIndex 초기화 (중요!)
    markdownPattern.lastIndex = 0;

    while ((match = markdownPattern.exec(text)) !== null) {
      const [fullMatch, alt, url] = match;
      // URL 유효성 검사 강화
      if (url && url.trim() && url.trim().length > 0) {
        imageInfos.push({
          url: url.trim(),
          match: fullMatch,
          alt: alt && alt.trim() ? alt.trim() : '', // 공백 제거
          position: match.index, // 텍스트 내 위치 저장
        });
      }
    }

    return imageInfos;
  }

  /**
   * GitHub 관련 이미지 URL이 유효한지 확인 (확장된 패턴 지원)
   * @private
   * @static
   * @param {string} url - 확인할 URL
   * @returns {boolean} 유효한 GitHub 이미지 URL 여부
   */
  static #isValidGitHubImageUrl(url) {
    try {
      const normalizedUrl = url.trim();
      return ImageUtils.#GITHUB_IMAGE_PATTERNS.some((pattern) => pattern.test(normalizedUrl));
    } catch {
      return false;
    }
  }

  /**
   * 모든 이미지 정보를 한 번에 추출 (중복 변환 방지, 순서 유지)
   * @private
   * @static
   * @param {string} text - 분석할 텍스트
   * @returns {Object[]} 통합된 이미지 정보 배열
   */
  static #extractAllImageInfos(text) {
    const htmlImageInfos = ImageUtils.#extractImageInfoFromHtml(text);
    const markdownImageInfos = ImageUtils.#extractImageInfoFromMarkdown(text);

    // 모든 이미지 정보를 합치고 position 기준으로 정렬 (텍스트 순서 유지)
    const allImageInfos = [...htmlImageInfos, ...markdownImageInfos]
      .sort((a, b) => a.position - b.position);

    // URL 기준으로 중복 제거 (같은 URL이 HTML과 Markdown 양쪽에 있을 경우)
    const uniqueImageInfos = [];
    const seenUrls = new Set();

    allImageInfos.forEach((imageInfo) => {
      if (!seenUrls.has(imageInfo.url)) {
        seenUrls.add(imageInfo.url);
        uniqueImageInfos.push(imageInfo);
      }
    });

    return uniqueImageInfos;
  }

  /**
   * 이미지 태그/문법을 Slack 링크 형태로 변환 (개선된 버전)
   * @static
   * @param {string} text - 변환할 텍스트
   * @returns {string} 변환된 텍스트
   */
  static convertImagesToSlackLinks(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let convertedText = text;
    let conversionCount = 0;

    // 모든 이미지 정보를 한 번에 추출
    const allImageInfos = ImageUtils.#extractAllImageInfos(text);

    // GitHub 이미지만 필터링하고 변환
    const validGitHubImages = allImageInfos.filter((imageInfo) => ImageUtils.#isValidGitHubImageUrl(imageInfo.url));

    // 변환 작업 수행 (긴 매치부터 처리하여 중첩 문제 방지)
    const sortedImages = validGitHubImages.sort((a, b) => b.match.length - a.match.length);

    sortedImages.forEach((imageInfo) => {
      // alt 텍스트가 의미있는 경우 활용, 아니면 기본 텍스트 사용
      const linkText = imageInfo.alt && imageInfo.alt !== 'image' && imageInfo.alt.trim() ?
        `[${imageInfo.alt.trim()}]` :
        '[첨부이미지]';

      const slackLink = `<${imageInfo.url}|${linkText}>`;

      // 해당 매치가 아직 변환되지 않은 경우에만 변환
      if (convertedText.includes(imageInfo.match)) {
        convertedText = convertedText.replace(imageInfo.match, slackLink);
        conversionCount += 1;
      }
    });

    if (conversionCount > 0) {
      Logger.debug(`이미지를 Slack 링크로 변환 완료: ${conversionCount}개`, {
        originalLength: text.length,
        convertedLength: convertedText.length,
        patterns: validGitHubImages.map((img) => ({
          url: img.url,
          alt: img.alt,
        })),
      });
    }

    return convertedText;
  }

  /**
   * 텍스트에서 이미지 URL 추출 (HTML + Markdown, 중복 제거)
   * @static
   * @param {string} text - 분석할 텍스트
   * @returns {string[]} 이미지 URL 목록
   */
  static extractImageUrls(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const allImageInfos = ImageUtils.#extractAllImageInfos(text);
    return allImageInfos.map((info) => info.url);
  }

  /**
   * 텍스트에서 GitHub 이미지 URL만 추출
   * @static
   * @param {string} text - 분석할 텍스트
   * @returns {string[]} GitHub 이미지 URL 목록
   */
  static extractGitHubImageUrls(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const allUrls = ImageUtils.extractImageUrls(text);
    return allUrls.filter(ImageUtils.#isValidGitHubImageUrl);
  }

  /**
   * 코멘트 텍스트에서 이미지를 처리하여 Slack 포맷으로 변환
   * @static
   * @param {string} commentText - 코멘트 텍스트
   * @returns {Object} 변환된 텍스트와 이미지 정보
   */
  static processCommentImages(commentText) {
    try {
      if (!commentText || typeof commentText !== 'string') {
        return {
          text: commentText,
          hasImages: false,
          imageCount: 0,
          githubImageCount: 0,
        };
      }

      const originalImageUrls = ImageUtils.extractImageUrls(commentText);
      const githubImageUrls = ImageUtils.extractGitHubImageUrls(commentText);
      const convertedText = ImageUtils.convertImagesToSlackLinks(commentText);

      Logger.debug('코멘트 이미지 처리 완료', {
        originalTextLength: commentText.length,
        totalImageCount: originalImageUrls.length,
        githubImageCount: githubImageUrls.length,
        convertedTextLength: convertedText.length,
        supportedPatterns: ImageUtils.#GITHUB_IMAGE_PATTERNS.map((p) => p.toString()),
      });

      return {
        text: convertedText,
        hasImages: originalImageUrls.length > 0,
        imageCount: originalImageUrls.length,
        githubImageCount: githubImageUrls.length,
      };
    } catch (error) {
      Logger.error('코멘트 이미지 처리 실패', error);
      return {
        text: commentText, // 실패 시 원본 반환
        hasImages: false,
        imageCount: 0,
        githubImageCount: 0,
      };
    }
  }

  /**
   * GitHub 이미지가 포함된 코멘트인지 확인
   * @static
   * @param {string} text - 확인할 텍스트
   * @returns {boolean} GitHub 이미지 포함 여부
   */
  static hasGitHubImages(text) {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const githubImageUrls = ImageUtils.extractGitHubImageUrls(text);
    return githubImageUrls.length > 0;
  }

  /**
   * 이미지가 포함된 코멘트인지 확인 (모든 이미지 타입)
   * @static
   * @param {string} text - 확인할 텍스트
   * @returns {boolean} 이미지 포함 여부
   */
  static hasImages(text) {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const imageUrls = ImageUtils.extractImageUrls(text);
    return imageUrls.length > 0;
  }

  /**
   * 지원되는 GitHub 이미지 패턴 목록 반환 (디버깅/설정용)
   * @static
   * @returns {RegExp[]} 지원되는 패턴 목록
   */
  static getSupportedGitHubPatterns() {
    return [...ImageUtils.#GITHUB_IMAGE_PATTERNS];
  }

  /**
   * 새로운 GitHub 이미지 패턴 추가 (런타임 확장)
   * @static
   * @param {RegExp} pattern - 추가할 패턴
   * @returns {boolean} 추가 성공 여부
   */
  static addGitHubPattern(pattern) {
    try {
      if (pattern instanceof RegExp) {
        ImageUtils.#GITHUB_IMAGE_PATTERNS.push(pattern);
        Logger.debug('새로운 GitHub 이미지 패턴 추가됨', { pattern: pattern.toString() });
        return true;
      }
      return false;
    } catch (error) {
      Logger.error('GitHub 이미지 패턴 추가 실패', error);
      return false;
    }
  }
}

module.exports = ImageUtils;
