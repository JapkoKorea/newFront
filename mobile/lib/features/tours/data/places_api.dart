import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../core/network/api_client.dart';

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

    final Map<String, dynamic> json = await _apiClient.getJson(
      '/api/maps/places/autocomplete',
      query: <String, String>{
        'q': trimmed,
        'language': 'ko',
        'region': 'jp',
      },
    );
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
    final Map<String, dynamic> json = await _apiClient.getJson(
      '/api/maps/places/details',
      query: <String, String>{
        'place_id': placeId,
        'language': 'ko',
      },
    );

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
}
