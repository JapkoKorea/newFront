import 'package:google_maps_flutter/google_maps_flutter.dart';

class SpotPoint {
  const SpotPoint({
    required this.label,
    required this.position,
  });

  final String label;
  final LatLng position;

  SpotPoint copyWith({
    String? label,
    LatLng? position,
  }) {
    return SpotPoint(
      label: label ?? this.label,
      position: position ?? this.position,
    );
  }
}
