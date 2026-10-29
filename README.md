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
직통·환승 검색, 왕복 일괄 예약, 편성 기반 직접/자동 좌석 선택, 승객별 할인, 입석·구간 혼합 여정, 통합 승차권·달력·시제품 QR·취소, 시간표/운행 개략도, 반복 예매와 날짜별 여행 일정을 제공합니다.

출발한 열차는 한국 시간의 승차 날짜·시각 기준으로 검색에서 제외하고, 열린 목록에서도 분 경계에 제거합니다. 공통 모형의 재고·지연은 실제 철도 정보가 아닙니다. 실제 결제·발권·검표·정기권 판매·계정 동기화는 없습니다.

원본 PWA의 실행과 기존 예매는 유지합니다. `npm run build:pages`는 기존 원본 저장소 하위 경로용 산출물, `npm run build`는 독립 Railrink Pages용 `dist/`를 생성합니다. 이번 배포는 독립 경로를 대상으로 합니다.

## 화면과 로컬 저장
모바일 홈은 제공된 시안을 따릅니다. 데스크톱 사이드바·태블릿 대응·라이트/다크 테마를 제공합니다. `raillink.v1`에 예약·즐겨찾기·대기·정기 일정, `raillink.recent`에 최근 검색을 저장합니다. 기존 v1 예약도 유지합니다. 여러 구간은 모두 검증한 뒤 한 번에 저장합니다.

독립 서비스워커가 온라인에서 필요한 파일을 캐시하면 저장 승차권과 QR을 오프라인에서 볼 수 있습니다. 새 열차 조회·예약·운행 정보는 온라인에서만 제공합니다. 원본 NIMBY Rail 캐시는 변경하지 않습니다.

## Railrink 독립 GitHub Pages 배포

`.github/workflows/pages.yml`은 `main` 푸시 또는 수동 실행 시 검사·빌드 후 `github-pages` 환경으로 배포합니다. `npm run build`의 산출물은 `dist/`이며 공개 주소는 `https://copomok.github.io/Railrink/`입니다. 원본 PWA의 하위 경로 배포와 별도로 관리됩니다.

빌드에서는 `copomok/NIMBYRAILTABLE`의 최신 공통 토큰과 인터페이스를 검사합니다. 배포된 앱은 같은 도메인의 `/NIMBYRAILTABLE/`에서 원본 데이터·시설·지연·수요 모듈을 직접 읽습니다. `dist/`에는 철도 DB를 복사하지 않습니다. 원본 Pages가 먼저 정상 배포되어 있어야 합니다.

워크플로는 Pages 자동 활성화를 시도합니다. 저장소 정책상 자동 활성화 권한이 부족하면 GitHub의 **Settings → Pages → Build and deployment → Source: GitHub Actions**를 선택하고 Actions의 **Deploy RailLink to GitHub Pages**를 다시 실행하세요. 저장소 관리 권한이 필요한 설정이며 별도 결제나 호스팅 계정은 필요 없습니다. `github-pages` 환경에 승인이 설정되어 있으면 해당 배포의 승인도 필요합니다.

기존 `/NIMBYRAILTABLE/raillink/`와 새 `/Railrink/`는 동일한 도메인이므로 기존 브라우저 예약 저장 공간을 공유합니다.

## 구현 현황과 추가 검증

계층별 변경 파일, 공유 원본, 남은 세부 사양은 [구현 현황](docs/implementation-status.md)에 기록했습니다.

Python Playwright와 Chromium이 설치된 환경에서 `npm run build` 후 `python tools/verify-home.py`, `python tools/verify-journey.py`로 브라우저 회귀 검증을 실행할 수 있습니다. 검증 예약은 임시 브라우저에만 저장됩니다.
