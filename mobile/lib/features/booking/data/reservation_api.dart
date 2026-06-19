import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/booking_draft.dart';
import '../domain/reservation_item.dart';

class ReservationApi {
  ReservationApi(this._apiClient);

  final ApiClient _apiClient;

  Future<String> createReservation(BookingDraft draft) async {
    final Map<String, dynamic> payload = <String, dynamic>{
      'english_name': draft.name,
      'contact_number': draft.phone.isEmpty ? 'N/A' : draft.phone,
      'tour_date': draft.date,
      'tour_start_time': draft.time,
      'tour_duration': draft.durationHours,
      'number_of_people': draft.passengers,
      'departure': draft.departure,
      'destination': draft.destination,
      'desired_course': _composeDesiredCourse(draft),
      'service_type': draft.serviceType,
      'season': draft.season,
      'source_channel': 'app',
      'course_id': draft.courseId,
      'is_custom': draft.isCustom,
      'selected_spots': draft.selectedSpots
          .map((String name) => <String, dynamic>{'name': name})
          .toList(),
    };

    final Map<String, dynamic> response = await _apiClient.postJson(
      '/api/reservations',
      body: payload,
    );

    final String? reservationNumber = response['reservationNumber']?.toString();
    if (reservationNumber == null || reservationNumber.isEmpty) {
      throw ApiClientException(500, 'Reservation number missing in response');
    }

    return reservationNumber;
  }

  Future<List<ReservationItem>> listReservations() async {
    final Map<String, dynamic> response =
        await _apiClient.getJson('/api/reservations');
    final List<dynamic> items =
        response['reservations'] as List<dynamic>? ?? <dynamic>[];
    return items
        .whereType<Map<String, dynamic>>()
        .map(ReservationItem.fromJson)
        .toList();
  }

  Future<ReservationItem?> getReservation(String reservationNumber) async {
    final Map<String, dynamic> response = await _apiClient.getJson(
      '/api/reservations',
      query: <String, String>{'reservation_number': reservationNumber},
    );
    final List<dynamic> items =
        response['reservations'] as List<dynamic>? ?? <dynamic>[];
    if (items.isEmpty || items.first is! Map<String, dynamic>) {
      return null;
    }
    return ReservationItem.fromJson(items.first as Map<String, dynamic>);
  }

  Future<void> cancelReservation(String reservationNumber) async {
    await _apiClient.patchJson('/api/reservations/$reservationNumber/cancel');
  }

  String _composeDesiredCourse(BookingDraft draft) {
    if (draft.selectedSpots.isEmpty) {
      return 'Mobile route: ${draft.departure} -> ${draft.destination}';
    }
    final String spots = draft.selectedSpots.join(' -> ');
    return 'Mobile route: ${draft.departure} -> [$spots] -> ${draft.destination}';
  }
}

final Provider<ReservationApi> reservationApiProvider =
    Provider<ReservationApi>((Ref ref) {
  return ReservationApi(ApiClient());
});
