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
    if (found != null) {
      _applyCourse(found);
    }
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  IconButton.filledTonal(
                    onPressed: () => context.pop(),
                    icon: const Icon(Icons.arrow_back),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _TopRouteSelector(
                      departure: _departure,
                      destination: _destination,
                      onTapDeparture: () => _pickPlace('출발지 검색', 'departure'),
                      onTapDestination: () =>
                          _pickPlace('도착지 검색', 'destination'),
                    ),
                  ),
                ],
              ),
            ),
          ),
          DraggableScrollableSheet(
            initialChildSize: 0.30,
            minChildSize: 0.20,
            maxChildSize: 0.92,
            snap: true,
            snapSizes: const <double>[0.30, 0.58, 0.92],
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
                    const SizedBox(height: 10),
                    _CourseSelectTile(
                      onTap: () => _pickPlace('코스(관광지) 검색', 'course'),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      '관광지 코스',
                      style:
                          TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                    ),
                    const SizedBox(height: 8),
                    ReorderableListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      buildDefaultDragHandles: false,
                      itemCount: _spots.length,
                      onReorder: (int oldIndex, int newIndex) {
                        setState(() {
                          if (newIndex > oldIndex) {
                            newIndex -= 1;
                          }
                          final List<PlaceSelection> next = <PlaceSelection>[
                            ..._spots,
                          ];
                          final PlaceSelection item = next.removeAt(oldIndex);
                          next.insert(newIndex, item);
                          _spots = next;
                        });
                      },
                      itemBuilder: (BuildContext context, int index) {
                        final PlaceSelection spot = _spots[index];
                        return ReorderableDelayedDragStartListener(
                          key: ValueKey<String>(
                              'spot-${spot.placeId ?? spot.name}-$index'),
                          index: index,
                          child: Card(
                            margin: const EdgeInsets.only(bottom: 6),
                            child: ListTile(
                              dense: true,
                              visualDensity: const VisualDensity(
                                horizontal: 0,
                                vertical: -2,
                              ),
                              leading: CircleAvatar(
                                radius: 13,
                                child: Text(
                                  '${index + 1}',
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ),
                              title: Text(
                                spot.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: (spot.address?.isNotEmpty ?? false)
                                  ? Text(
                                      spot.address!,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    )
                                  : null,
                              trailing: IconButton(
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
                            ),
                          ),
                        );
                      },
                    ),
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

  Future<void> _pickPlace(String title, String target) async {
    final PlaceSelection? selected = await showModalBottomSheet<PlaceSelection>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext context) {
        return FractionallySizedBox(
          heightFactor: 0.96,
          child: _PlaceSearchSheet(
            title: title,
            placesApi: _placesApi,
          ),
        );
      },
    );

    if (selected == null || !mounted) {
      return;
    }

    setState(() {
      if (target == 'departure') {
        _departure = selected;
        return;
      }
      if (target == 'destination') {
        _destination = selected;
        return;
      }
      if (_spots.any((PlaceSelection s) {
        if ((s.placeId?.isNotEmpty ?? false) &&
            (selected.placeId?.isNotEmpty ?? false)) {
          return s.placeId == selected.placeId;
        }
        return s.name == selected.name;
      })) {
        return;
      }
      _spots = <PlaceSelection>[..._spots, selected];
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
    return PlaceSelection(name: name, point: _knownLocations[name]);
  }

  int _parseDurationHours(String raw) {
    final RegExpMatch? match = RegExp(r'\d+').firstMatch(raw);
    return int.tryParse(match?.group(0) ?? '') ?? 4;
  }
}

class _TopRouteSelector extends StatelessWidget {
  const _TopRouteSelector({
    required this.departure,
    required this.destination,
    required this.onTapDeparture,
    required this.onTapDestination,
  });

  final PlaceSelection departure;
  final PlaceSelection destination;
  final VoidCallback onTapDeparture;
  final VoidCallback onTapDestination;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.95),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: <Widget>[
          _TopRoutePill(
            icon: Icons.radio_button_unchecked,
            color: const Color(0xFF334155),
            text: departure.name,
            onTap: onTapDeparture,
          ),
          const SizedBox(width: 6),
          const Icon(Icons.arrow_forward, size: 16, color: Color(0xFF64748B)),
          const SizedBox(width: 6),
          _TopRoutePill(
            icon: Icons.circle,
            color: const Color(0xFFDC2626),
            text: destination.name,
            onTap: onTapDestination,
          ),
        ],
      ),
    );
  }
}

class _TopRoutePill extends StatelessWidget {
  const _TopRoutePill({
    required this.icon,
    required this.color,
    required this.text,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: <Widget>[
              Icon(icon, size: 13, color: color),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  text,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CourseSelectTile extends StatelessWidget {
  const _CourseSelectTile({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Row(
          children: <Widget>[
            Icon(Icons.search, size: 18),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                '코스 선택 (Google 검색)',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            Icon(Icons.chevron_right),
          ],
        ),
      ),
    );
  }
}

class _PlaceSearchSheet extends StatefulWidget {
  const _PlaceSearchSheet({
    required this.title,
    required this.placesApi,
  });

  final String title;
  final PlacesApi placesApi;

  @override
  State<_PlaceSearchSheet> createState() => _PlaceSearchSheetState();
}

class _PlaceSearchSheetState extends State<_PlaceSearchSheet> {
  final TextEditingController _controller = TextEditingController();
  List<PlaceAutocompleteItem> _predictions = <PlaceAutocompleteItem>[];
  bool _loading = false;
  int _requestId = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final double keyboardBottom = MediaQuery.of(context).viewInsets.bottom;

    return Material(
      color: const Color(0xFFF8FAFC),
      borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(bottom: keyboardBottom),
          child: Column(
            children: <Widget>[
              const SizedBox(height: 8),
              Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: <Widget>[
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        autofocus: true,
                        decoration: InputDecoration(
                          hintText: widget.title,
                          border: const OutlineInputBorder(),
                          isDense: true,
                          prefixIcon: const Icon(Icons.search),
                          suffixIcon: _loading
                              ? const Padding(
                                  padding: EdgeInsets.all(12),
                                  child: SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2),
                                  ),
                                )
                              : null,
                        ),
                        onChanged: _search,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: _predictions.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (BuildContext context, int index) {
                    final PlaceAutocompleteItem item = _predictions[index];
                    return ListTile(
                      dense: true,
                      leading: const Icon(Icons.place_outlined),
                      title: Text(item.primaryText),
                      subtitle: item.secondaryText.isEmpty
                          ? null
                          : Text(item.secondaryText),
                      onTap: () => _select(item),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _search(String value) async {
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

  Future<void> _select(PlaceAutocompleteItem prediction) async {
    setState(() => _loading = true);
    try {
      final PlaceDetailsItem details =
          await widget.placesApi.details(prediction.placeId);
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop(
        PlaceSelection(
          name: details.name.isNotEmpty ? details.name : prediction.primaryText,
          placeId: details.placeId,
          address: details.address,
          point: details.location,
        ),
      );
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

extension on List<LatLng> {
  LatLng? get firstOrNull => isEmpty ? null : first;
}
