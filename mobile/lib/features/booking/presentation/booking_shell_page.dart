import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/application/auth_controller.dart';
import '../application/booking_coordinator.dart';
import '../data/booking_draft_store.dart';
import '../data/reservation_api.dart';
import '../domain/booking_draft.dart';
import '../domain/booking_step.dart';

const int _baseDepositKrw = 15000;
const int _minimumHours = 2;
const int _standardRateJpy = 7350;
const int _jumboRateJpy = 10500;

// 경로(출발/도착/관광지)는 코스 상세의 지도 빌더에서 확정해 전달된다.
// 이 화면은 일정·인원·연락처·동의만 받는다(중복 지도 제거).
class BookingShellPage extends ConsumerStatefulWidget {
  const BookingShellPage({super.key});

  @override
  ConsumerState<BookingShellPage> createState() => _BookingShellPageState();
}

class _BookingShellPageState extends ConsumerState<BookingShellPage> {
  final BookingDraftStore _draftStore = BookingDraftStore();
  bool _isSubmitting = false;

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
    _dateController = TextEditingController(text: state.draft.date);
    _timeController = TextEditingController(text: state.draft.time);
    _passengersController =
        TextEditingController(text: state.draft.passengers.toString());
    _durationController =
        TextEditingController(text: state.draft.durationHours.toString());
    _nameController = TextEditingController(text: state.draft.name);
    _phoneController = TextEditingController(text: state.draft.phone);
    _restoreDraft();
  }

  @override
  void dispose() {
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
      body: SafeArea(
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
                      const SizedBox(height: 12),
                      _StepForm(
                        state: state,
                        dateController: _dateController,
                        timeController: _timeController,
                        passengersController: _passengersController,
                        durationController: _durationController,
                        nameController: _nameController,
                        phoneController: _phoneController,
                        onEditRoute: () {
                          // 경로 수정은 빌더(코스 상세)로 복귀
                          if (context.canPop()) {
                            context.pop();
                          }
                        },
                        onScheduleChanged: () => _syncScheduleState(coordinator),
                        onContactChanged: () {
                          final String normalizedPhone =
                              _normalizePhone(_phoneController.text);
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
                            style: const TextStyle(color: Color(0xFF9A3412)),
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
                              if (state.step == BookingStep.pricingAgreement) {
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
    );
  }

  void _syncScheduleState(BookingCoordinator coordinator) {
    final BookingDraft draft = ref.read(bookingCoordinatorProvider).draft;
    coordinator.updateRouteAndSchedule(
      departure: draft.departure,
      destination: draft.destination,
      date: _dateController.text,
      time: _timeController.text,
      passengers: int.tryParse(_passengersController.text.trim()) ?? 0,
      durationHours: int.tryParse(_durationController.text.trim()) ?? 0,
      selectedSpots: draft.selectedSpots,
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
    // 현재 세션 draft가 비어 있을 때만 저장본으로 채운다(빌더 프리필 우선).
    final BookingCoordinator coordinator =
        ref.read(bookingCoordinatorProvider.notifier);
    final BookingDraft current = ref.read(bookingCoordinatorProvider).draft;

    _dateController.text =
        _dateController.text.isEmpty ? saved.date : _dateController.text;
    _timeController.text =
        _timeController.text.isEmpty ? saved.time : _timeController.text;
    if (_nameController.text.isEmpty) {
      _nameController.text = saved.name;
    }
    if (_phoneController.text.isEmpty) {
      _phoneController.text = saved.phone;
    }

    if (current.departure.isEmpty && current.destination.isEmpty) {
      coordinator.updateRouteAndSchedule(
        departure: saved.departure,
        destination: saved.destination,
        date: _dateController.text,
        time: _timeController.text,
        passengers: saved.passengers,
        durationHours: saved.durationHours,
        selectedSpots: saved.selectedSpots,
      );
      if (mounted) {
        setState(() {
          _passengersController.text = saved.passengers.toString();
          _durationController.text = saved.durationHours.toString();
        });
      }
    }
    coordinator.updateContact(name: _nameController.text, phone: _phoneController.text);
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
    _syncScheduleState(ref.read(bookingCoordinatorProvider.notifier));
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
    _syncScheduleState(ref.read(bookingCoordinatorProvider.notifier));
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

    final BookingDraft draft = ref.read(bookingCoordinatorProvider).draft;
    coordinator.updateRouteAndSchedule(
      departure: draft.departure,
      destination: draft.destination,
      date: _dateController.text,
      time: _timeController.text,
      passengers: int.tryParse(_passengersController.text.trim()) ?? 0,
      durationHours: int.tryParse(_durationController.text.trim()) ?? 0,
      selectedSpots: draft.selectedSpots,
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
    required this.dateController,
    required this.timeController,
    required this.passengersController,
    required this.durationController,
    required this.nameController,
    required this.phoneController,
    required this.onEditRoute,
    required this.onScheduleChanged,
    required this.onContactChanged,
    required this.onAgreementChanged,
    required this.onPickDate,
    required this.onPickTime,
  });

  final BookingState state;
  final TextEditingController dateController;
  final TextEditingController timeController;
  final TextEditingController passengersController;
  final TextEditingController durationController;
  final TextEditingController nameController;
  final TextEditingController phoneController;
  final VoidCallback onEditRoute;
  final VoidCallback onScheduleChanged;
  final VoidCallback onContactChanged;
  final ValueChanged<bool> onAgreementChanged;
  final VoidCallback onPickDate;
  final VoidCallback onPickTime;

  @override
  Widget build(BuildContext context) {
    switch (state.step) {
      case BookingStep.routeAndSchedule:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            _RouteSummaryCard(
              departure: state.draft.departure,
              destination: state.draft.destination,
              spots: state.draft.selectedSpots,
              onEdit: onEditRoute,
            ),
            const SizedBox(height: 12),
            Row(
              children: <Widget>[
                Expanded(
                  child: _InputField(
                    label: '날짜',
                    hint: 'YYYY-MM-DD',
                    controller: dateController,
                    readOnly: true,
                    onTap: onPickDate,
                    onChanged: (_) => onScheduleChanged(),
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
                    onChanged: (_) => onScheduleChanged(),
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
              onChanged: (_) => onScheduleChanged(),
            ),
            const SizedBox(height: 8),
            _InputField(
              label: '이용 시간(시간)',
              hint: '4',
              keyboardType: TextInputType.number,
              controller: durationController,
              onChanged: (_) => onScheduleChanged(),
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
                  Text('- 기본 예약금 15,000원 선결제'),
                  Text('- 최소 이용시간 2시간'),
                  Text('- 5인 이상은 점보택시 필수'),
                  SizedBox(height: 6),
                  Text(
                    '현장 결제 금액은 이용 조건(차량/시간/추가 요청)에 따라 달라질 수 있습니다.',
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

class _RouteSummaryCard extends StatelessWidget {
  const _RouteSummaryCard({
    required this.departure,
    required this.destination,
    required this.spots,
    required this.onEdit,
  });

  final String departure;
  final String destination;
  final List<String> spots;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final bool hasRoute = departure.isNotEmpty || destination.isNotEmpty;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              const Text(
                '선택한 경로',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              TextButton.icon(
                onPressed: onEdit,
                icon: const Icon(Icons.edit_location_alt, size: 16),
                label: const Text('경로 수정'),
              ),
            ],
          ),
          const SizedBox(height: 4),
          if (!hasRoute)
            const Text(
              '경로가 없습니다. "경로 수정"에서 출발지·도착지를 선택해 주세요.',
              style: TextStyle(color: Color(0xFF9A3412), fontSize: 13),
            )
          else ...<Widget>[
            Row(
              children: <Widget>[
                const Icon(Icons.radio_button_checked,
                    size: 16, color: Color(0xFF16A34A)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(departure.isEmpty ? '미선택' : departure,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: <Widget>[
                const Icon(Icons.place, size: 16, color: Color(0xFFDC2626)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(destination.isEmpty ? '미선택' : destination,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            if (spots.isNotEmpty) ...<Widget>[
              const SizedBox(height: 8),
              Text('관광지 ${spots.length}곳',
                  style: const TextStyle(
                      fontSize: 12, color: Color(0xFF64748B))),
              const SizedBox(height: 4),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: spots
                    .asMap()
                    .entries
                    .map((MapEntry<int, String> e) => Chip(
                          materialTapTargetSize:
                              MaterialTapTargetSize.shrinkWrap,
                          label: Text('${e.key + 1}. ${e.value}',
                              style: const TextStyle(fontSize: 12)),
                        ))
                    .toList(),
              ),
            ],
          ],
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
