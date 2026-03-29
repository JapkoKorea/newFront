enum BookingStep {
  routeAndSchedule,
  contact,
  pricingAgreement,
}

extension BookingStepLabel on BookingStep {
  String get title {
    switch (this) {
      case BookingStep.routeAndSchedule:
        return '경로 및 일정';
      case BookingStep.contact:
        return '예약자 정보';
      case BookingStep.pricingAgreement:
        return '요금 및 약관 동의';
    }
  }

  int get index {
    switch (this) {
      case BookingStep.routeAndSchedule:
        return 1;
      case BookingStep.contact:
        return 2;
      case BookingStep.pricingAgreement:
        return 3;
    }
  }
}
