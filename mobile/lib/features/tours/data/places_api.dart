import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../core/network/api_client.dart';

class PlacesApiException implements Exception {
  PlacesApiException(this.message);

  final String message;

  @override
  String toString() => 'PlacesApiException: $message';
}

class PlaceAutocompleteItem {
  const PlaceAutocompleteItem({
    required this.placeId,
    required this.description,
    required this.primaryText,
    required this.secondaryText,
  });

  final String placeId;
  final String description;
  final String primaryText;
  final String secondaryText;
}

class PlaceDetailsItem {
  const PlaceDetailsItem({
    required this.placeId,
    required this.name,
    required this.address,
    required this.location,
  });

  final String placeId;
  final String name;
  final String address;
  final LatLng location;
}

class PlacesApi {
  PlacesApi({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<List<PlaceAutocompleteItem>> autocomplete(String query) async {
    final String trimmed = query.trim();
    if (trimmed.length < 2) {
      return const <PlaceAutocompleteItem>[];
    }

    final Map<String, dynamic> json;
    try {
      json = await _apiClient.getJson(
        '/api/maps/places/autocomplete',
        query: <String, String>{
          'q': trimmed,
          'language': 'ko',
          'region': 'jp',
        },
      );
    } on ApiClientException catch (e) {
      throw PlacesApiException(_messageForApiError(e));
    }
    final List<dynamic> predictions =
        (json['predictions'] as List<dynamic>? ?? <dynamic>[]);
    return predictions
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> item) => PlaceAutocompleteItem(
            placeId: item['place_id']?.toString() ?? '',
            description: item['description']?.toString() ?? '',
            primaryText: item['primary_text']?.toString() ?? '',
            secondaryText: item['secondary_text']?.toString() ?? '',
          ),
        )
        .where((PlaceAutocompleteItem item) => item.placeId.isNotEmpty)
        .toList();
  }

  Future<PlaceDetailsItem> details(String placeId) async {
    final Map<String, dynamic> json;
    try {
      json = await _apiClient.getJson(
        '/api/maps/places/details',
        query: <String, String>{
          'place_id': placeId,
          'language': 'ko',
        },
      );
    } on ApiClientException catch (e) {
      throw PlacesApiException(_messageForApiError(e));
    }

    final Map<String, dynamic> place =
        (json['place'] as Map<String, dynamic>? ?? <String, dynamic>{});
    final Map<String, dynamic> location =
        (place['location'] as Map<String, dynamic>? ?? <String, dynamic>{});
    final double lat = (location['lat'] as num?)?.toDouble() ?? 0;
    final double lng = (location['lng'] as num?)?.toDouble() ?? 0;

    return PlaceDetailsItem(
      placeId: place['place_id']?.toString() ?? placeId,
      name: place['name']?.toString() ?? '',
      address: place['address']?.toString() ?? '',
      location: LatLng(lat, lng),
    );
  }

  String _messageForApiError(ApiClientException error) {
    final String normalized = error.message.toUpperCase();

    if (error.statusCode == -1) {
      return '검색 서버에 연결할 수 없습니다.\n${error.message}';
    }

    if (normalized.contains('REQUEST_DENIED')) {
      return 'Google Places 요청이 거부되었습니다. 서버 키 설정을 확인해 주세요.';
    }

    if (normalized.contains('OVER_QUERY_LIMIT')) {
      return '검색 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.';
    }

    if (normalized.contains('INVALID_REQUEST')) {
      return '검색 요청 형식이 올바르지 않습니다. 검색어를 다시 입력해 주세요.';
    }

    if (error.statusCode >= 500) {
      return '장소 검색 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.\n${error.message}';
    }

    return error.message;
  }
}
