import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../domain/spot_point.dart';

const bool _isFlutterTest = bool.fromEnvironment('FLUTTER_TEST');

enum MapPickMode { departure, destination, spot }

class MapPickerCard extends StatefulWidget {
  const MapPickerCard({
    super.key,
    required this.mode,
    required this.onModeChanged,
    required this.departure,
    required this.destination,
    required this.spots,
    required this.availableSpotCatalog,
    required this.locationCatalog,
    required this.selectedSpotLabels,
    required this.pendingSelection,
    required this.onMapTapped,
    required this.onSpotTap,
    required this.onPlaceSelected,
    required this.onConfirmMapSelection,
    required this.onClearPendingSelection,
  });

  final MapPickMode mode;
  final ValueChanged<MapPickMode> onModeChanged;
  final LatLng? departure;
  final LatLng? destination;
  final List<SpotPoint> spots;
  final Map<String, LatLng> availableSpotCatalog;
  final Map<String, LatLng> locationCatalog;
  final Set<String> selectedSpotLabels;
  final LatLng? pendingSelection;
  final ValueChanged<LatLng> onMapTapped;
  final ValueChanged<int> onSpotTap;
  final void Function(String label, LatLng point) onPlaceSelected;
  final VoidCallback onConfirmMapSelection;
  final VoidCallback onClearPendingSelection;

  @override
  State<MapPickerCard> createState() => _MapPickerCardState();
}

