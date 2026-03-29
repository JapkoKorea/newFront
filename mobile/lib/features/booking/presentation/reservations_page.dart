import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/reservation_api.dart';
import '../domain/reservation_item.dart';

class ReservationsPage extends ConsumerStatefulWidget {
  const ReservationsPage({super.key});

  @override
  ConsumerState<ReservationsPage> createState() => _ReservationsPageState();
}

class _ReservationsPageState extends ConsumerState<ReservationsPage> {
  bool _isLoading = true;
  String? _error;
  List<ReservationItem> _items = <ReservationItem>[];
  String? _selectedReservationNumber;
  bool _isCancelling = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final List<ReservationItem> items =
          await ref.read(reservationApiProvider).listReservations();
      if (!mounted) {
        return;
      }
      setState(() {
        _items = items;
        _isLoading = false;
        _selectedReservationNumber = items.isEmpty
            ? null
            : (_selectedReservationNumber ?? items.first.reservationNumber);
      });
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _isLoading = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final ReservationItem? selected = _items
        .where((ReservationItem item) {
          return item.reservationNumber == _selectedReservationNumber;
        })
        .cast<ReservationItem?>()
        .firstOrNull;

    return Scaffold(
      appBar: AppBar(
        title: const Text('예약 조회'),
        actions: <Widget>[
          IconButton(
            onPressed: _load,
            tooltip: '새로고침',
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorView(message: _error!, onRetry: _load)
              : _items.isEmpty
                  ? const _EmptyView()
                  : LayoutBuilder(
                      builder:
                          (BuildContext context, BoxConstraints constraints) {
                        final bool isNarrow = constraints.maxWidth < 900;

                        if (isNarrow) {
                          return _MobileReservationContent(
                            items: _items,
                            selectedReservationNumber:
                                _selectedReservationNumber,
                            selected: selected,
                            isCancelling: _isCancelling,
                            onSelect: (String reservationNumber) {
                              setState(() {
                                _selectedReservationNumber = reservationNumber;
                              });
                            },
                            onCancelSelected: selected == null
                                ? null
                                : () => _cancelReservation(selected),
                            onPaySelected: selected == null
                                ? null
                                : () => context.push(
                                      '/payment/review?reservation_number=${selected.reservationNumber}',
                                    ),
                          );
                        }

                        return Row(
                          children: <Widget>[
                            SizedBox(
                              width: 280,
                              child: _ReservationList(
                                items: _items,
                                selectedReservationNumber:
                                    _selectedReservationNumber,
                                onSelect: (String reservationNumber) {
                                  setState(() {
                                    _selectedReservationNumber =
                                        reservationNumber;
                                  });
                                },
                              ),
                            ),
                            const VerticalDivider(width: 1),
                            Expanded(
                              child: selected == null
                                  ? const Center(child: Text('예약을 선택해 주세요'))
                                  : _ReservationDetail(
                                      item: selected,
                                      isCancelling: _isCancelling,
                                      onCancel: () =>
                                          _cancelReservation(selected),
                                      onPay: () => context.push(
                                        '/payment/review?reservation_number=${selected.reservationNumber}',
                                      ),
                                    ),
                            ),
                          ],
                        );
                      },
                    ),
    );
  }

  Future<void> _cancelReservation(ReservationItem item) async {
    if (_isCancelling) {
      return;
    }

    final bool canCancel =
        !<String>{'cancelled', 'completed', 'rejected'}.contains(item.status);
    if (!canCancel) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('현재 상태에서는 취소할 수 없습니다.')),
      );
      return;
    }

    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('예약 취소'),
        content: const Text('취소 요청을 진행할까요?'),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('아니요'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('네, 취소합니다'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() => _isCancelling = true);
    try {
      await ref
          .read(reservationApiProvider)
          .cancelReservation(item.reservationNumber);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('취소 요청이 접수되었습니다.')),
      );
      await _load();
    } catch (e) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('취소 실패: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => _isCancelling = false);
      }
    }
  }
}

class _ReservationList extends StatelessWidget {
  const _ReservationList({
    required this.items,
    required this.selectedReservationNumber,
    required this.onSelect,
  });

  final List<ReservationItem> items;
  final String? selectedReservationNumber;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      itemCount: items.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final ReservationItem item = items[index];
        final bool selectedItem =
            item.reservationNumber == selectedReservationNumber;

        return ListTile(
          selected: selectedItem,
          title: Text(item.reservationNumber),
          subtitle: Text('${item.tourDate} ${item.tourStartTime}'),
          trailing: _StatusBadge(label: item.status),
          onTap: () => onSelect(item.reservationNumber),
        );
      },
    );
  }
}

class _MobileReservationContent extends StatelessWidget {
  const _MobileReservationContent({
    required this.items,
    required this.selectedReservationNumber,
    required this.selected,
    required this.isCancelling,
    required this.onSelect,
    required this.onCancelSelected,
    required this.onPaySelected,
  });

