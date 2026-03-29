import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:go_router/go_router.dart';

import '../../auth/application/auth_controller.dart';
import '../application/booking_coordinator.dart';
import '../data/booking_draft_store.dart';
import '../data/reservation_api.dart';
import '../domain/booking_draft.dart';
import '../domain/spot_point.dart';
import '../domain/booking_step.dart';
import 'widgets/map_picker_card.dart';

const double _allowedNorth = 43.85;
const double _allowedSouth = 43.35;
const double _allowedWest = 142.2;
const double _allowedEast = 142.7;
const int _baseDepositKrw = 15000;
const int _minimumHours = 2;
const int _standardRateJpy = 7350;
const int _jumboRateJpy = 10500;

const Map<String, LatLng> _spotCatalog = <String, LatLng>{
  '크리스마스트리의 나무': LatLng(43.5928, 142.4672),
  '세븐스타의 나무': LatLng(43.5902, 142.4551),
  '켄과 메리의 나무': LatLng(43.5743, 142.4526),
  '사계채언덕': LatLng(43.5868, 142.4578),
  '청의 호수': LatLng(43.4936, 142.6147),
  '흰수염폭포': LatLng(43.4922, 142.6353),
  '닝구르테라스': LatLng(43.3403, 142.3847),
};

const Map<String, LatLng> _stationCatalog = <String, LatLng>{
  '아사히카와역': LatLng(43.7637, 142.3578),
  '비에이역': LatLng(43.5888, 142.4649),
  '후라노역': LatLng(43.3418, 142.3832),
  '아사히카와 공항': LatLng(43.6711, 142.4475),
};

const LatLng _fallbackPoint = LatLng(43.5900, 142.4600);

final Map<String, LatLng> _locationCatalog = <String, LatLng>{
  ..._stationCatalog,
  ..._spotCatalog,
};

class BookingShellPage extends ConsumerStatefulWidget {
  const BookingShellPage({super.key});

  @override
  ConsumerState<BookingShellPage> createState() => _BookingShellPageState();
}

class _BookingShellPageState extends ConsumerState<BookingShellPage> {
  final BookingDraftStore _draftStore = BookingDraftStore();

  MapPickMode _mapPickMode = MapPickMode.departure;
  LatLng? _departurePoint;
  LatLng? _destinationPoint;
  LatLng? _pendingMapPoint;
  List<SpotPoint> _selectedSpots = <SpotPoint>[];
  bool _isSubmitting = false;

  late final TextEditingController _departureController;
  late final TextEditingController _destinationController;
  late final TextEditingController _dateController;
  late final TextEditingController _timeController;
  late final TextEditingController _passengersController;
  late final TextEditingController _durationController;
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;

  @override
  void initState() {
    super.initState();

    final BookingState state = ref.read(bookingCoordinatorProvider);

    _departureController = TextEditingController(text: state.draft.departure);
    _destinationController =
        TextEditingController(text: state.draft.destination);
    _dateController = TextEditingController(text: state.draft.date);
    _timeController = TextEditingController(text: state.draft.time);
    _passengersController =
        TextEditingController(text: state.draft.passengers.toString());
    _durationController =
        TextEditingController(text: state.draft.durationHours.toString());
    _nameController = TextEditingController(text: state.draft.name);
    _phoneController = TextEditingController(text: state.draft.phone);

    _selectedSpots = state.draft.selectedSpots
        .map((String label) => SpotPoint(
              label: label,
              position: _locationCatalog[label] ?? _fallbackPoint,
            ))
        .toList();

    _restoreDraft();
  }

