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
    required this.paymentChannel,
    required this.paymentOrderNo,
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

  /// 최신 결제 알림의 수단('bank_transfer' | 'naver')과 스토어 주문번호.
  /// 고객에게 보여줄 단계가 이 값에 따라 갈린다(CustomerStage 참고).
  final String? paymentChannel;
  final String? paymentOrderNo;

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
      paymentChannel: json['payment_channel']?.toString(),
      paymentOrderNo: json['payment_order_no']?.toString(),
    );
  }
}
