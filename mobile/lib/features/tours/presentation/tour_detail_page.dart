import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../booking/application/booking_coordinator.dart';
import '../data/courses_api.dart';
import '../data/places_api.dart';
import '../domain/tour_course.dart';

const LatLng _defaultCenter = LatLng(43.5900, 142.4600);
const double _initialSheetSize = 0.30;
const List<double> _sheetSnapSizes = <double>[
  0.20,
  _initialSheetSize,
  0.58,
  0.92
];

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
  final CoursesApi _coursesApi = CoursesApi();
  final DraggableScrollableController _sheetController =
      DraggableScrollableController();
  final GlobalKey<_RouteMapPreviewState> _mapPreviewKey =
      GlobalKey<_RouteMapPreviewState>();

  bool _loading = true;
  String? _error;
  TourCourse? _course;
  late PlaceSelection _departure;
  late PlaceSelection _destination;
  late List<PlaceSelection> _spots;
  double _sheetExtent = _initialSheetSize;
  int _fitRevision = 0;

  @override
  void initState() {
    super.initState();
    _loadCourse();
  }

  Future<void> _loadCourse() async {
    try {
      final TourCourse course = await _coursesApi.fetchCourse(widget.tourId);
      if (!mounted) {
        return;
      }
      setState(() {
        _applyCourse(course);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = '코스를 불러오지 못했습니다.';
      });
    }
  }

  @override
  void dispose() {
    _sheetController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('코스 상세')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    final TourCourse? current = _course;
    if (current == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('코스 상세')),
        body: Center(child: Text(_error ?? '존재하지 않는 코스입니다.')),
      );
    }

    return Scaffold(
      body: Stack(
        children: <Widget>[
          Positioned.fill(
            child: _RouteMapPreview(
              key: _mapPreviewKey,
              departure: _departure,
              destination: _destination,
              spots: _spots,
              bottomOverlayFraction: _sheetExtent,
              fitRevision: _fitRevision,
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
          NotificationListener<DraggableScrollableNotification>(
            onNotification: (DraggableScrollableNotification notification) {
              if (_shouldSyncSheetExtent(notification.extent)) {
                setState(() {
                  _sheetExtent = notification.extent;
                  _fitRevision += 1;
                });
              }
              return false;
            },
            child: DraggableScrollableSheet(
              controller: _sheetController,
              initialChildSize: _initialSheetSize,
              minChildSize: 0.20,
              maxChildSize: 0.92,
              snap: true,
              snapSizes: const <double>[..._sheetSnapSizes],
              builder: (BuildContext context, ScrollController controller) {
                return Container(
                  decoration: const BoxDecoration(
                    color: Color(0xFFFAFAFA),
                    borderRadius:
                        BorderRadius.vertical(top: Radius.circular(22)),
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
                        style: TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 16),
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
                                courseId: current.id,
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
          ),
        ],
      ),
    );
  }

  bool _shouldSyncSheetExtent(double extent) {
    const double epsilon = 0.02;
    final bool isNearSnap = _sheetSnapSizes.any(
      (double snap) => (extent - snap).abs() <= epsilon,
    );
    if (!isNearSnap) {
      return false;
    }
    return (_sheetExtent - extent).abs() > 0.01;
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
      } else if (target == 'destination') {
        _destination = selected;
      } else if (!_spots.any((PlaceSelection s) {
        if ((s.placeId?.isNotEmpty ?? false) &&
            (selected.placeId?.isNotEmpty ?? false)) {
          return s.placeId == selected.placeId;
        }
        return s.name == selected.name;
      })) {
        _spots = <PlaceSelection>[..._spots, selected];
      }
      _fitRevision += 1;
    });

    _forceMapFitSoon();

    _snapSheetToInitial();
  }

  void _snapSheetToInitial() {
    setState(() {
      _sheetExtent = _initialSheetSize;
      _fitRevision += 1;
    });
    if (!_sheetController.isAttached) {
      return;
    }
    _sheetController
        .animateTo(
      _initialSheetSize,
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
    )
        .then((_) {
      if (!mounted) {
        return;
      }
      setState(() => _fitRevision += 1);
      _forceMapFitSoon();
    }).catchError((Object error, StackTrace stackTrace) {
      debugPrint('Sheet snap skipped: $error');
      return;
    });
  }

  void _forceMapFitSoon() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      _mapPreviewKey.currentState?.forceFit();
    });
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
  String? _errorMessage;
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
                child: _buildBody(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    final String query = _controller.text.trim();

    if (query.isEmpty) {
      return const Center(
        child: Text(
          '장소명을 입력해 주세요.',
          style: TextStyle(color: Color(0xFF64748B)),
        ),
      );
    }

    if (query.length < 2) {
      return const Center(
        child: Text(
          '두 글자 이상 입력하면 검색할 수 있어요.',
          style: TextStyle(color: Color(0xFF64748B)),
        ),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const Icon(Icons.error_outline, color: Color(0xFFDC2626)),
              const SizedBox(height: 8),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF334155)),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: _loading ? null : () => _search(query),
                icon: const Icon(Icons.refresh),
                label: const Text('다시 시도'),
              ),
            ],
          ),
        ),
      );
    }

    if (!_loading && _predictions.isEmpty) {
      return const Center(
        child: Text(
          '검색 결과가 없습니다.',
          style: TextStyle(color: Color(0xFF64748B)),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      itemCount: _predictions.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (BuildContext context, int index) {
        final PlaceAutocompleteItem item = _predictions[index];
        return ListTile(
          dense: true,
          leading: const Icon(Icons.place_outlined),
          title: Text(item.primaryText),
          subtitle:
              item.secondaryText.isEmpty ? null : Text(item.secondaryText),
          onTap: _loading ? null : () => _select(item),
        );
      },
    );
  }

  Future<void> _search(String value) async {
    final String query = value.trim();
    final int requestId = ++_requestId;

    if (query.length < 2) {
      setState(() {
        _predictions = <PlaceAutocompleteItem>[];
        _loading = false;
        _errorMessage = null;
      });
      return;
    }

    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      final List<PlaceAutocompleteItem> next =
          await widget.placesApi.autocomplete(query);
      if (!mounted || requestId != _requestId) {
        return;
      }
      setState(() {
        _predictions = next;
        _loading = false;
        _errorMessage = null;
      });
    } on PlacesApiException catch (e) {
      if (!mounted || requestId != _requestId) {
        return;
      }
      setState(() {
        _predictions = <PlaceAutocompleteItem>[];
        _loading = false;
        _errorMessage = e.message;
      });
    } catch (e) {
      if (!mounted || requestId != _requestId) {
        return;
      }
      setState(() {
        _predictions = <PlaceAutocompleteItem>[];
        _loading = false;
        _errorMessage = '검색 중 오류가 발생했습니다: $e';
      });
    }
  }

  Future<void> _select(PlaceAutocompleteItem prediction) async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
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
    } on PlacesApiException catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _errorMessage = e.message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    } catch (e) {
      if (!mounted) {
        return;
      }
      final String message = '장소 상세 정보를 가져오지 못했습니다: $e';
      setState(() {
        _loading = false;
        _errorMessage = message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    }
  }
}