  @override
  void dispose() {
    _departureController.dispose();
    _destinationController.dispose();
    _dateController.dispose();
    _timeController.dispose();
    _passengersController.dispose();
    _durationController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final BookingState state = ref.watch(bookingCoordinatorProvider);
    final BookingCoordinator coordinator =
        ref.read(bookingCoordinatorProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('택시투어 예약'),
        actions: <Widget>[
          IconButton(
            tooltip: '예약 내역',
            onPressed: () => context.push('/reservations'),
            icon: const Icon(Icons.receipt_long),
          ),
          IconButton(
            tooltip: '로그아웃',
            onPressed: () async {
              await ref.read(authControllerProvider.notifier).logout();
              if (!context.mounted) {
                return;
              }
              context.go('/login');
            },
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: Stack(
        children: <Widget>[
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Expanded(
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          _StepProgress(step: state.step),
                          const SizedBox(height: 12),
                          Text(
                            '${state.step.index}단계. ${state.step.title}',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          _StepForm(
                            state: state,
                            mapPickMode: _mapPickMode,
                            departurePoint: _departurePoint,
                            destinationPoint: _destinationPoint,
                            pendingMapPoint: _pendingMapPoint,
                            selectedSpots: _selectedSpots,
                            onMapPickModeChanged: (MapPickMode nextMode) {
                              setState(() {
                                _mapPickMode = nextMode;
                                _pendingMapPoint = null;
                              });
                            },
                            onMapTapped: (LatLng position) {
                              if (!_isWithinAllowedRegion(position)) {
                                _showMessage('비에이·아사히카와 지역만 선택 가능합니다');
                                return;
                              }
                              setState(() {
                                _pendingMapPoint = position;
                              });
                              _showMessage(
                                  '지도를 이동해 위치를 확인한 뒤 "이 위치 선택"으로 확정해 주세요');
                            },
                            onSpotTap: (int index) {
                              if (index < 0 || index >= _selectedSpots.length) {
                                return;
                              }
                              _showMessage(
                                  '${_selectedSpots[index].label} 선택됨 (삭제는 목록의 삭제 버튼 사용)');
                            },
                            onSpotDelete: (int index) {
                              if (index < 0 || index >= _selectedSpots.length) {
                                return;
                              }
                              setState(() {
                                _selectedSpots = <SpotPoint>[
                                  ..._selectedSpots.sublist(0, index),
                                  ..._selectedSpots.sublist(index + 1),
                                ];
                              });
                              _syncRouteStepState(coordinator);
                            },
                            onConfirmMapSelection: () {
                              final LatLng? pending = _pendingMapPoint;
                              if (pending == null) {
                                return;
                              }

                              if (_mapPickMode == MapPickMode.spot) {
                                _showMessage('관광지는 아래 주요 관광지에서 선택해 주세요');
                                return;
                              }

                              final String label =
                                  _resolveNearestLocationLabel(pending);
                              setState(() {
                                if (_mapPickMode == MapPickMode.departure) {
                                  _departurePoint = pending;
                                  _departureController.text = label;
                                } else {
                                  _destinationPoint = pending;
                                  _destinationController.text = label;
                                }
                                _pendingMapPoint = null;
                              });
                              _syncRouteStepState(coordinator);
                            },
                            onClearPendingMapSelection: () {
                              setState(() {
                                _pendingMapPoint = null;
                              });
                            },
                            onPlaceSelected: (String label, LatLng point) {
                              if (_mapPickMode == MapPickMode.departure) {
                                setState(() {
                                  _departureController.text = label;
                                  _departurePoint = point;
                                  _pendingMapPoint = null;
                                });
                                _syncRouteStepState(coordinator);
                                return;
                              }
                              if (_mapPickMode == MapPickMode.destination) {
                                setState(() {
                                  _destinationController.text = label;
                                  _destinationPoint = point;
                                  _pendingMapPoint = null;
                                });
                                _syncRouteStepState(coordinator);
                                return;
                              }
                              if (_selectedSpots
                                  .any((SpotPoint e) => e.label == label)) {
                                _showMessage('이미 추가된 관광지입니다');
                                return;
                              }
                              setState(() {
                                _selectedSpots = <SpotPoint>[
                                  ..._selectedSpots,
                                  SpotPoint(label: label, position: point),
                                ];
                              });
                              _syncRouteStepState(coordinator);
                            },
                            departureController: _departureController,
                            destinationController: _destinationController,
                            dateController: _dateController,
                            timeController: _timeController,
                            passengersController: _passengersController,
                            durationController: _durationController,
                            nameController: _nameController,
                            phoneController: _phoneController,
                            onRouteChanged: () {
                              _syncRouteStepState(coordinator);
                            },
                            onContactChanged: () {
                              final String normalizedPhone = _normalizePhone(
                                _phoneController.text,
                              );
                              if (_phoneController.text != normalizedPhone) {
                                _phoneController.text = normalizedPhone;
                                _phoneController.selection =
                                    TextSelection.fromPosition(
                                  TextPosition(offset: normalizedPhone.length),
                                );
                              }
                              coordinator.updateContact(
                                name: _nameController.text,
                                phone: normalizedPhone,
                              );
                              _persistDraftState();
                            },
                            onAgreementChanged: (bool value) {
                              coordinator.setAgreement(value);
                              _persistDraftState();
                            },
                            onPickDate: _pickDate,
                            onPickTime: _pickTime,
                          ),
                          if (state.errorMessage != null) ...<Widget>[
                            const SizedBox(height: 12),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFF7ED),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                state.errorMessage!,
                                style:
                                    const TextStyle(color: Color(0xFF9A3412)),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: OutlinedButton(
                          onPressed: state.step == BookingStep.routeAndSchedule
                              ? null
                              : coordinator.goBack,
                          child: const Text('이전'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _isSubmitting
                              ? null
                              : () {
                                  final bool canProceed = coordinator.goNext();
                                  if (!canProceed) {
                                    return;
                                  }

                                  if (state.step ==
                                      BookingStep.pricingAgreement) {
                                    _submitReservationAndRoute();
                                  }
                                },
                          child: Text(
                            _isSubmitting
                                ? '예약 접수 중...'
                                : (state.step == BookingStep.pricingAgreement
                                    ? '결제로 이동'
                                    : '다음'),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatLatLng(LatLng value) {
    return '${value.latitude.toStringAsFixed(5)}, ${value.longitude.toStringAsFixed(5)}';
  }

  String _resolveNearestLocationLabel(LatLng point) {
    String? nearestLabel;
    double nearestDistance = double.infinity;

    for (final MapEntry<String, LatLng> entry in _locationCatalog.entries) {
      final double dx = entry.value.latitude - point.latitude;
      final double dy = entry.value.longitude - point.longitude;
      final double distance = (dx * dx) + (dy * dy);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestLabel = entry.key;
      }
    }

    if (nearestLabel == null) {
      return _formatLatLng(point);
    }

    if (nearestDistance <= 0.0009) {
      return nearestLabel;
    }

    return _formatLatLng(point);
  }

  bool _isWithinAllowedRegion(LatLng point) {
    return point.latitude >= _allowedSouth &&
        point.latitude <= _allowedNorth &&
        point.longitude >= _allowedWest &&
        point.longitude <= _allowedEast;
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  void _syncRouteStepState(BookingCoordinator coordinator) {
    coordinator.updateRouteAndSchedule(
      departure: _departureController.text,
      destination: _destinationController.text,
      date: _dateController.text,
      time: _timeController.text,
      passengers: int.tryParse(_passengersController.text.trim()) ?? 0,
      durationHours: int.tryParse(_durationController.text.trim()) ?? 0,
      selectedSpots:
          _selectedSpots.map((SpotPoint spot) => spot.label).toList(),
    );
    _persistDraftState();
  }

  Future<void> _persistDraftState() async {
    final BookingState state = ref.read(bookingCoordinatorProvider);
    await _draftStore.save(state.draft);
  }

  Future<void> _restoreDraft() async {
    final BookingDraft? saved = await _draftStore.load();
    if (saved == null || !mounted) {
      return;
    }

    final BookingCoordinator coordinator =
        ref.read(bookingCoordinatorProvider.notifier);

    _departureController.text = saved.departure;
    _destinationController.text = saved.destination;
    _dateController.text = saved.date;
    _timeController.text = saved.time;
    _passengersController.text = saved.passengers.toString();
    _durationController.text = saved.durationHours.toString();
    _nameController.text = saved.name;
    _phoneController.text = saved.phone;

    setState(() {
      _selectedSpots = saved.selectedSpots
          .map((String label) => SpotPoint(
                label: label,
                position: _locationCatalog[label] ?? _fallbackPoint,
              ))
          .toList();

      _departurePoint = _locationCatalog[saved.departure] ?? _departurePoint;
      _destinationPoint =
          _locationCatalog[saved.destination] ?? _destinationPoint;
    });

    coordinator.updateRouteAndSchedule(
      departure: saved.departure,
      destination: saved.destination,
      date: saved.date,
      time: saved.time,
      passengers: saved.passengers,
      durationHours: saved.durationHours,
      selectedSpots:
          _selectedSpots.map((SpotPoint spot) => spot.label).toList(),
    );
    coordinator.updateContact(name: saved.name, phone: saved.phone);
    coordinator.setAgreement(saved.depositAgreement);
  }

  Future<void> _pickDate() async {
    final DateTime now = DateTime.now();
    final DateTime firstDate = DateTime(now.year, now.month, now.day);
    final DateTime initial =
        DateTime.tryParse(_dateController.text) ?? firstDate;

    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initial.isBefore(firstDate) ? firstDate : initial,
      firstDate: firstDate,
      lastDate: DateTime(now.year + 2, 12, 31),
    );
    if (picked == null || !mounted) {
      return;
    }

    _dateController.text = _formatDate(picked);
    _syncRouteStepState(ref.read(bookingCoordinatorProvider.notifier));
  }

  Future<void> _pickTime() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _parseTime(_timeController.text) ?? TimeOfDay.now(),
    );
    if (picked == null || !mounted) {
      return;
    }

    _timeController.text =
        '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    _syncRouteStepState(ref.read(bookingCoordinatorProvider.notifier));
  }

  TimeOfDay? _parseTime(String raw) {
    final List<String> parts = raw.split(':');
    if (parts.length != 2) {
      return null;
    }
    final int? hour = int.tryParse(parts[0]);
    final int? minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) {
      return null;
    }
    return TimeOfDay(hour: hour.clamp(0, 23), minute: minute.clamp(0, 59));
  }

  String _formatDate(DateTime value) {
    return '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
  }

  String _normalizePhone(String input) {
    final String digits = input.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.length <= 3) {
      return digits;
    }
    if (digits.length <= 7) {
      return '${digits.substring(0, 3)}-${digits.substring(3)}';
    }
    if (digits.length <= 11) {
      return '${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7)}';
    }
    return '${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7, 11)}';
  }

  Future<void> _submitReservationAndRoute() async {
    final BookingCoordinator coordinator =
        ref.read(bookingCoordinatorProvider.notifier);
    final ReservationApi reservationApi = ref.read(reservationApiProvider);

    setState(() => _isSubmitting = true);

    coordinator.updateRouteAndSchedule(
      departure: _departureController.text,
      destination: _destinationController.text,
      date: _dateController.text,
      time: _timeController.text,
      passengers: int.tryParse(_passengersController.text.trim()) ?? 0,
      durationHours: int.tryParse(_durationController.text.trim()) ?? 0,
      selectedSpots:
          _selectedSpots.map((SpotPoint spot) => spot.label).toList(),
    );
    coordinator.updateContact(
      name: _nameController.text,
      phone: _phoneController.text,
    );

    final BookingState syncedState = ref.read(bookingCoordinatorProvider);

    try {
      final String reservationNumber =
          await reservationApi.createReservation(syncedState.draft);
      await _draftStore.clear();

      if (!mounted) {
        return;
      }

      context.push('/payment/review?reservation_number=$reservationNumber');
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('예약 접수에 실패했습니다: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }
}

class _StepProgress extends StatelessWidget {
  const _StepProgress({required this.step});

  final BookingStep step;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: BookingStep.values.map((BookingStep item) {
        final bool active = item.index <= step.index;

        return Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 3),
            height: 6,
            decoration: BoxDecoration(
              color: active ? const Color(0xFFF59E0B) : const Color(0xFFE2E8F0),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _StepForm extends StatelessWidget {
  const _StepForm({
    required this.state,
    required this.mapPickMode,
    required this.departurePoint,
    required this.destinationPoint,
    required this.pendingMapPoint,
    required this.selectedSpots,
    required this.onMapPickModeChanged,
    required this.onMapTapped,
    required this.onSpotTap,
    required this.onSpotDelete,
    required this.onConfirmMapSelection,
    required this.onClearPendingMapSelection,
    required this.onPlaceSelected,
    required this.departureController,
    required this.destinationController,
    required this.dateController,
    required this.timeController,
    required this.passengersController,
    required this.durationController,
    required this.nameController,
    required this.phoneController,
    required this.onRouteChanged,
    required this.onContactChanged,
    required this.onAgreementChanged,
    required this.onPickDate,
    required this.onPickTime,
  });

  final BookingState state;
  final MapPickMode mapPickMode;
  final LatLng? departurePoint;
  final LatLng? destinationPoint;
  final LatLng? pendingMapPoint;
  final List<SpotPoint> selectedSpots;
  final ValueChanged<MapPickMode> onMapPickModeChanged;
  final ValueChanged<LatLng> onMapTapped;
  final ValueChanged<int> onSpotTap;
  final ValueChanged<int> onSpotDelete;
  final VoidCallback onConfirmMapSelection;
  final VoidCallback onClearPendingMapSelection;
  final void Function(String label, LatLng point) onPlaceSelected;
  final TextEditingController departureController;
  final TextEditingController destinationController;
  final TextEditingController dateController;
  final TextEditingController timeController;
  final TextEditingController passengersController;
  final TextEditingController durationController;
  final TextEditingController nameController;
  final TextEditingController phoneController;
  final VoidCallback onRouteChanged;
  final VoidCallback onContactChanged;
  final ValueChanged<bool> onAgreementChanged;
  final VoidCallback onPickDate;
  final VoidCallback onPickTime;

  @override
  Widget build(BuildContext context) {
    switch (state.step) {
      case BookingStep.routeAndSchedule:
        return Column(
          children: <Widget>[
            MapPickerCard(
              mode: mapPickMode,
              onModeChanged: onMapPickModeChanged,
              departure: departurePoint,
              destination: destinationPoint,
              pendingSelection: pendingMapPoint,
              spots: selectedSpots,
              locationCatalog: _locationCatalog,
              selectedSpotLabels:
                  selectedSpots.map((SpotPoint e) => e.label).toSet(),
              availableSpotCatalog: _spotCatalog,
              onMapTapped: onMapTapped,
              onSpotTap: onSpotTap,
              onConfirmMapSelection: onConfirmMapSelection,
              onClearPendingSelection: onClearPendingMapSelection,
              onPlaceSelected: onPlaceSelected,
            ),
            const SizedBox(height: 8),
            _RouteStatusPanel(
              departure: departureController.text,
              destination: destinationController.text,
              spotsCount: selectedSpots.length,
            ),
            const SizedBox(height: 8),
            if (selectedSpots.isNotEmpty) ...<Widget>[
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  '선택한 관광지',
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(height: 6),
              Align(
                alignment: Alignment.centerLeft,
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: selectedSpots.asMap().entries.map((entry) {
                    final int idx = entry.key;
                    final SpotPoint spot = entry.value;
                    return Chip(
                      label: Text('${idx + 1}. ${spot.label}'),
                      onDeleted: () => onSpotDelete(idx),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 8),
            ],
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '주요 관광지',
                style: Theme.of(context)
                    .textTheme
                    .titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFE2E8F0)),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                children:
                    _spotCatalog.entries.map((MapEntry<String, LatLng> e) {
                  final int selectedIndex = selectedSpots
                      .indexWhere((SpotPoint s) => s.label == e.key);
                  final bool selected = selectedIndex >= 0;

                  return ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(e.key),
                    trailing: selected
                        ? TextButton(
                            onPressed: () => onSpotDelete(selectedIndex),
                            child: const Text('삭제'),
                          )
                        : TextButton(
                            onPressed: () => onPlaceSelected(e.key, e.value),
                            child: const Text('추가'),
                          ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 8),
            _SectionFieldCard(
              title: '출발지',
              child: _InputField(
                label: '출발지',
                hint: '예: 비에이역',
                controller: departureController,
                onChanged: (_) => onRouteChanged(),
              ),
            ),
            const SizedBox(height: 8),
            _SectionFieldCard(
              title: '도착지',
              child: _InputField(
                label: '도착지',
                hint: '예: 아사히카와 공항',
                controller: destinationController,
                onChanged: (_) => onRouteChanged(),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: <Widget>[
                Expanded(
                  child: _InputField(
                    label: '날짜',
                    hint: 'YYYY-MM-DD',
                    controller: dateController,
                    readOnly: true,
                    onTap: onPickDate,
                    onChanged: (_) => onRouteChanged(),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _InputField(
                    label: '시간',
                    hint: 'HH:MM',
                    controller: timeController,
                    readOnly: true,
                    onTap: onPickTime,
                    onChanged: (_) => onRouteChanged(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            _InputField(
              label: '인원수',
              hint: '1',
              keyboardType: TextInputType.number,
              controller: passengersController,
              onChanged: (_) => onRouteChanged(),
            ),
            const SizedBox(height: 8),
            _InputField(
              label: '이용 시간(시간)',
              hint: '4',
              keyboardType: TextInputType.number,
              controller: durationController,
              onChanged: (_) => onRouteChanged(),
            ),
          ],
        );
      case BookingStep.contact:
        return Column(
          children: <Widget>[
            _InputField(
              label: '예약자 이름',
              hint: '이름 입력',
              controller: nameController,
              onChanged: (_) => onContactChanged(),
            ),
            const SizedBox(height: 8),
            _InputField(
              label: '연락처',
              hint: '010-0000-0000',
              controller: phoneController,
              onChanged: (_) => onContactChanged(),
            ),
          ],
        );
      case BookingStep.pricingAgreement:
        final int normalizedHours = state.draft.durationHours <= 0
            ? _minimumHours
            : state.draft.durationHours < _minimumHours
                ? _minimumHours
                : state.draft.durationHours;
        final bool isJumbo = state.draft.passengers >= 5;
        final int hourlyRate = isJumbo ? _jumboRateJpy : _standardRateJpy;
        final int estimatedFareJpy = hourlyRate * normalizedHours;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text(
              '예상 요금 안내',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text('예상 택시비: ${estimatedFareJpy.toString()}엔'),
                  const SizedBox(height: 4),
                  Text(
                    '예약금(선결제): ${_baseDepositKrw.toString()}원',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFCD34D)),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    '이용 규칙 안내',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  SizedBox(height: 6),
                  Text('• 기본 예약금 15,000원 선결제'),
                  Text('• 최소 이용시간 2시간'),
                  Text('• 5인 이상은 점보택시 필수'),
                  SizedBox(height: 6),
                  Text(
                    '※ 현장 결제 금액은 이용 조건(차량/시간/추가 요청)에 따라 달라질 수 있습니다.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            CheckboxListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              value: state.draft.depositAgreement,
              onChanged: (bool? value) => onAgreementChanged(value ?? false),
              title: const Text('예약금 및 취소 정책에 동의합니다.'),
            ),
          ],
        );
    }
  }
}

class _RouteStatusPanel extends StatelessWidget {
  const _RouteStatusPanel({
    required this.departure,
    required this.destination,
    required this.spotsCount,
  });

  final String departure;
  final String destination;
  final int spotsCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: <Widget>[
          _StatusPill(
              label: '출발', value: departure.isEmpty ? '미선택' : departure),
          _StatusPill(
              label: '도착', value: destination.isEmpty ? '미선택' : destination),
          _StatusPill(label: '관광지', value: '$spotsCount곳 선택'),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Text(
        '$label: $value',
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _SectionFieldCard extends StatelessWidget {
  const _SectionFieldCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          child,
        ],
      ),
    );
  }
}

class _InputField extends StatelessWidget {
  const _InputField({
    required this.label,
    required this.hint,
    required this.controller,
    required this.onChanged,
    this.keyboardType,
    this.readOnly = false,
    this.onTap,
  });

  final String label;
  final String hint;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final TextInputType? keyboardType;
  final bool readOnly;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      readOnly: readOnly,
      onTap: onTap,
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
      ),
    );
  }
}
