# 상품 상세페이지 하네스 (`src/products/`)

Canva "잽코 상세페이지 0624" 류의 **커머스형 상품 상세페이지**를
**데이터 1개 = 상품 1개**로 관리/운영하는 하네스다.
상품 데이터만 추가하면 상세 라우트(`/products/<slug>`)와 목록(`/products`)이
자동 생성된다. UI 코드는 건드리지 않는다.

## 구조

```
src/products/
  schema.js        상품 데이터 형태 정의 + 검증(defineProduct) + 상수
  registry.js      상품 등록/조회 (allProducts, getProduct, listProducts)
  items/
    summer-lavender-taxi.js   예시 상품 (Canva 0624 내용)
  README.md        이 문서

src/components/ProductDetailClient.jsx   데이터 -> 상세페이지 렌더
src/app/products/page.jsx                상품 목록 (/products)
src/app/products/[slug]/page.jsx         상품 상세 (SSG + metadata + JSON-LD)
public/assets/                           heroImage 가 가리키는 정적 이미지
```

## 새 상품 추가 (운영 절차)

1. `items/<slug>.js` 생성. `summer-lavender-taxi.js`를 복사해 값만 수정한다.
   - 반드시 `defineProduct({...})`로 감싼다 (필수 필드/형식 검증).
2. 대표 이미지를 `public/assets/`에 넣고 `heroImage`를 `/assets/<파일>`로 지정.
3. `registry.js`의 `allProducts` 배열에 import 후 등록.
4. 끝. `/products/<slug>` 와 목록이 자동 반영된다.

## 노출 / 내림 (운영)

- `status: 'published'` 만 라우트·목록·SSG에 노출된다.
- 임시로 내리려면 `status: 'draft'`로 바꾸면 페이지가 사라진다 (파일 삭제 불필요).
- 목록 정렬은 `sortOrder` (작을수록 먼저).

## 필수 필드

`slug`, `name`, `summary`, `heroImage` 는 필수.
요금은 둘 중 **하나 이상** 필요 — 누락 시 빌드/로드 시점에 에러를 던진다.
나머지는 기본값이 채워진다 (`schema.js` 참고).

## 요금 표현 (둘 중 선택)

- `vehicleTiers` — **시간당** 과금 (예: `summer-lavender-taxi`). 차량 등급별 정상가/할인가.
- `charterPricing` — **전세 정액** 패키지 (예: `biei-hokkaido-charter`). 이용 시간별 요금.
  - `jumboNote` 로 점보 택시 등 추가 차량 안내 문구를 덧붙일 수 있다.

둘 다 넣으면 전세 표가 먼저, 시간당 표가 뒤에 렌더된다.

## DB 카탈로그와의 관계

필드명은 `DB_DESIGN.md`의 `courses` 테이블(`hero_image_url`, `deposit_krw`,
`base_price_jpy`, `is_active` 등)과 정렬돼 있다. 추후 정적 데이터를
DB 카탈로그로 옮길 때 `registry.js`의 조회 함수만 API 호출로 교체하면
렌더(`ProductDetailClient`)는 그대로 재사용된다.
(`tourCourses.js` 정적 데이터 -> `fetchCourse` API 폴백과 동일한 패턴.)

## 주의

- UI 텍스트/데이터에 이모지 금지 (프로젝트 hook으로 강제).
- 스타일은 Tailwind만, 아이콘은 `lucide-react`만 사용.
