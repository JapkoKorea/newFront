# Japan Taxi Tour Booking System

React-Vite 기반의 일본 비에이·아사히카와 지역 택시 투어 예약 시스템입니다. Google Maps API를 통합하여 경로 시각화, 인터랙티브 마커, 지역 제한 기능을 제공합니다.

## 🚀 주요 기능

### 📍 경로 시각화

- 선택한 코스의 출발지, 도착지, 중간 관광지를 지도에 표시
- 실시간 경로 계산 및 최적화된 경유지 순서
- 커스텀 마커와 라벨로 명확한 위치 구분

### 🎯 인터랙티브 UX

- 코스 카드 hover ↔ 지도 마커 연동 (양방향)
- 관광지 추가/삭제 시 즉시 지도 반영
- 지도 클릭과 검색 두 가지 위치 선택 방법

### 🗺️ 지역 제한

- 아사히카와(旭川)·비에이(美瑛) 지역만 선택 가능
- 허용 범위 밖 클릭 시 토스트 알림
- 지도 이동/확대/축소는 자유롭게 허용

### ⚡ 성능 최적화

- Directions API 호출 디바운싱 (300ms)
- 컴포넌트 분리로 재사용성 향상
- 효율적인 상태 관리

## 📦 설치 방법

### 1. 의존성 설치

```bash
# pnpm 사용 (권장)
pnpm install

# 또는 npm 사용
npm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 프로젝트 루트에 생성하고 Google Maps API 키를 설정하세요:

```env
# .env.local
VITE_GOOGLE_MAPS_KEY=YOUR_ACTUAL_GOOGLE_MAPS_API_KEY_HERE
```

**Google Maps API 설정 방법:**

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. Maps JavaScript API, Places API, Directions API 활성화
3. API 키 생성 및 적절한 제한 설정
4. 위의 환경 변수에 API 키 입력

### 3. 개발 서버 실행

```bash
# pnpm 사용
pnpm dev

# 또는 npm 사용
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속

### 4. 빌드

```bash
# pnpm 사용
pnpm build

# 또는 npm 사용
npm run build
```

## 🏗️ 컴포넌트 구조

### 📁 src/components/

#### `TaxiBooking.jsx` (메인 컴포넌트)

- 3단계 예약 프로세스 관리
- 코스 선택, 일정 설정, 예약자 정보 입력
- 상태 관리 및 데이터 흐름 제어

#### `MapContainer.jsx` (지도 컨테이너)

```jsx
<MapContainer
  departure={string}           // 출발지
  destination={string}         // 도착지
  spots={array}               // 관광지 배열
  onPlaceChange={function}    // 위치 변경 핸들러
  onSpotAdd={function}        // 관광지 추가 핸들러
  onSpotRemove={function}     // 관광지 제거 핸들러
  hoveredSpot={string}        // 현재 hover된 관광지
/>
```

**주요 기능:**

- Google Maps 로딩 및 초기화
- 지도 클릭 이벤트 처리
- 허용 지역 범위 체크
- 마커 및 경로 렌더링 관리

#### `MarkerWithLabel.jsx` (커스텀 마커)

```jsx
<MarkerWithLabel
  position={{lat, lng}}       // 마커 위치
  label={string}              // 마커 라벨 텍스트
  color={string}              // 마커 색상 (hex)
  isHovered={boolean}         // hover 상태
  onClick={function}          // 클릭 핸들러
/>
```

**특징:**

- SVG 기반 커스텀 마커 아이콘
- Hover 시 크기 변화 및 bounce 애니메이션
- 라벨과 색상 커스터마이징

#### `RouteRenderer.jsx` (경로 렌더링)

```jsx
<RouteRenderer
  departure={string}          // 출발지
  destination={string}        // 도착지
  spots={array}              // 경유지 배열
  onRouteChange={function}   // 경로 변경 콜백
/>
```

**기능:**

- Google Directions API 연동
- 300ms 디바운싱으로 성능 최적화
- 경유지 순서 자동 최적화
- 커스텀 polyline 스타일링

## 🗺️ 관광지 좌표 데이터

`src/components/MapContainer.jsx`의 `COORDS_DICT`에서 관리:

```javascript
export const COORDS_DICT = {
  "크리스마스트리의 나무": { lat: 43.5928, lng: 142.4672 },
  "세븐스타의 나무": { lat: 43.5902, lng: 142.4551 },
  "켄과 메리의 나무": { lat: 43.5743, lng: 142.4526 },
  // ... 기타 관광지
};
```

## 🎨 스타일링

### CSS 클래스

- `.marker-label`: 마커 라벨 스타일링
- 기본적으로 Tailwind CSS 사용
- 호버 효과 및 트랜지션 적용

### 색상 체계

- 🟢 출발지 마커: `#22c55e` (green-500)
- 🔴 도착지 마커: `#ef4444` (red-500)
- 🟡 관광지 마커: `#f59e0b` (yellow-500)
- 🟡 경로 라인: `#f59e0b` (yellow-500)

## 🔧 사용 방법

### 1. 코스 선택

- 6가지 사전 정의된 코스 중 선택
- 또는 "커스텀 코스 구성하기" 선택

### 2. 지도에서 위치 선택

- **버튼 방식**: "출발지 선택", "도착지 선택", "+ 장소 추가" 버튼 클릭 후 지도 클릭
- **검색 방식**: 상단 검색 입력창에서 Places Autocomplete 이용

### 3. 관광지 관리

- 관광지 목록에서 hover 시 지도의 해당 마커가 bounce
- X 버튼으로 관광지 삭제 시 즉시 지도에서 제거

### 4. 경로 확인

- 모든 위치 선택 완료 시 자동으로 최적 경로 계산
- 실시간으로 경로 업데이트

## 🚨 제약 사항

### 지역 제한

- **허용 지역**: 아사히카와시, 비에이조, 가미후라노조, 후라노시
- **좌표 범위**:
  - 위도: 43.35 ~ 43.85
  - 경도: 142.2 ~ 142.7

### API 제한

- Google Maps API 할당량 주의
- 과도한 Directions API 호출 방지를 위한 디바운싱 적용

## 🧪 테스트

### 기본 동작 확인

1. 코스 선택 → 지도에 출발지/도착지/관광지 마커 표시
2. 관광지 hover → 해당 마커 bounce 애니메이션
3. 관광지 삭제 → 마커 및 경로 즉시 업데이트
4. 허용 범위 밖 클릭 → 토스트 알림 표시

### 성능 테스트

- 빠른 연속 위치 변경 시 디바운싱 동작 확인
- 다수 관광지 추가 시 렌더링 성능 확인

## 📝 라이센스

이 프로젝트는 MIT 라이센스하에 있습니다.

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해주세요.