class _MapPickerCardState extends State<MapPickerCard> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final String query = _searchController.text.trim().toLowerCase();
    final List<MapEntry<String, LatLng>> candidates = _candidates();
    final List<MapEntry<String, LatLng>> filtered = query.isEmpty
        ? candidates.take(6).toList()
        : candidates
            .where((MapEntry<String, LatLng> e) =>
                e.key.toLowerCase().contains(query))
            .take(6)
            .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        _ModeSelector(
          mode: widget.mode,
          onModeChanged: widget.onModeChanged,
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _searchController,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            isDense: true,
            prefixIcon: const Icon(Icons.search, size: 18),
            hintText: widget.mode == MapPickMode.departure
                ? '출발지 검색'
                : widget.mode == MapPickMode.destination
                    ? '도착지 검색'
                    : '주요 관광지 검색',
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
          ),
        ),
        if (filtered.isNotEmpty) ...<Widget>[
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFE2E8F0)),
              borderRadius: BorderRadius.circular(10),
              color: Colors.white,
            ),
            child: Column(
              children: filtered.map((MapEntry<String, LatLng> e) {
                return ListTile(
                  dense: true,
                  title: Text(e.key),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    widget.onPlaceSelected(e.key, e.value);
                    _searchController.clear();
                    setState(() {});
                  },
                );
              }).toList(),
            ),
          ),
        ],
        const SizedBox(height: 10),
        Container(
          clipBehavior: Clip.antiAlias,
          height: 420,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: const <BoxShadow>[
              BoxShadow(
                blurRadius: 16,
                offset: Offset(0, 6),
                color: Color(0x14000000),
              ),
            ],
          ),
          child: Stack(
            children: <Widget>[
              _isFlutterTest
                  ? Container(
                      color: const Color(0xFFE2E8F0),
                      alignment: Alignment.center,
                      child: const Text('테스트 모드에서는 지도가 비활성화됩니다'),
                    )
                  : GoogleMap(
                      initialCameraPosition: const CameraPosition(
                        target: LatLng(43.7709, 142.3650),
                        zoom: 10,
                      ),
                      mapToolbarEnabled: false,
                      compassEnabled: false,
                      myLocationButtonEnabled: false,
                      zoomControlsEnabled: false,
                      onTap: widget.onMapTapped,
                      markers: _buildMarkers(),
                      polylines: _buildPolylines(),
                    ),
              Positioned(
                left: 10,
                right: 10,
                bottom: 10,
                child: _MapSelectionActionBar(
                  mode: widget.mode,
                  pendingSelection: widget.pendingSelection,
                  onConfirm: widget.onConfirmMapSelection,
                  onClear: widget.onClearPendingSelection,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  List<MapEntry<String, LatLng>> _candidates() {
    if (widget.mode == MapPickMode.spot) {
      return widget.availableSpotCatalog.entries
          .where((MapEntry<String, LatLng> e) =>
              !widget.selectedSpotLabels.contains(e.key))
          .toList();
    }
    return widget.locationCatalog.entries.toList();
  }

  Set<Marker> _buildMarkers() {
    final Set<Marker> markers = <Marker>{
      if (widget.departure != null)
        Marker(
          markerId: const MarkerId('departure'),
          position: widget.departure!,
          infoWindow: const InfoWindow(title: '출발'),
          icon:
              BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        ),
      if (widget.destination != null)
        Marker(
          markerId: const MarkerId('destination'),
          position: widget.destination!,
          infoWindow: const InfoWindow(title: '도착'),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
        ),
      if (widget.pendingSelection != null)
        Marker(
          markerId: const MarkerId('pending'),
          position: widget.pendingSelection!,
          infoWindow: const InfoWindow(title: '선택 대기 위치'),
          icon:
              BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
        ),
    };

    for (int i = 0; i < widget.spots.length; i++) {
      final SpotPoint spot = widget.spots[i];
      markers.add(
        Marker(
          markerId: MarkerId('spot_$i'),
          position: spot.position,
          infoWindow: InfoWindow(title: '${i + 1}. ${spot.label}'),
          icon:
              BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
          onTap: () => widget.onSpotTap(i),
        ),
      );
    }

    return markers;
  }

  Set<Polyline> _buildPolylines() {
    final List<LatLng> points = <LatLng>[
      if (widget.departure != null) widget.departure!,
      ...widget.spots.map((SpotPoint e) => e.position),
      if (widget.destination != null) widget.destination!,
    ];
    if (points.length < 2) {
      return const <Polyline>{};
    }
    return <Polyline>{
      Polyline(
        polylineId: const PolylineId('route_preview'),
        points: points,
        width: 5,
        color: const Color(0xFFF59E0B),
      ),
    };
  }
}

class _ModeSelector extends StatelessWidget {
  const _ModeSelector({required this.mode, required this.onModeChanged});

  final MapPickMode mode;
  final ValueChanged<MapPickMode> onModeChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: <Widget>[
          ChoiceChip(
            selected: mode == MapPickMode.departure,
            label: const Text('출발지 선택'),
            onSelected: (_) => onModeChanged(MapPickMode.departure),
          ),
          ChoiceChip(
            selected: mode == MapPickMode.destination,
            label: const Text('도착지 선택'),
            onSelected: (_) => onModeChanged(MapPickMode.destination),
          ),
          ChoiceChip(
            selected: mode == MapPickMode.spot,
            label: const Text('관광지 선택'),
            onSelected: (_) => onModeChanged(MapPickMode.spot),
          ),
        ],
      ),
    );
  }
}

class _MapSelectionActionBar extends StatelessWidget {
  const _MapSelectionActionBar({
    required this.mode,
    required this.pendingSelection,
    required this.onConfirm,
    required this.onClear,
  });

  final MapPickMode mode;
  final LatLng? pendingSelection;
  final VoidCallback onConfirm;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    if (pendingSelection == null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.95),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          mode == MapPickMode.spot
              ? '지도를 이동하며 위치를 확인하고, 관광지는 주요 관광지 목록에서 선택하세요.'
              : '지도를 이동한 뒤 원하는 위치를 탭하고 "이 위치 선택"을 눌러 확정하세요.',
          style: const TextStyle(fontSize: 12, color: Color(0xFF334155)),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.96),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              '선택 대기: ${pendingSelection!.latitude.toStringAsFixed(5)}, ${pendingSelection!.longitude.toStringAsFixed(5)}',
              style: const TextStyle(fontSize: 12),
            ),
          ),
          TextButton(onPressed: onClear, child: const Text('취소')),
          const SizedBox(width: 6),
          ElevatedButton(
            onPressed: mode == MapPickMode.spot ? null : onConfirm,
            child: const Text('이 위치 선택'),
          ),
        ],
      ),
    );
  }
}
