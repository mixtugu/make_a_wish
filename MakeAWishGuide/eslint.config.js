// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // svgs.ts 는 원본 SVG 를 변환해 둔 큰 데이터 파일
    ignores: ['dist/*', 'src/assets/svgs.ts'],
  },
]);
