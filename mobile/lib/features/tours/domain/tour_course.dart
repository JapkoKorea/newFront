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
