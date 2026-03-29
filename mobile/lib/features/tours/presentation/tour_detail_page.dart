import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../booking/application/booking_coordinator.dart';
import '../data/places_api.dart';
import '../domain/tour_course.dart';

const LatLng _defaultCenter = LatLng(43.5900, 142.4600);

const Map<String, LatLng> _knownLocations = <String, LatLng>{
  '아사히카와역': LatLng(43.7637, 142.3578),
  '비에이역': LatLng(43.5888, 142.4649),
  '후라노역': LatLng(43.3418, 142.3832),
  '아사히카와 공항': LatLng(43.6711, 142.4475),
  '크리스마스 나무': LatLng(43.5928, 142.4672),
  '켄과 메리 나무': LatLng(43.5743, 142.4526),
  '마일드세븐 언덕': LatLng(43.5794, 142.4305),
  '청의 호수': LatLng(43.4936, 142.6147),
  '흰수염폭포': LatLng(43.4922, 142.6353),
  '팜 토미타': LatLng(43.4181, 142.4210),
  '닝구르 테라스': LatLng(43.3403, 142.3847),
  '패치워크의 길': LatLng(43.6008, 142.4442),
  '사계채언덕 (四季彩の丘)': LatLng(43.5868, 142.4578),
  '세븐스타 나무': LatLng(43.5902, 142.4551),
  '탁신관': LatLng(43.5619, 142.4469),
};

class PlaceSelection {
  const PlaceSelection({
    required this.name,
    this.placeId,
    this.address,
    this.point,
  });

  final String name;
  final String? placeId;
  final String? address;
  final LatLng? point;

  PlaceSelection copyWith({
    String? name,
    String? placeId,
    String? address,
    LatLng? point,
  }) {
    return PlaceSelection(
      name: name ?? this.name,
      placeId: placeId ?? this.placeId,
      address: address ?? this.address,
      point: point ?? this.point,
    );
  }
}

class TourDetailPage extends ConsumerStatefulWidget {
  const TourDetailPage({super.key, required this.tourId});

  final String tourId;

  @override
  ConsumerState<TourDetailPage> createState() => _TourDetailPageState();
}

class _TourDetailPageState extends ConsumerState<TourDetailPage> {
  final PlacesApi _placesApi = PlacesApi();

  TourCourse? _course;
  late PlaceSelection _departure;
  late PlaceSelection _destination;
  late List<PlaceSelection> _spots;

  @override
  void initState() {
    super.initState();
    final TourCourse? found = _findCourse(widget.tourId);
    if (found == null) {
      return;
    }
    _applyCourse(found);
  }

