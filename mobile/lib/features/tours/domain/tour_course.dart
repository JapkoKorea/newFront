class TourCourse {
  const TourCourse({
    required this.id,
    required this.season,
    required this.name,
    required this.duration,
    required this.departure,
    required this.destination,
    required this.spots,
    required this.description,
    this.badge,
  });

  final String id;
  final List<String> season;
  final String name;
  final String duration;
  final String departure;
  final String destination;
  final List<String> spots;
  final String description;
  final String? badge;
}

const Map<String, String> seasonLabel = <String, String>{
  'winter': '겨울',
  'summer': '여름',
  'all_season': '사계절',
};

const List<TourCourse> tourCourses = <TourCourse>[
  TourCourse(
    id: 'snow-drive',
    season: <String>['winter'],
    name: '설경 드라이브 코스',
    duration: '3시간',
    departure: '아사히카와역',
    destination: '비에이역',
    spots: <String>['크리스마스 나무', '켄과 메리 나무', '마일드세븐 언덕'],
    description: '순백의 설원과 눈 덮인 나무들을 드라이브하며 감상. 겨울 비에이의 핵심 루트.',
    badge: '⛄ 겨울 추천',
  ),
  TourCourse(
    id: 'winter-falls',
    season: <String>['winter'],
    name: '빙결 폭포·호수 코스',
    duration: '4시간',
    departure: '아사히카와역',
    destination: '아사히카와역',
    spots: <String>['청의 호수', '흰수염폭포', '크리스마스 나무'],
    description: '겨울에만 볼 수 있는 빙결 폭포와 설원의 청의 호수를 감상합니다.',
    badge: '⛄ 겨울 한정',
  ),
  TourCourse(
    id: 'lavender-road',
    season: <String>['summer'],
    name: '라벤더 로드 코스',
    duration: '4시간',
    departure: '비에이역',
    destination: '후라노역',
    spots: <String>['팜 토미타', '닝구르 테라스', '패치워크의 길'],
    description: '7~8월 라벤더 절정기에 맞춘 후라노~비에이 꽃길 루트.',
    badge: '🌸 여름 추천',
  ),
  TourCourse(
    id: 'flower-hill',
    season: <String>['summer'],
    name: '꽃의 언덕 파노라마 코스',
    duration: '3시간',
    departure: '아사히카와역',
    destination: '비에이역',
    spots: <String>['사계채언덕 (四季彩の丘)', '패치워크의 길', '세븐스타 나무'],
    description: '형형색색 꽃밭 언덕이 펼쳐지는 여름 비에이 파노라마 코스.',
    badge: '🌸 여름 한정',
  ),
  TourCourse(
    id: 'standard',
    season: <String>['winter', 'summer', 'all_season'],
    name: '스탠다드 비에이 명소 코스',
    duration: '3시간',
    departure: '아사히카와역',
    destination: '비에이역',
    spots: <String>['크리스마스 나무', '탁신관', '흰수염폭포'],
    description: '가장 인기 있는 정석 루트. 짧은 시간 안에 대표 명소를 둘러봅니다.',
  ),
  TourCourse(
    id: 'nature',
    season: <String>['winter', 'summer', 'all_season'],
    name: '비에이 자연 감성 코스',
    duration: '3시간',
    departure: '아사히카와역',
    destination: '비에이역',
    spots: <String>['세븐스타 나무', '켄과 메리 나무', '마일드세븐 언덕', '청의 호수'],
    description: '자연경관 중심의 여유로운 투어를 원하는 분께 추천합니다.',
  ),
];
