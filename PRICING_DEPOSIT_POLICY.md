# Pricing and Deposit Policy

This document defines the reservation-time payment calculation policy for Japan Taxi Tour.

## 1) Base Deposit

- Base deposit fee: 15,000 KRW
- This fee is charged during reservation/payment step.

## 2) Hourly Vehicle Fare (JPY)

All vehicle fares are hourly and use the following rates:

- Standard taxi: 7,350 JPY per hour
- 4WD vehicle: 9,000 JPY per hour
- Jumbo taxi (required for 5+ passengers): 10,500 JPY per hour

## 3) Minimum Bookable Duration

- Minimum duration: 2 hours
- Reservations below 2 hours are not accepted.

## 4) Vehicle Selection Rules

- For 1-4 passengers: Standard taxi or 4WD can be selected.
- For 5+ passengers: Jumbo taxi is mandatory.

## 5) Calculation Reference

At reservation/payment stage, use this reference:

- Estimated vehicle fare (JPY) = hourly_rate_jpy * booked_hours
- Reservation-time charge (KRW) = base_deposit_krw (15,000 KRW)

If service policy changes to collect full/partial fare at reservation time, update this document and backend calculation logic together.

## 6) Constants (System)

- `base_deposit_krw = 15000`
- `hourly_rate_jpy.standard = 7350`
- `hourly_rate_jpy.four_wd = 9000`
- `hourly_rate_jpy.jumbo = 10500`
- `minimum_hours = 2`
- `jumbo_min_passengers = 5`
