module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true, // 일반적인 Jest 환경 활성화 방식
  },
  extends: [
    'airbnb-base',
    'plugin:jest/recommended', // Jest 권장 설정 포함
  ],
  plugins: ['jest'],
  overrides: [
    {
      env: {
        node: true,
      },
      files: [
        '.eslintrc.{js,cjs}',
      ],
      parserOptions: {
        sourceType: 'script',
      },
    },
    {
      files: ['**/*.test.js', '**/*.spec.js', '**/__tests__/**/*.js'],
      env: {
        jest: true, // 테스트 파일에 대해 명시적으로 설정
      },
    },
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'max-len': ['error', { code: 140 }],
    'no-console': 'off',
  },
};
