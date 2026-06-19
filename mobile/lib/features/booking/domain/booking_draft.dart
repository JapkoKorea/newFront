class BookingDraft {
  const BookingDraft({
    this.departure = '',
    this.destination = '',
    this.date = '',
    this.time = '',
    this.passengers = 1,
    this.durationHours = 4,
    this.selectedSpots = const <String>[],
    this.name = '',
    this.phone = '',
    this.serviceType = 'tour',
    this.season = 'winter',
    this.depositAgreement = false,
    this.courseId,
    this.isCustom = false,
  });

  final String departure;
  final String destination;
  final String date;
  final String time;
  final int passengers;
  final int durationHours;
  final List<String> selectedSpots;
  final String name;
  final String phone;
  final String serviceType;
  final String season;
  final bool depositAgreement;
  final String? courseId;
  final bool isCustom;

  BookingDraft copyWith({
    String? departure,
    String? destination,
    String? date,
    String? time,
    int? passengers,
    int? durationHours,
    List<String>? selectedSpots,
    String? name,
    String? phone,
    String? serviceType,
    String? season,
    bool? depositAgreement,
    String? courseId,
    bool? isCustom,
  }) {
    return BookingDraft(
      departure: departure ?? this.departure,
      destination: destination ?? this.destination,
      date: date ?? this.date,
      time: time ?? this.time,
      passengers: passengers ?? this.passengers,
      durationHours: durationHours ?? this.durationHours,
      selectedSpots: selectedSpots ?? this.selectedSpots,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      serviceType: serviceType ?? this.serviceType,
      season: season ?? this.season,
      depositAgreement: depositAgreement ?? this.depositAgreement,
      courseId: courseId ?? this.courseId,
      isCustom: isCustom ?? this.isCustom,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'departure': departure,
      'destination': destination,
      'date': date,
      'time': time,
      'passengers': passengers,
      'durationHours': durationHours,
      'selectedSpots': selectedSpots,
      'name': name,
      'phone': phone,
      'serviceType': serviceType,
      'season': season,
      'depositAgreement': depositAgreement,
      'courseId': courseId,
      'isCustom': isCustom,
    };
  }

  factory BookingDraft.fromJson(Map<String, dynamic> json) {
    return BookingDraft(
      departure: json['departure']?.toString() ?? '',
      destination: json['destination']?.toString() ?? '',
      date: json['date']?.toString() ?? '',
      time: json['time']?.toString() ?? '',
      passengers: (json['passengers'] as num?)?.toInt() ?? 1,
      durationHours: (json['durationHours'] as num?)?.toInt() ?? 4,
      selectedSpots: (json['selectedSpots'] as List<dynamic>? ?? <dynamic>[])
          .map((dynamic e) => e.toString())
          .toList(),
      name: json['name']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      serviceType: json['serviceType']?.toString() ?? 'tour',
      season: json['season']?.toString() ?? 'winter',
      depositAgreement: json['depositAgreement'] == true,
      courseId: json['courseId']?.toString(),
      isCustom: json['isCustom'] == true,
    );
  }
}
