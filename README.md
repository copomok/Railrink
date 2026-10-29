# 레일링크 RailLink
NIMBY Rail 게임 데이터 기반 독립 예매 시제품. 실제 결제·발권·좌석 확보 기능은 없습니다.

## 실행
Node.js 22 이상. 외부 npm 의존성 없음.

```sh
cd /workspace/Railrink
npm start
```

공통 원본은 기본적으로 옆의 `../NIMBYRAILTABLE` 체크아웃입니다. 다른 위치는 `RAIL_SOURCE`로 지정합니다. 원본에는 이번 변경의 `js/shared/nimbi_rail_domain.js`와 이를 로드하는 index.html이 필요합니다. 두 저장소의 변경을 함께 보존해야 합니다.

RailLink 진입점은 `/`, 기존 철도 정보 앱은 `/NIMBYRAILTABLE/`입니다. `PORT` 기본값 4173, `HOST` 기본값 127.0.0.1. 서버는 정적 파일과 공통 소스 번들만 제공합니다. 예약 API는 없습니다.

## 공유 구조
`tools/source.mjs`가 원본 index.html의 데이터 로드 순서를 읽어 `/shared/runtime.js`를 제공합니다. 운행 데이터·패치·수요·재고·지연 엔진은 원본 파일을 직접 읽으며 복제본을 관리하지 않습니다. 등급·요금·편성·호차 시설 규칙은 원본의 `js/shared/nimbi_rail_domain.js` 한 곳에 있습니다. 디자인 토큰도 원본 CSS에서 읽습니다.

예약·승객 별칭·대기·즐겨찾기 구간은 `raillink.v1` localStorage에 별도 저장합니다. 원본 `nimbi_tickets`는 변경하지 않습니다. 자정 이후 승차는 승차 날짜와 원본 재고의 운행일을 구분합니다.

## 검증
```sh
npm run check
npm test
cd ../NIMBYRAILTABLE
node --test --test-concurrency=2 tests/*.test.mjs
```

## 제공 범위와 제한
검색·등급/종류/시간 필터·정렬·호차 좌석 선택·할인·확인·로컬 예약·일정 변경·취소·대기 기록·승차 안내·관광열차·구간 저장을 제공합니다. 시안의 화면 흐름을 참고하며 예시 데이터와 로고는 사용하지 않습니다.

실제 결제, 발권 QR, 자동 대기 배정, 푸시, 계정 동기화, 철도 패스 판매, 실시간 장애 피드, 역 내부 길찾기는 백엔드·원천 데이터가 없어 제공하지 않습니다. 지연은 공통 확률 모형이며 승강장은 게임 DB입니다. 원본의 대표 시설 배치와 상세 시설 데이터가 상충할 수 있어 상세 편성 시설을 우선 표시합니다.

원본 PWA의 실행과 기존 예매는 호환성을 위해 유지합니다. `npm run build:pages`는 원본 저장소의 `raillink/`에 정적 배포 파일을 생성합니다. 이 경로를 원본 GitHub Pages와 함께 배포하면 Node 서버 없이 실행됩니다. 운행·시설·수요 데이터는 원본 파일을 직접 로드합니다. UI 변경 시 이 명령으로 배포 산출물을 다시 생성하세요.

## 모바일 화면 개편
첨부 시안을 기준으로 메인·열차 목록·좌석 선택·예약 확인·완료 화면을 재구성했습니다. `css/mobile.css`가 해당 화면 표현을 담당합니다. 최근 검색은 `raillink.recent`에 저장하며, 왕복 선택 시 가는 편 예약 완료 후 오는 편을 별도로 조회할 수 있습니다. 자동 결제나 왕복 동시 확정은 하지 않습니다. 좌석 수와 번호는 실제 공통 편성을 따르며 객차 내부를 스크롤할 수 있습니다.

## Railrink 독립 GitHub Pages 배포

`.github/workflows/pages.yml`은 `main` 푸시 또는 수동 실행 시 검사·빌드 후 `github-pages` 환경으로 배포합니다. `npm run build`의 산출물은 `dist/`이며 공개 주소는 `https://copomok.github.io/Railrink/`입니다. 원본 PWA의 하위 경로 배포와 별도로 관리됩니다.

빌드에서는 `copomok/NIMBYRAILTABLE`의 최신 공통 토큰과 인터페이스를 검사합니다. 배포된 앱은 같은 도메인의 `/NIMBYRAILTABLE/`에서 원본 데이터·시설·지연·수요 모듈을 직접 읽습니다. `dist/`에는 철도 DB를 복사하지 않습니다. 원본 Pages가 먼저 정상 배포되어 있어야 합니다.

워크플로는 Pages 자동 활성화를 시도합니다. 저장소 정책상 자동 활성화 권한이 부족하면 GitHub의 **Settings → Pages → Build and deployment → Source: GitHub Actions**를 선택하고 Actions의 **Deploy RailLink to GitHub Pages**를 다시 실행하세요. 저장소 관리 권한이 필요한 설정이며 별도 결제나 호스팅 계정은 필요 없습니다. `github-pages` 환경에 승인이 설정되어 있으면 해당 배포의 승인도 필요합니다.

기존 `/NIMBYRAILTABLE/raillink/`와 새 `/Railrink/`는 동일한 도메인이므로 기존 브라우저 예약 저장 공간을 공유합니다.