  final List<ReservationItem> items;
  final String? selectedReservationNumber;
  final ReservationItem? selected;
  final bool isCancelling;
  final ValueChanged<String> onSelect;
  final VoidCallback? onCancelSelected;
  final VoidCallback? onPaySelected;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: <Widget>[
        const Text(
          '예약 목록',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        ...items.map((ReservationItem item) {
          final bool isSelected =
              item.reservationNumber == selectedReservationNumber;
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              selected: isSelected,
              title: Text(item.reservationNumber),
              subtitle: Text('${item.tourDate} ${item.tourStartTime}'),
              trailing: _StatusBadge(label: item.status),
              onTap: () => onSelect(item.reservationNumber),
            ),
          );
        }),
        const SizedBox(height: 12),
        const Divider(height: 1),
        const SizedBox(height: 12),
        if (selected == null)
          const Text(
            '아래에서 확인할 예약을 선택해 주세요.',
            style: TextStyle(color: Color(0xFF64748B)),
          )
        else
          _ReservationDetail(
            item: selected!,
            isCancelling: isCancelling,
            onCancel: onCancelSelected ?? () {},
            onPay: onPaySelected ?? () {},
            compact: true,
          ),
      ],
    );
  }
}

class _ReservationDetail extends StatelessWidget {
  const _ReservationDetail({
    required this.item,
    required this.isCancelling,
    required this.onCancel,
    required this.onPay,
    this.compact = false,
  });

  final ReservationItem item;
  final bool isCancelling;
  final VoidCallback onCancel;
  final VoidCallback onPay;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.all(compact ? 0 : 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: compact ? MainAxisSize.min : MainAxisSize.max,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  item.reservationNumber,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w700),
                ),
              ),
              _StatusBadge(label: item.status),
              const SizedBox(width: 8),
              _PaymentBadge(label: item.paymentStatus),
            ],
          ),
          const SizedBox(height: 16),
          _DetailRow(label: '예약자', value: item.englishName),
          _DetailRow(label: '연락처', value: item.contactNumber),
          _DetailRow(label: '날짜', value: item.tourDate),
          _DetailRow(label: '시간', value: item.tourStartTime),
          _DetailRow(label: '출발지', value: item.departure),
          _DetailRow(label: '도착지', value: item.destination),
          _DetailRow(label: '인원', value: '${item.numberOfPeople}'),
          _DetailRow(label: '코스', value: item.desiredCourse),
          const SizedBox(height: 4),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFCD34D)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const Text(
                  '요금/예약 정책 안내',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                const Text('• 예약금 15,000원 선결제'),
                const Text('• 최소 이용시간 2시간'),
                const Text('• 5인 이상 점보택시 필수'),
                const SizedBox(height: 6),
                Text(
                  _paymentGuideText(item),
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          if (!compact) const Spacer(),
          if (compact) const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: isCancelling ? null : onCancel,
              child: Text(isCancelling ? '취소 처리 중...' : '예약 취소 요청'),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _canPay(item) ? onPay : null,
              child: const Text('결제하러 가기'),
            ),
          ),
        ],
      ),
    );
  }

  bool _canPay(ReservationItem value) {
    return value.paymentStatus != 'paid' &&
        !<String>{'cancelled', 'rejected'}.contains(value.status);
  }

  String _paymentGuideText(ReservationItem value) {
    if (value.paymentStatus == 'paid') {
      return '이미 결제가 완료된 예약입니다.';
    }
    if (<String>{'cancelled', 'rejected'}.contains(value.status)) {
      return '취소/거절된 예약은 결제를 진행할 수 없습니다.';
    }
    return '결제가 완료되면 예약 상태 반영까지 잠시 시간이 걸릴 수 있습니다.';
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 96,
            child:
                Text(label, style: const TextStyle(color: Color(0xFF64748B))),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final Color color = switch (label) {
      'pending' => const Color(0xFF0EA5E9),
      'cancelled' => const Color(0xFF64748B),
      'completed' => const Color(0xFF16A34A),
      'rejected' => const Color(0xFFDC2626),
      _ => const Color(0xFF334155),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        _statusLabelKo(label),
        style: TextStyle(color: color, fontWeight: FontWeight.w700),
      ),
    );
  }

  String _statusLabelKo(String raw) {
    return switch (raw) {
      'pending' => '대기',
      'cancelled' => '취소',
      'completed' => '완료',
      'rejected' => '거절',
      _ => raw,
    };
  }
}

class _PaymentBadge extends StatelessWidget {
  const _PaymentBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final Color color = switch (label) {
      'paid' => const Color(0xFF16A34A),
      'ready' => const Color(0xFF0EA5E9),
      'failed' => const Color(0xFFDC2626),
      _ => const Color(0xFF64748B),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        _paymentLabelKo(label),
        style: TextStyle(color: color, fontWeight: FontWeight.w700),
      ),
    );
  }

  String _paymentLabelKo(String raw) {
    return switch (raw) {
      'paid' => '결제완료',
      'ready' => '결제대기',
      'failed' => '결제실패',
      _ => raw,
    };
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: onRetry, child: const Text('다시 시도')),
          ],
        ),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text(
        '예약 내역이 없습니다.',
        style: TextStyle(color: Color(0xFF64748B)),
      ),
    );
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
