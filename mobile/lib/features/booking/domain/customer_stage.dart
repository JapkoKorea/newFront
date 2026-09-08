import 'package:flutter/material.dart';

/// 고객에게 보여줄 한 줄 예약 상태.
///
/// 예약 상태와 결제 상태를 배지 두 개로 나란히 보여주면 어느 쪽을 봐야 할지
/// 모호했다. 고객이 알고 싶은 건 "내 예약이 지금 어디까지 왔나" 하나다.
///
/// 데이터는 그대로 두 값이다. 여기서 합치는 것은 표시뿐이며, 결제가 예약
/// 상태를 자동으로 바꾸지는 않는다 — 예약 확정은 운영자가 판단한다.
/// 웹의 src/lib/reservationStatus.js customerStage 와 같은 규칙이다.
class CustomerStage {
  const CustomerStage({
    required this.label,
    required this.detail,
    required this.color,
  });

  final String label;
  final String detail;
  final Color color;

  static const CustomerStage waiting = CustomerStage(
    label: '예약 대기중',
    detail: '예약금 결제를 진행해 주세요.',
    color: Color(0xFF64748B),
  );

  static const CustomerStage inProgress = CustomerStage(
    label: '예약 진행중',
    detail: '결제 확인 중입니다. 확인되면 예약이 확정됩니다.',
    color: Color(0xFFD97706),
  );

  static const CustomerStage confirmed = CustomerStage(
    label: '예약 확정',
    detail: '배차가 확정되었습니다.',
    color: Color(0xFF16A34A),
  );

  static const CustomerStage completed = CustomerStage(
    label: '이용 완료',
    detail: '투어가 끝났습니다.',
    color: Color(0xFF2563EB),
  );

  static const CustomerStage cancelled = CustomerStage(
    label: '예약 취소',
    detail: '취소된 예약입니다.',
    color: Color(0xFF64748B),
  );

  static const CustomerStage rejected = CustomerStage(
    label: '예약 불가',
    detail: '배차가 어려워 진행하지 못했습니다.',
    color: Color(0xFFDC2626),
  );

  /// 종결 상태가 우선한다. 그 외에는 확정 여부를 먼저 보고,
  /// 아직이면 결제를 어디까지 했는지로 나눈다.
  static CustomerStage of(String status, String paymentStatus) {
    switch (status) {
      case 'cancelled':
        return cancelled;
      case 'rejected':
        return rejected;
      case 'completed':
        return completed;
      case 'confirmed':
        return confirmed;
    }
    if (paymentStatus == 'ready' || paymentStatus == 'paid') return inProgress;
    return waiting;
  }
}
