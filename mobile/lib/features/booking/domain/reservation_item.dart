class ReservationItem {
  const ReservationItem({
    required this.reservationNumber,
    required this.status,
    required this.paymentStatus,
    required this.englishName,
    required this.contactNumber,
    required this.tourDate,
    required this.tourStartTime,
    required this.departure,
    required this.destination,
    required this.desiredCourse,
    required this.numberOfPeople,
  });

  final String reservationNumber;
  final String status;
  final String paymentStatus;
  final String englishName;
  final String contactNumber;
  final String tourDate;
  final String tourStartTime;
  final String departure;
  final String destination;
  final String desiredCourse;
  final int numberOfPeople;

  factory ReservationItem.fromJson(Map<String, dynamic> json) {
    return ReservationItem(
      reservationNumber: json['reservation_number']?.toString() ?? '',
      status: json['status']?.toString() ?? 'pending',
      paymentStatus: json['payment_status']?.toString() ?? 'unpaid',
      englishName: json['english_name']?.toString() ?? '-',
      contactNumber: json['contact_number']?.toString() ?? '-',
      tourDate: json['tour_date']?.toString() ?? '-',
      tourStartTime: json['tour_start_time']?.toString() ?? '-',
      departure: json['departure']?.toString() ?? '-',
      destination: json['destination']?.toString() ?? '-',
      desiredCourse: json['desired_course']?.toString() ?? '-',
      numberOfPeople: (json['number_of_people'] as num?)?.toInt() ?? 0,
    );
  }
}
