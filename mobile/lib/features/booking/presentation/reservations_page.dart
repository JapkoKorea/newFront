import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../data/reservation_api.dart';
import '../domain/customer_stage.dart';
import '../domain/reservation_item.dart';

class ReservationsPage extends ConsumerStatefulWidget {
  const ReservationsPage({super.key});

  @override
  ConsumerState<ReservationsPage> createState() => _ReservationsPageState();
}

class _ReservationsPageState extends ConsumerState<ReservationsPage> {
  bool _isLoading = true;
  String? _error;
  bool _unauthorized = false;
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
      _unauthorized = false;
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
        if (e is ApiClientException && e.statusCode == 401) {
          _unauthorized = true;
        } else {
          _error = e.toString();
        }
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
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('예약 내역'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
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
          : _unauthorized
              ? const _LoginRequiredView()
              : _error != null
              ? _ErrorView(message: _error!, onRetry: _load)
              : _items.isEmpty
                  ? const _EmptyView()
                  : LayoutBuilder(
                      builder:
                          (BuildContext context, BoxConstraints constraints) {
                        final bool isNarrow = constraints.maxWidth < 900;

                        if (isNarrow) {
                          return _ReservationCardList(
                            items: _items,
                            onOpen: _openDetailSheet,
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

  void _openDetailSheet(ReservationItem item) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (BuildContext ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Container(
                    width: 44,
                    height: 5,
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  _ReservationDetail(
                    item: item,
                    isCancelling: false,
                    onCancel: () {
                      Navigator.of(ctx).pop();
                      _cancelReservation(item);
                    },
                    onPay: () {
                      Navigator.of(ctx).pop();
                      context.push(
                        '/payment/review?reservation_number=${item.reservationNumber}',
                      );
                    },
                    compact: true,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ReservationCardList extends StatelessWidget {
  const _ReservationCardList({required this.items, required this.onOpen});

  final List<ReservationItem> items;
  final ValueChanged<ReservationItem> onOpen;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (BuildContext context, int index) {
        final ReservationItem item = items[index];
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _ReservationCard(item: item, onTap: () => onOpen(item)),
        );
      },
    );
  }
}

class _ReservationCard extends StatelessWidget {
  const _ReservationCard({required this.item, required this.onTap});

  final ReservationItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  _StageBadge(item: item),
                  const SizedBox(width: 6),
                  const Spacer(),
                  const Icon(Icons.chevron_right, color: Color(0xFF94A3B8)),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: <Widget>[
                  const Icon(Icons.route, size: 16, color: Color(0xFF94A3B8)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${item.departure.isEmpty ? '-' : item.departure}  →  ${item.destination.isEmpty ? '-' : item.destination}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: <Widget>[
                  const Icon(Icons.event, size: 16, color: Color(0xFF94A3B8)),
                  const SizedBox(width: 6),
                  Text(
                    '${item.tourDate}  ${item.tourStartTime}',
                    style: const TextStyle(
                        fontSize: 13, color: Color(0xFF334155)),
                  ),
                  const Spacer(),
                  Text(
                    '${item.numberOfPeople}명',
                    style: const TextStyle(
                        fontSize: 13, color: Color(0xFF334155)),
                  ),
                ],
              ),
              if (item.desiredCourse.isNotEmpty) ...<Widget>[
                const SizedBox(height: 8),
                Text(
                  item.desiredCourse,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
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
          trailing: _StageBadge(item: item),
          onTap: () => onSelect(item.reservationNumber),
        );
      },
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
              _StageBadge(item: item),
              const SizedBox(width: 8),
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
                const Text('• 예약금 15,000원 선결제 (전일·당일 예약은 20,000원)'),
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
              child: const Text('예약금 결제하기'),
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

  /// 지금은 계좌이체와 스마트스토어로 받고, 확인은 사람이 한다.
  /// 그래서 "결제 완료"와 "확인 완료" 사이에 시간이 있다는 것을 알려야 한다.
  String _paymentGuideText(ReservationItem value) {
    return CustomerStage.of(
      value.status,
      value.paymentStatus,
      channel: value.paymentChannel,
      orderNo: value.paymentOrderNo,
    ).detail;
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

/// 예약 상태 + 결제 상태를 합친 한 줄 배지.
class _StageBadge extends StatelessWidget {
  const _StageBadge({required this.item});

  final ReservationItem item;

  @override
  Widget build(BuildContext context) {
    final CustomerStage stage = CustomerStage.of(
      item.status,
      item.paymentStatus,
      channel: item.paymentChannel,
      orderNo: item.paymentOrderNo,
    );
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: stage.color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        stage.label,
        style: TextStyle(color: stage.color, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
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

class _LoginRequiredView extends StatelessWidget {
  const _LoginRequiredView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Icon(Icons.lock_outline, size: 44, color: Color(0xFF94A3B8)),
            const SizedBox(height: 14),
            const Text(
              '로그인이 필요합니다',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            const Text(
              '예약 내역은 로그인 후 확인할 수 있어요.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: 200,
              child: FilledButton(
                onPressed: () => context.go('/login'),
                child: const Text('로그인'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
