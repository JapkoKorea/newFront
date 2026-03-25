// 시즌 구분: 'winter' | 'summer' | 'all_season'
// winter: 11~3월, summer: 6~9월, all_season: 4~5월, 10월 (또는 연중 가능)

export function detectSeason(dateStr) {
  if (!dateStr) return 'all_season'
  const month = new Date(dateStr).getMonth() + 1
  if ([11, 12, 1, 2, 3].includes(month)) return 'winter'
  if ([6, 7, 8, 9].includes(month)) return 'summer'
  return 'all_season'
}

export const popularDestinations = [
  '크리스마스 나무',
  '세븐스타 나무',
  '켄과 메리 나무',
  '마일드세븐 언덕',
  '탁신관',
  '흰수염폭포',
  '청의 호수',
  '패치워크의 길',
  '닝구르 테라스',
  '팜 토미타',
  '사계채언덕 (四季彩の丘)',
  '아사히야마 동물원',
]

export const spotGuideData = {
  '크리스마스 나무': {
    stayMinutes: 20,
    season: ['winter', 'all_season'],
    photoPoint: '정면 도로 쪽에서 단독 트리 구도를 잡기 좋아요.',
    nearby: ['세븐스타 나무', '패치워크의 길'],
  },
  '세븐스타 나무': {
    stayMinutes: 20,
    season: ['winter', 'summer', 'all_season'],
    photoPoint: '일몰 전 역광 타이밍이 사진 색감이 가장 좋아요.',
    nearby: ['켄과 메리 나무', '마일드세븐 언덕'],
  },
  '켄과 메리 나무': {
    stayMinutes: 15,
    season: ['winter', 'summer', 'all_season'],
    photoPoint: '길을 배경으로 나무를 세로 프레임으로 담기 좋습니다.',
    nearby: ['세븐스타 나무', '마일드세븐 언덕'],
  },
  '마일드세븐 언덕': {
    stayMinutes: 20,
    season: ['winter', 'summer', 'all_season'],
    photoPoint: '언덕 라인이 보이는 높은 지점에서 촬영 추천.',
    nearby: ['켄과 메리 나무', '패치워크의 길'],
  },
  '탁신관': {
    stayMinutes: 30,
    season: ['summer', 'all_season'],
    photoPoint: '라벤더 시즌에는 입구 주변 색감이 가장 선명합니다.',
    nearby: ['크리스마스 나무', '청의 호수'],
  },
  '흰수염폭포': {
    stayMinutes: 25,
    season: ['winter', 'summer', 'all_season'],
    photoPoint: '다리 중앙 지점에서 폭포 전경을 넓게 담아보세요.',
    nearby: ['청의 호수', '닝구르 테라스'],
  },
  '청의 호수': {
    stayMinutes: 35,
    season: ['winter', 'summer', 'all_season'],
    photoPoint: '산책로 첫 포인트가 호수 색을 가장 진하게 볼 수 있어요.',
    nearby: ['흰수염폭포', '탁신관'],
  },
  '패치워크의 길': {
    stayMinutes: 25,
    season: ['summer', 'all_season'],
    photoPoint: '넓은 화각으로 구릉지 패턴을 담으면 대표 컷이 됩니다.',
    nearby: ['세븐스타 나무', '크리스마스 나무'],
  },
  '닝구르 테라스': {
    stayMinutes: 40,
    season: ['winter', 'summer', 'all_season'],
    photoPoint: '해 질 무렵 조명 켜지는 시간대 방문을 추천합니다.',
    nearby: ['흰수염폭포', '팜 토미타'],
  },
  '팜 토미타': {
    stayMinutes: 50,
    season: ['summer'],
    photoPoint: '라벤더 밭 중앙 동선에서 파노라마 촬영 추천.',
    nearby: ['닝구르 테라스', '후라노역'],
  },
  '사계채언덕 (四季彩の丘)': {
    stayMinutes: 45,
    season: ['summer', 'all_season'],
    photoPoint: '전망 포인트에서 꽃밭 층을 배경으로 촬영하기 좋아요.',
    nearby: ['비에이역', '팜 토미타'],
  },
  '아사히야마 동물원': {
    stayMinutes: 70,
    season: ['winter', 'summer', 'all_season'],
    photoPoint: '펭귄/물개 관찰관 앞 대기 시간을 고려해 주세요.',
    nearby: ['아사히카와역', '세븐스타 나무'],
  },
}