  @override
  Widget build(BuildContext context) {
    final TourCourse? current = _course;
    if (current == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('코스 상세')),
        body: const Center(child: Text('존재하지 않는 코스입니다.')),
      );
    }

    return Scaffold(
      body: Stack(
        children: <Widget>[
          Positioned.fill(
            child: _RouteMapPreview(
              departure: _departure,
              destination: _destination,
              spots: _spots,
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: Row(
                children: <Widget>[
                  IconButton.filledTonal(
                    onPressed: () => context.pop(),
                    icon: const Icon(Icons.arrow_back),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.95),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Text(
                        '${_departure.name}  →  ${_destination.name}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          DraggableScrollableSheet(
            initialChildSize: 0.36,
            minChildSize: 0.22,
            maxChildSize: 0.94,
            snap: true,
            snapSizes: const <double>[0.36, 0.62, 0.94],
            builder: (BuildContext context, ScrollController controller) {
              return Container(
                decoration: const BoxDecoration(
                  color: Color(0xFFFAFAFA),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
                  boxShadow: <BoxShadow>[
                    BoxShadow(
                      color: Color(0x22000000),
                      blurRadius: 20,
                      offset: Offset(0, -6),
                    ),
                  ],
                ),
                child: ListView(
                  controller: controller,
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
                  children: <Widget>[
                    Center(
                      child: Container(
                        width: 44,
                        height: 5,
                        decoration: BoxDecoration(
                          color: const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 6,
                      children: current.season
                          .map((String season) =>
                              Chip(label: Text(seasonLabel[season] ?? season)))
                          .toList(),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      current.description,
                      style: const TextStyle(color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 12),
                    _SummaryCard(
                      title: '기본 루트 정보',
                      rows: <MapEntry<String, String>>[
                        MapEntry<String, String>('소요 시간', current.duration),
                        MapEntry<String, String>('출발지', _departure.name),
                        MapEntry<String, String>('도착지', _destination.name),
                      ],
                    ),
                    const SizedBox(height: 10),
                    _SelectorCard(
                      placesApi: _placesApi,
                      departure: _departure,
                      destination: _destination,
                      onDepartureChanged: (PlaceSelection value) {
                        setState(() => _departure = value);
                      },
                      onDestinationChanged: (PlaceSelection value) {
                        setState(() => _destination = value);
                      },
                      onCourseSelected: (PlaceSelection value) {
                        if (_spots.any((PlaceSelection s) =>
                            (s.placeId?.isNotEmpty ?? false)
                                ? s.placeId == value.placeId
                                : s.name == value.name)) {
                          return;
                        }
                        setState(() {
                          _spots = <PlaceSelection>[..._spots, value];
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      '관광지 코스',
                      style:
                          TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                    ),
                    const SizedBox(height: 8),
                    ..._spots
                        .asMap()
                        .entries
                        .map((MapEntry<int, PlaceSelection> e) {
                      final int index = e.key;
                      final PlaceSelection spot = e.value;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: CircleAvatar(
                            radius: 14,
                            child: Text('${index + 1}'),
                          ),
                          title: Text(spot.name),
                          subtitle: Text(spot.address ?? '길게 눌러 순서를 변경하세요'),
                          trailing: Wrap(
                            spacing: 2,
                            children: <Widget>[
                              IconButton(
                                icon: const Icon(Icons.keyboard_arrow_up),
                                onPressed: index <= 0
                                    ? null
                                    : () => _moveSpot(index, index - 1),
                              ),
                              IconButton(
                                icon: const Icon(Icons.keyboard_arrow_down),
                                onPressed: index >= _spots.length - 1
                                    ? null
                                    : () => _moveSpot(index, index + 1),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close),
                                onPressed: () {
                                  setState(() {
                                    _spots = <PlaceSelection>[
                                      ..._spots.sublist(0, index),
                                      ..._spots.sublist(index + 1),
                                    ];
                                  });
                                },
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: () {
                        ref
                            .read(bookingCoordinatorProvider.notifier)
                            .applyTourPrefill(
                              departure: _departure.name,
                              destination: _destination.name,
                              selectedSpots: _spots
                                  .map((PlaceSelection s) => s.name)
                                  .toList(),
                              durationHours:
                                  _parseDurationHours(current.duration),
                              season: current.season.first,
                            );
                        context.push('/booking');
                      },
                      child: const Text('예약 입력 페이지로 이동'),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  void _moveSpot(int oldIndex, int newIndex) {
    if (oldIndex < 0 || oldIndex >= _spots.length) {
      return;
    }
    if (newIndex < 0 || newIndex >= _spots.length) {
      return;
    }
    setState(() {
      final List<PlaceSelection> next = <PlaceSelection>[..._spots];
      final PlaceSelection item = next.removeAt(oldIndex);
      next.insert(newIndex, item);
      _spots = next;
    });
  }

  TourCourse? _findCourse(String id) {
    for (final TourCourse item in tourCourses) {
      if (item.id == id) {
        return item;
      }
    }
    return null;
  }

  void _applyCourse(TourCourse course) {
    _course = course;
    _departure = _selectionFromName(course.departure);
    _destination = _selectionFromName(course.destination);
    _spots = course.spots.map(_selectionFromName).toList();
  }

  PlaceSelection _selectionFromName(String name) {
    return PlaceSelection(
      name: name,
      point: _knownLocations[name],
    );
  }

  int _parseDurationHours(String raw) {
    final RegExpMatch? match = RegExp(r'\d+').firstMatch(raw);
    return int.tryParse(match?.group(0) ?? '') ?? 4;
  }
}

class _SelectorCard extends StatelessWidget {
  const _SelectorCard({
    required this.placesApi,
    required this.departure,
    required this.destination,
    required this.onDepartureChanged,
    required this.onDestinationChanged,
    required this.onCourseSelected,
  });

  final PlacesApi placesApi;
  final PlaceSelection departure;
  final PlaceSelection destination;
  final ValueChanged<PlaceSelection> onDepartureChanged;
  final ValueChanged<PlaceSelection> onDestinationChanged;
  final ValueChanged<PlaceSelection> onCourseSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Text(
            '출발지 / 도착지 / 코스 선택',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          _GooglePlaceSearchField(
            label: '출발지 (Google 검색)',
            initialValue: departure.name,
            placesApi: placesApi,
            onSelected: onDepartureChanged,
          ),
          const SizedBox(height: 8),
          _GooglePlaceSearchField(
            label: '도착지 (Google 검색)',
            initialValue: destination.name,
            placesApi: placesApi,
            onSelected: onDestinationChanged,
          ),
          const SizedBox(height: 8),
          _GooglePlaceSearchField(
            label: '코스 선택 (Google 관광지 검색)',
            initialValue: '',
            clearAfterSelect: true,
            placesApi: placesApi,
            onSelected: onCourseSelected,
          ),
        ],
      ),
    );
  }
}

class _GooglePlaceSearchField extends StatefulWidget {
  const _GooglePlaceSearchField({
    required this.label,
    required this.initialValue,
    required this.placesApi,
    required this.onSelected,
    this.clearAfterSelect = false,
  });

  final String label;
  final String initialValue;
  final PlacesApi placesApi;
  final ValueChanged<PlaceSelection> onSelected;
  final bool clearAfterSelect;

  @override
  State<_GooglePlaceSearchField> createState() =>
      _GooglePlaceSearchFieldState();
}

class _GooglePlaceSearchFieldState extends State<_GooglePlaceSearchField> {
  late final TextEditingController _controller;
  final FocusNode _focusNode = FocusNode();
  List<PlaceAutocompleteItem> _predictions = <PlaceAutocompleteItem>[];
  bool _loading = false;
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
    _focusNode.addListener(() => setState(() {}));
  }

  @override
  void didUpdateWidget(covariant _GooglePlaceSearchField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.clearAfterSelect &&
        widget.initialValue != oldWidget.initialValue &&
        _controller.text != widget.initialValue) {
      _controller.text = widget.initialValue;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        TextField(
          controller: _controller,
          focusNode: _focusNode,
          decoration: InputDecoration(
            labelText: widget.label,
            border: const OutlineInputBorder(),
            isDense: true,
            prefixIcon: const Icon(Icons.search, size: 18),
            suffixIcon: _loading
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : null,
          ),
          onChanged: _onQueryChanged,
        ),
        if (_focusNode.hasFocus && _predictions.isNotEmpty) ...<Widget>[
          const SizedBox(height: 6),
          Container(
            constraints: const BoxConstraints(maxHeight: 180),
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFE2E8F0)),
              borderRadius: BorderRadius.circular(8),
              color: Colors.white,
            ),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: _predictions.length,
              itemBuilder: (BuildContext context, int index) {
                final PlaceAutocompleteItem item = _predictions[index];
                return ListTile(
                  dense: true,
                  title: Text(item.primaryText),
                  subtitle: item.secondaryText.isEmpty
                      ? null
                      : Text(item.secondaryText),
                  onTap: () => _selectPrediction(item),
                );
              },
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _onQueryChanged(String value) async {
    final String query = value.trim();
    final int requestId = ++_requestId;

    if (query.length < 2) {
      setState(() {
        _predictions = <PlaceAutocompleteItem>[];
        _loading = false;
      });
      return;
    }

    setState(() => _loading = true);
    try {
      final List<PlaceAutocompleteItem> next =
          await widget.placesApi.autocomplete(query);
      if (!mounted || requestId != _requestId) {
        return;
      }
      setState(() {
        _predictions = next;
        _loading = false;
      });
    } catch (_) {
      if (!mounted || requestId != _requestId) {
        return;
      }
      setState(() {
        _predictions = <PlaceAutocompleteItem>[];
        _loading = false;
      });
    }
  }

  Future<void> _selectPrediction(PlaceAutocompleteItem prediction) async {
    setState(() => _loading = true);
    try {
      final PlaceDetailsItem details =
          await widget.placesApi.details(prediction.placeId);
      if (!mounted) {
        return;
      }
      final PlaceSelection value = PlaceSelection(
        name: details.name.isNotEmpty ? details.name : prediction.primaryText,
        placeId: details.placeId,
        address: details.address,
        point: details.location,
      );
      widget.onSelected(value);

      if (widget.clearAfterSelect) {
        _controller.clear();
      } else {
        _controller.text = value.name;
      }

      setState(() {
        _predictions = <PlaceAutocompleteItem>[];
        _loading = false;
      });
      _focusNode.unfocus();
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _loading = false);
    }
  }
}

class _RouteMapPreview extends StatefulWidget {
  const _RouteMapPreview({
    required this.departure,
    required this.destination,
    required this.spots,
  });

  final PlaceSelection departure;
  final PlaceSelection destination;
  final List<PlaceSelection> spots;

  @override
  State<_RouteMapPreview> createState() => _RouteMapPreviewState();
}

class _RouteMapPreviewState extends State<_RouteMapPreview> {
  GoogleMapController? _mapController;
  String _lastRouteSignature = '';

  @override
  Widget build(BuildContext context) {
    final LatLng? depPoint = widget.departure.point;
    final LatLng? dstPoint = widget.destination.point;
    final List<LatLng> spotPoints = widget.spots
        .map((PlaceSelection p) => p.point)
        .whereType<LatLng>()
        .toList();

    final List<LatLng> route = <LatLng>[
      if (depPoint != null) depPoint,
      ...spotPoints,
      if (dstPoint != null) dstPoint,
    ];

    final LatLng center = depPoint ?? spotPoints.firstOrNull ?? _defaultCenter;

    _fitRouteIfNeeded(route);

    return GoogleMap(
      initialCameraPosition: CameraPosition(target: center, zoom: 10.8),
      onMapCreated: (GoogleMapController controller) {
        _mapController = controller;
        _fitRouteIfNeeded(route, force: true);
      },
      mapToolbarEnabled: false,
      myLocationButtonEnabled: false,
      zoomControlsEnabled: false,
      markers: _buildMarkers(depPoint, dstPoint, widget.spots),
      polylines: route.length < 2
          ? const <Polyline>{}
          : <Polyline>{
              Polyline(
                polylineId: const PolylineId('tour-route'),
                points: route,
                width: 5,
                color: const Color(0xFF0EA5E9),
              ),
            },
    );
  }

  void _fitRouteIfNeeded(List<LatLng> route, {bool force = false}) {
    final GoogleMapController? controller = _mapController;
    if (controller == null) {
      return;
    }

    final String signature = route
        .map((LatLng p) =>
            '${p.latitude.toStringAsFixed(5)},${p.longitude.toStringAsFixed(5)}')
        .join('|');
    if (!force && signature == _lastRouteSignature) {
      return;
    }
    _lastRouteSignature = signature;

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted || route.isEmpty) {
        return;
      }

      if (route.length == 1) {
        await controller.animateCamera(
          CameraUpdate.newCameraPosition(
            CameraPosition(target: route.first, zoom: 12),
          ),
        );
        return;
      }

      double minLat = route.first.latitude;
      double maxLat = route.first.latitude;
      double minLng = route.first.longitude;
      double maxLng = route.first.longitude;

      for (final LatLng point in route.skip(1)) {
        minLat = math.min(minLat, point.latitude);
        maxLat = math.max(maxLat, point.latitude);
        minLng = math.min(minLng, point.longitude);
        maxLng = math.max(maxLng, point.longitude);
      }

      await controller.animateCamera(
        CameraUpdate.newLatLngBounds(
          LatLngBounds(
            southwest: LatLng(minLat, minLng),
            northeast: LatLng(maxLat, maxLng),
          ),
          64,
        ),
      );
    });
  }

  Set<Marker> _buildMarkers(
    LatLng? depPoint,
    LatLng? dstPoint,
    List<PlaceSelection> spots,
  ) {
    final Set<Marker> markers = <Marker>{
      if (depPoint != null)
        Marker(
          markerId: const MarkerId('departure'),
          position: depPoint,
          infoWindow: InfoWindow(title: '출발지: ${widget.departure.name}'),
          icon:
              BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        ),
      if (dstPoint != null)
        Marker(
          markerId: const MarkerId('destination'),
          position: dstPoint,
          infoWindow: InfoWindow(title: '도착지: ${widget.destination.name}'),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
        ),
    };

    for (int i = 0; i < spots.length; i++) {
      final PlaceSelection spot = spots[i];
      if (spot.point == null) {
        continue;
      }
      markers.add(
        Marker(
          markerId: MarkerId('spot-$i'),
          position: spot.point!,
          infoWindow: InfoWindow(title: '${i + 1}. ${spot.name}'),
          icon:
              BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
        ),
      );
    }

    return markers;
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.title, required this.rows});

  final String title;
  final List<MapEntry<String, String>> rows;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            ...rows.map(
              (MapEntry<String, String> row) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text('${row.key}: ${row.value}'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

extension on List<LatLng> {
  LatLng? get firstOrNull => isEmpty ? null : first;
}