class _RouteMapPreview extends StatefulWidget {
  const _RouteMapPreview({
    super.key,
    required this.departure,
    required this.destination,
    required this.spots,
    required this.bottomOverlayFraction,
    required this.fitRevision,
  });

  final PlaceSelection departure;
  final PlaceSelection destination;
  final List<PlaceSelection> spots;
  final double bottomOverlayFraction;
  final int fitRevision;

  @override
  State<_RouteMapPreview> createState() => _RouteMapPreviewState();
}

class _RouteMapPreviewState extends State<_RouteMapPreview> {
  static const Offset _endpointAnchor = Offset(13 / 188, 20 / 40);

  GoogleMapController? _mapController;
  String _lastRouteSignature = '';
  BitmapDescriptor? _departureIcon;
  BitmapDescriptor? _destinationIcon;
  final Map<int, BitmapDescriptor> _spotNumberIcons = <int, BitmapDescriptor>{};
  int _lastSpotCount = -1;
  String _lastDepartureName = '';
  String _lastDestinationName = '';
  double _lastDevicePixelRatio = 0;

  @override
  void initState() {
    super.initState();
    _prepareMarkerIcons(forceAll: true);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _prepareMarkerIcons(forceAll: true);
  }

  @override
  void didUpdateWidget(covariant _RouteMapPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    final bool spotChanged = oldWidget.spots.length != widget.spots.length;
    final bool endpointChanged =
        oldWidget.departure.name != widget.departure.name ||
            oldWidget.destination.name != widget.destination.name;
    if (spotChanged || endpointChanged) {
      _prepareMarkerIcons(forceAll: endpointChanged);
    }

    final bool overlayChanged =
        (oldWidget.bottomOverlayFraction - widget.bottomOverlayFraction).abs() >
            0.005;
    final bool revisionChanged = oldWidget.fitRevision != widget.fitRevision;
    if (overlayChanged || revisionChanged || spotChanged || endpointChanged) {
      forceFit();
    }
  }

