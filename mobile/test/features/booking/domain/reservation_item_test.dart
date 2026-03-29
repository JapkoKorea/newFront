import 'package:flutter_test/flutter_test.dart';
import 'package:japan_taxi_tour_mobile/features/booking/domain/reservation_item.dart';

void main() {
  test('ReservationItem.fromJson parses core reservation fields', () {
    final ReservationItem item = ReservationItem.fromJson(
      <String, dynamic>{
        'reservation_number': 'RES-20260329-001',
        'status': 'pending',
        'payment_status': 'ready',
        'english_name': 'David',
        'contact_number': '010-1234-5678',
        'tour_date': '2026-04-01',
        'tour_start_time': '10:30',
        'departure': 'Biei Station',
        'destination': 'Asahikawa Airport',
        'desired_course': 'Biei -> Blue Pond',
        'number_of_people': 4,
      },
    );

    expect(item.reservationNumber, 'RES-20260329-001');
    expect(item.status, 'pending');
    expect(item.paymentStatus, 'ready');
    expect(item.englishName, 'David');
    expect(item.numberOfPeople, 4);
  });
}
