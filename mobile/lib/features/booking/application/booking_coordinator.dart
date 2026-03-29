import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/booking_draft.dart';
import '../domain/booking_step.dart';

class BookingState {
  const BookingState({
    this.step = BookingStep.routeAndSchedule,
    this.draft = const BookingDraft(),
    this.errorMessage,
  });

  final BookingStep step;
  final BookingDraft draft;
  final String? errorMessage;

  BookingState copyWith({
    BookingStep? step,
    BookingDraft? draft,
    String? errorMessage,
    bool clearError = false,
  }) {
    return BookingState(
      step: step ?? this.step,
      draft: draft ?? this.draft,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class BookingCoordinator extends Notifier<BookingState> {
  @override
  BookingState build() => const BookingState();

  void updateRouteAndSchedule({
    String? departure,
    String? destination,
    String? date,
    String? time,
    int? passengers,
    int? durationHours,
    List<String>? selectedSpots,
  }) {
    state = state.copyWith(
      draft: state.draft.copyWith(
        departure: departure,
        destination: destination,
        date: date,
        time: time,
        passengers: passengers,
        durationHours: durationHours,
        selectedSpots: selectedSpots,
      ),
      clearError: true,
    );
  }

  void addSpot(String spot) {
    final List<String> next = <String>[...state.draft.selectedSpots, spot];
    state = state.copyWith(
      draft: state.draft.copyWith(selectedSpots: next),
      clearError: true,
    );
  }

  void removeSpotAt(int index) {
    if (index < 0 || index >= state.draft.selectedSpots.length) {
      return;
    }
    final List<String> next = <String>[...state.draft.selectedSpots]
      ..removeAt(index);
    state = state.copyWith(
      draft: state.draft.copyWith(selectedSpots: next),
      clearError: true,
    );
  }

  void updateContact({String? name, String? phone}) {
    state = state.copyWith(
      draft: state.draft.copyWith(name: name, phone: phone),
      clearError: true,
    );
  }

  void setAgreement(bool value) {
    state = state.copyWith(
      draft: state.draft.copyWith(depositAgreement: value),
      clearError: true,
    );
  }

  void applyTourPrefill({
    required String departure,
    required String destination,
    required List<String> selectedSpots,
    int? durationHours,
    String? season,
  }) {
    final int nextDuration = durationHours ?? state.draft.durationHours;
    state = state.copyWith(
      step: BookingStep.routeAndSchedule,
      draft: state.draft.copyWith(
        departure: departure,
        destination: destination,
        selectedSpots: selectedSpots,
        durationHours: nextDuration > 0 ? nextDuration : 4,
        season: season,
      ),
      clearError: true,
    );
  }

  bool goNext() {
    switch (state.step) {
      case BookingStep.routeAndSchedule:
        if (!_isRouteAndScheduleValid(state.draft)) {
          state = state.copyWith(
            errorMessage: '출발지/도착지/날짜/시간을 모두 입력해 주세요.',
          );
          return false;
        }
        state = state.copyWith(step: BookingStep.contact, clearError: true);
        return true;
      case BookingStep.contact:
        if (state.draft.name.trim().isEmpty) {
          state = state.copyWith(errorMessage: '예약자 이름을 입력해 주세요.');
          return false;
        }
        state = state.copyWith(
            step: BookingStep.pricingAgreement, clearError: true);
        return true;
      case BookingStep.pricingAgreement:
        if (!state.draft.depositAgreement) {
          state = state.copyWith(errorMessage: '예약금 정책 동의가 필요합니다.');
          return false;
        }
        return true;
    }
  }

  void goBack() {
    switch (state.step) {
      case BookingStep.routeAndSchedule:
        return;
      case BookingStep.contact:
        state = state.copyWith(
            step: BookingStep.routeAndSchedule, clearError: true);
        return;
      case BookingStep.pricingAgreement:
        state = state.copyWith(step: BookingStep.contact, clearError: true);
        return;
    }
  }

  bool _isRouteAndScheduleValid(BookingDraft draft) {
    return draft.departure.trim().isNotEmpty &&
        draft.destination.trim().isNotEmpty &&
        draft.date.trim().isNotEmpty &&
        draft.time.trim().isNotEmpty &&
        draft.passengers > 0 &&
        draft.durationHours > 0;
  }
}

final NotifierProvider<BookingCoordinator, BookingState>
    bookingCoordinatorProvider =
    NotifierProvider<BookingCoordinator, BookingState>(BookingCoordinator.new);