  void forceFit() {
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
    _fitRouteIfNeeded(route, force: true);
  }

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
      padding: EdgeInsets.only(
        top: 96,
        bottom:
            MediaQuery.sizeOf(context).height * widget.bottomOverlayFraction +
                24,
        left: 16,
        right: 16,
      ),
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

    final List<LatLng> validRoute = route.where(_isValidLatLng).toList();
    if (validRoute.isEmpty) {
      return;
    }

    final String signature =
        '${validRoute.map((LatLng p) => '${p.latitude},${p.longitude}').join('|')}|sheet:${widget.bottomOverlayFraction.toStringAsFixed(3)}|rev:${widget.fitRevision}';
    if (!force && signature == _lastRouteSignature) {
      return;
    }
    _lastRouteSignature = signature;

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted || validRoute.isEmpty) {
        return;
      }

      if (validRoute.length == 1) {
        await controller.animateCamera(
          CameraUpdate.newCameraPosition(
            CameraPosition(target: validRoute.first, zoom: 12),
          ),
        );
        return;
      }

      double minLat = validRoute.first.latitude;
      double maxLat = validRoute.first.latitude;
      double minLng = validRoute.first.longitude;
      double maxLng = validRoute.first.longitude;

      for (final LatLng point in validRoute.skip(1)) {
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
          12,
        ),
      );
    });
  }

  bool _isValidLatLng(LatLng point) {
    if (!point.latitude.isFinite || !point.longitude.isFinite) {
      return false;
    }
    return point.latitude >= -90 &&
        point.latitude <= 90 &&
        point.longitude >= -180 &&
        point.longitude <= 180;
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
          anchor: _endpointAnchor,
          icon: _departureIcon ??
              BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        ),
      if (dstPoint != null)
        Marker(
          markerId: const MarkerId('destination'),
          position: dstPoint,
          anchor: _endpointAnchor,
          icon: _destinationIcon ??
              BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
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
          icon: _spotNumberIcons[i] ??
              BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
        ),
      );
    }

    return markers;
  }

  Future<void> _prepareMarkerIcons({bool forceAll = false}) async {
    if (!mounted) {
      return;
    }

    final double dpr = _devicePixelRatio();
    final bool dprChanged = (_lastDevicePixelRatio - dpr).abs() > 0.01;

    BitmapDescriptor? departureIcon = _departureIcon;
    BitmapDescriptor? destinationIcon = _destinationIcon;

    final bool regenerateDeparture = forceAll ||
        dprChanged ||
        departureIcon == null ||
        _lastDepartureName != widget.departure.name;
    if (regenerateDeparture) {
      departureIcon = await _buildEndpointIcon(
        prefix: '출발',
        placeName: widget.departure.name,
        dotColor: const Color(0xFF16A34A),
        dpr: dpr,
      );
    }

    final bool regenerateDestination = forceAll ||
        dprChanged ||
        destinationIcon == null ||
        _lastDestinationName != widget.destination.name;
    if (regenerateDestination) {
      destinationIcon = await _buildEndpointIcon(
        prefix: '도착',
        placeName: widget.destination.name,
        dotColor: const Color(0xFFDC2626),
        dpr: dpr,
      );
    }

    final int spotCount = widget.spots.length;
    final bool needSpotIcons =
        forceAll || dprChanged || spotCount != _lastSpotCount;
    final Map<int, BitmapDescriptor> nextSpotIcons =
        Map<int, BitmapDescriptor>.from(_spotNumberIcons);

    if (needSpotIcons) {
      nextSpotIcons.clear();
      for (int i = 0; i < spotCount; i++) {
        nextSpotIcons[i] = await _buildNumberIcon('${i + 1}', dpr: dpr);
      }
    }

    if (!mounted) {
      return;
    }

    setState(() {
      _departureIcon = departureIcon;
      _destinationIcon = destinationIcon;
      if (needSpotIcons) {
        _spotNumberIcons
          ..clear()
          ..addAll(nextSpotIcons);
      }
      _lastSpotCount = spotCount;
      _lastDepartureName = widget.departure.name;
      _lastDestinationName = widget.destination.name;
      _lastDevicePixelRatio = dpr;
    });
  }

  Future<BitmapDescriptor> _buildEndpointIcon({
    required String prefix,
    required String placeName,
    required Color dotColor,
    required double dpr,
  }) async {
    const double width = 188;
    const double height = 40;
    final ui.PictureRecorder recorder = ui.PictureRecorder();
    final Canvas canvas = Canvas(recorder);
    canvas.scale(dpr, dpr);

    final Paint dotPaint = Paint()..color = dotColor;
    final Paint dotStroke = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    const Offset dotCenter = Offset(13, 20);
    canvas.drawCircle(dotCenter, 6, dotPaint);
    canvas.drawCircle(dotCenter, 6, dotStroke);

    final RRect labelRect = RRect.fromRectAndRadius(
      const Rect.fromLTWH(24, 6, width - 30, 28),
      const Radius.circular(10),
    );
    final Paint labelPaint = Paint()..color = const Color(0xEFFFFFFF);
    final Paint labelBorder = Paint()
      ..color = const Color(0xFFD1D5DB)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    canvas.drawRRect(labelRect, labelPaint);
    canvas.drawRRect(labelRect, labelBorder);

    final String label = '$prefix · $placeName';
    final String clipped =
        label.length > 18 ? '${label.substring(0, 18)}…' : label;

    final TextPainter painter = TextPainter(
      text: TextSpan(
        text: clipped,
        style: const TextStyle(
          color: Color(0xFF0F172A),
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
      textDirection: ui.TextDirection.ltr,
    )..layout();

    painter.paint(
      canvas,
      Offset(30, (height - painter.height) / 2),
    );

    final ui.Image image = await recorder
        .endRecording()
        .toImage((width * dpr).round(), (height * dpr).round());
    final ByteData? byteData =
        await image.toByteData(format: ui.ImageByteFormat.png);
    final Uint8List bytes = byteData!.buffer.asUint8List();
    return _descriptorFromBytes(bytes, dpr: dpr);
  }

  Future<BitmapDescriptor> _buildNumberIcon(
    String number, {
    required double dpr,
  }) async {
    const double size = 30;
    final ui.PictureRecorder recorder = ui.PictureRecorder();
    final Canvas canvas = Canvas(recorder);
    canvas.scale(dpr, dpr);

    final Paint fillPaint = Paint()..color = const Color(0xFFF59E0B);
    final Paint strokePaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4;

    const Offset center = Offset(size / 2, size / 2);
    canvas.drawCircle(center, size / 2 - 2, fillPaint);
    canvas.drawCircle(center, size / 2 - 2, strokePaint);

    final TextPainter painter = TextPainter(
      text: TextSpan(
        text: number,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 14,
          fontWeight: FontWeight.w800,
        ),
      ),
      textDirection: ui.TextDirection.ltr,
    )..layout();

    painter.paint(
      canvas,
      Offset((size - painter.width) / 2, (size - painter.height) / 2),
    );

    final ui.Image image = await recorder
        .endRecording()
        .toImage((size * dpr).round(), (size * dpr).round());
    final ByteData? byteData =
        await image.toByteData(format: ui.ImageByteFormat.png);
    final Uint8List bytes = byteData!.buffer.asUint8List();
    return _descriptorFromBytes(bytes, dpr: dpr);
  }

  BitmapDescriptor _descriptorFromBytes(
    Uint8List bytes, {
    required double dpr,
  }) {
    try {
      return BitmapDescriptor.bytes(
        bytes,
        imagePixelRatio: dpr,
        bitmapScaling: MapBitmapScaling.auto,
      );
    } catch (error) {
      debugPrint('BitmapDescriptor.bytes fallback: $error');
      return BitmapDescriptor.bytes(bytes);
    }
  }

  double _devicePixelRatio() {
    final double? mediaQueryDpr = MediaQuery.maybeDevicePixelRatioOf(context);
    if (mediaQueryDpr != null && mediaQueryDpr > 0) {
      return mediaQueryDpr;
    }

    final Iterable<ui.FlutterView> views = ui.PlatformDispatcher.instance.views;
    if (views.isNotEmpty && views.first.devicePixelRatio > 0) {
      return views.first.devicePixelRatio;
    }

    return 2.0;
  }
}

extension on List<LatLng> {
  LatLng? get firstOrNull => isEmpty ? null : first;
}
