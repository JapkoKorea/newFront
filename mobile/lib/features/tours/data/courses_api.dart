import '../../../core/network/api_client.dart';
import '../domain/tour_course.dart';

/// 백엔드 코스 API(`/api/courses`) 클라이언트. 하드코딩 코스 데이터를 대체한다.
class CoursesApi {
  CoursesApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<TourCourse>> fetchCourses({String? season}) async {
    final Map<String, dynamic> json = await _client.getJson(
      '/api/courses',
      query: season != null ? <String, String>{'season': season} : null,
    );
    final List<dynamic> list = (json['courses'] as List<dynamic>?) ?? <dynamic>[];
    return list
        .whereType<Map<String, dynamic>>()
        .map(_fromJson)
        .toList(growable: false);
  }

  Future<TourCourse> fetchCourse(String id) async {
    final Map<String, dynamic> json = await _client.getJson('/api/courses/$id');
    return _fromJson(json);
  }

  TourCourse _fromJson(Map<String, dynamic> json) {
    return TourCourse(
      id: (json['id'] ?? '').toString(),
      season: ((json['season'] as List<dynamic>?) ?? <dynamic>[])
          .map((dynamic e) => e.toString())
          .toList(growable: false),
      name: (json['name'] ?? '').toString(),
      duration: (json['duration'] ?? '').toString(),
      departure: (json['departure'] ?? '').toString(),
      destination: (json['destination'] ?? '').toString(),
      spots: ((json['spots'] as List<dynamic>?) ?? <dynamic>[])
          .map((dynamic e) => e.toString())
          .toList(growable: false),
      description: (json['description'] ?? '').toString(),
      badge: json['badge'] as String?,
      depositKrw: (json['depositKrw'] as num?)?.toInt(),
      basePriceJpy: (json['basePriceJpy'] as num?)?.toInt(),
      ratingAvg: (json['ratingAvg'] as num?)?.toDouble() ?? 0,
      ratingCount: (json['ratingCount'] as num?)?.toInt() ?? 0,
      heroImageUrl: json['heroImageUrl'] as String?,
    );
  }
}