// season 배열: 해당 코스가 적합한 시즌 목록
export const tourCourses = [
  // ── 겨울 코스 ──────────────────────────────────────
  {
    id: 'snow-drive',
    season: ['winter'],
    name: '설경 드라이브 코스',
    duration: '3시간',
    departure: '아사히카와역',
    destination: '비에이역',
    spots: ['크리스마스 나무', '켄과 메리 나무', '마일드세븐 언덕'],
    description: '순백의 설원과 눈 덮인 나무들을 드라이브하며 감상. 겨울 비에이의 핵심 루트.',
    badge: '⛄ 겨울 추천',
  },
  {
    id: 'winter-falls',
    season: ['winter'],
    name: '빙결 폭포·호수 코스',
    duration: '4시간',
    departure: '아사히카와역',
    destination: '아사히카와역',
    spots: ['청의 호수', '흰수염폭포', '크리스마스 나무'],
    description: '겨울에만 볼 수 있는 빙결 흰수염폭포와 설원의 청의 호수. 특별한 겨울 풍경.',
    badge: '⛄ 겨울 한정',
  },
  // ── 여름 코스 ──────────────────────────────────────
  {
    id: 'lavender-road',
    season: ['summer'],
    name: '라벤더 로드 코스',
    duration: '4시간',
    departure: '비에이역',
    destination: '후라노역',
    spots: ['팜 토미타', '닝구르 테라스', '패치워크의 길'],
    description: '7~8월 라벤더 절정기에 맞춘 후라노~비에이 꽃길 루트. 보라빛 풍경 속 드라이브.',
    badge: '🌸 여름 추천',
  },
  {
    id: 'flower-hill',
    season: ['summer'],
    name: '꽃의 언덕 파노라마 코스',
    duration: '3시간',
    departure: '아사히카와역',
    destination: '비에이역',
    spots: ['사계채언덕 (四季彩の丘)', '패치워크의 길', '세븐스타 나무'],
    description: '형형색색 꽃밭 언덕이 펼쳐지는 여름 비에이. 사계채언덕의 꽃 층을 파노라마로.',
    badge: '🌸 여름 한정',
  },
  // ── 사계절 코스 ───────────────────────────────────
  {
    id: 'standard',
    season: ['winter', 'summer', 'all_season'],
    name: '스탠다드 비에이 명소 코스',
    duration: '3시간',
    departure: '아사히카와역',
    destination: '비에이역',
    spots: ['크리스마스 나무', '탁신관', '흰수염폭포'],
    description: '가장 인기 있는 정석 루트. 짧은 시간 안에 비에이의 대표 명소를 둘러보는 코스.',
    badge: null,
  },
  {
    id: 'nature',
    season: ['winter', 'summer', 'all_season'],
    name: '비에이 자연 감성 코스',
    duration: '3시간',
    departure: '아사히카와역',
    destination: '비에이역',
    spots: ['세븐스타 나무', '켄과 메리 나무', '마일드세븐 언덕', '청의 호수'],
    description: '사진 촬영을 좋아하거나 자연경관 중심의 여유로운 투어를 원하는 분께 추천.',
    badge: null,
  },
  {
    id: 'family',
    season: ['winter', 'summer', 'all_season'],
    name: '가족 맞춤 코스',
    duration: '3시간',
    departure: '아사히카와역',
    destination: '아사히카와역',
    spots: ['크리스마스 나무', '사계채언덕 (四季彩の丘)', '아사히야마 동물원'],
    description: '아이가 있는 가족에게 적합한 코스. 동물원 + 가벼운 자연 관광 조합.',
    badge: null,
  },
  {
    id: 'extended',
    season: ['summer', 'all_season'],
    name: '비에이~후라노 확장 코스',
    duration: '4-6시간',
    departure: '비에이역',
    destination: '아사히카와역',
    spots: ['청의 호수', '흰수염폭포', '닝구르 테라스', '팜 토미타'],
    description: '꽃이 피는 계절(6~8월)에는 후라노까지 연결된 장거리 루트로 추천.',
    badge: null,
  },
  {
    id: 'photo',
    season: ['winter', 'summer', 'all_season'],
    name: '감성 사진 명소 투어',
    duration: '4-6시간',
    departure: '아사히카와역',
    destination: '아사히카와역',
    spots: ['세븐스타 나무', '켄과 메리 나무', '마일드세븐 언덕', '패치워크의 길', '크리스마스 나무'],
    description: '사진 찍기 좋은 장소들만 모아 구성. 인스타 감성 코스로 인기.',
    badge: null,
  },
  {
    id: 'custom',
    season: ['winter', 'summer', 'all_season'],
    name: '커스텀 코스 구성하기',
    duration: '협의',
    departure: '',
    destination: '',
    spots: [],
    description: '원하는 장소와 시간으로 맞춤 제작',
    badge: null,
  },
]

export const SEASON_LABEL = {
  winter: '겨울',
  summer: '여름',
  all_season: '사계절',
}

export const SEASON_MONTHS = {
  winter: '11월~3월',
  summer: '6월~9월',
  all_season: '4~5월, 10월',
}
