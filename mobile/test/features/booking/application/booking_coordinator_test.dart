import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japan_taxi_tour_mobile/features/booking/application/booking_coordinator.dart';
import 'package:japan_taxi_tour_mobile/features/booking/domain/booking_step.dart';

void main() {
  group('BookingCoordinator', () {
    test('route step validation fails when required fields are missing', () {
      final ProviderContainer container = ProviderContainer();
      addTearDown(container.dispose);

      final BookingCoordinator coordinator =
          container.read(bookingCoordinatorProvider.notifier);

      final bool advanced = coordinator.goNext();
      final BookingState state = container.read(bookingCoordinatorProvider);

      expect(advanced, isFalse);
      expect(state.step, BookingStep.routeAndSchedule);
      expect(state.errorMessage, contains('출발지/도착지/날짜/시간'));
    });

    test('can advance all steps with valid data and agreement', () {
      final ProviderContainer container = ProviderContainer();
      addTearDown(container.dispose);

      final BookingCoordinator coordinator =
          container.read(bookingCoordinatorProvider.notifier);

      coordinator.updateRouteAndSchedule(
        departure: 'Biei Station',
        destination: 'Asahikawa Airport',
        date: '2026-04-01',
        time: '10:30',
        passengers: 3,
        durationHours: 5,
        selectedSpots: const <String>['청의 호수'],
      );

      final bool routeAdvanced = coordinator.goNext();
      expect(routeAdvanced, isTrue);
      expect(
        container.read(bookingCoordinatorProvider).step,
        BookingStep.contact,
      );

      coordinator.updateContact(name: 'David', phone: '010-1234-5678');
      final bool contactAdvanced = coordinator.goNext();
      expect(contactAdvanced, isTrue);
      expect(
        container.read(bookingCoordinatorProvider).step,
        BookingStep.pricingAgreement,
      );

      coordinator.setAgreement(true);
      final bool done = coordinator.goNext();
      expect(done, isTrue);
      expect(
        container.read(bookingCoordinatorProvider).draft.selectedSpots,
        const <String>['청의 호수'],
      );
    });

    test('spot add and remove updates ordered list', () {
      final ProviderContainer container = ProviderContainer();
      addTearDown(container.dispose);

      final BookingCoordinator coordinator =
          container.read(bookingCoordinatorProvider.notifier);

      coordinator.addSpot('청의 호수');
      coordinator.addSpot('흰수염폭포');
      coordinator.removeSpotAt(0);

      final BookingState state = container.read(bookingCoordinatorProvider);
      expect(state.draft.selectedSpots, const <String>['흰수염폭포']);
    });
  });
}
