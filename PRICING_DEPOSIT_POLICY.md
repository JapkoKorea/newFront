# Pricing, Deposit, and Settlement Policy

This document defines reservation-time pricing and the **initial recommended settlement model** for Japan Taxi Tour.

> Status: policy baseline for early-stage operation (before full payment integration).
> This document is operational guidance, not legal/tax advice.

---

## 1) Reservation-Time Pricing Policy

### 1.1 Base Deposit

- Base deposit fee: **15,000 KRW**
- Last-minute deposit (tour date is today or tomorrow): **20,000 KRW**
- Charged at reservation request step.
- A course may define its own deposit via `courses.deposit_krw`. The last-minute
  rule raises the amount but never lowers a higher course-specific deposit.

### 1.2 Hourly Vehicle Fare (Reference, JPY)

Rates are season-dependent. **Source of truth: `src/lib/pricing.js`** — update that file
first; this table mirrors it.

| Vehicle | Winter (Dec–Mar) | Regular (Apr–Nov) |
|---|---|---|
| Standard taxi | 10,370 JPY / h | 8,640 JPY / h |
| 4WD vehicle | 15,370 JPY / h | 13,640 JPY / h |
| Jumbo taxi (mandatory for 5+ passengers) | 13,130 JPY / h | 10,940 JPY / h |

4WD = standard + 5,000 JPY surcharge.

### 1.3 Minimum Bookable Duration

- Minimum duration: **2 hours**
- Reservations below 2 hours are not accepted.

### 1.4 Vehicle Selection Rules

- 1–4 passengers: Standard taxi or 4WD
- 5+ passengers: Jumbo taxi mandatory

### 1.5 Calculation Reference

- Estimated vehicle fare (JPY) = `hourly_rate_jpy * booked_hours`
- Reservation-time charge (KRW) = `base_deposit_krw (15,000 KRW)`

---

## 2) Initial Recommended Collection & Settlement Model

### 2.1 Model Summary (Early Stage)

- **Customer collection currency:** KRW
- **Operator payable currency:** JPY
- **Remittance cycle:** monthly
- **Business role:** Agent/Marketplace-style operation (net revenue recognition target)

### 2.2 Why This Model

1. Easier domestic card acceptance and CS operations in Korea.
2. Simpler early-stage payment operations than full JPY acquiring.
3. Matches current product UX (KRW deposit + JPY fare reference).

---

## 3) Settlement Ledger Rules (Operational)

Use dual-ledger accounting from day 1:

1. **Customer Ledger (KRW)**
   - Track collected deposit/platform charges, refunds, chargebacks.

2. **Operator Payable Ledger (JPY)**
   - Track each booking’s operator-share payable in JPY.
   - Monthly remittance is based on summed JPY payable minus approved offsets.

3. **FX Execution Rule**
   - Monthly KRW→JPY conversion follows predefined source and cutoff time.
   - Save rate source, timestamp, and settlement batch ID for audit.

---

## 4) Card Settlement, Refund, and Chargeback Policy

1. Platform acts as settlement owner (Merchant-of-Record style at payment layer).
2. Platform handles customer refund/chargeback first.
3. Related operator-side offsets are applied in next payout cycle by contract.
4. Keep reserve/holdback policy to absorb late chargebacks.

---

## 5) Revenue Recognition & Tax Positioning (High-Level)

### 5.1 Recommended accounting intent

- Recognize **net platform revenue**:
  - reservation fee + platform fee
- Treat operator share as payable/pass-through (not platform gross sales target).

### 5.2 Must-confirm items (before go-live with real payments)

1. VAT handling per fee type (reservation fee / platform fee / pass-through amount)
2. Cross-border remittance and withholding implications
3. Invoice/receipt policy for platform fee vs operator service value
4. Contract wording consistency (agent vs principal)

---

## 6) Data Required for Reconciliation

For each booking/settlement batch, store:

- booking_id, reservation_number
- customer_charge_krw
- platform_fee_krw
- operator_payable_jpy
- fx_rate_source, fx_rate, fx_timestamp
- refund_krw, chargeback_krw, adjustment_reason
- settlement_batch_id, payout_date

---

## 7) Customer-Facing Currency Display Rule

1. Show fare estimate in JPY for service context.
2. Show reservation-time payment in KRW clearly.
3. Avoid ambiguous mixed-currency totals without labels.

---

## 8) Future Upgrade Triggers

Review model when one of these happens:

1. FX variance causes material margin loss.
2. Chargeback/refund volume exceeds internal threshold.
3. Need for multi-country customer acquisition requires JPY checkout.

---

## 9) Constants (System)

- `base_deposit_krw = 15000`
- `last_minute_deposit_krw = 20000` (env `LAST_MINUTE_DEPOSIT_KRW`)
- `last_minute_days = 1`
- `hourly_rate_jpy` — see `src/lib/pricing.js` (`HOURLY_RATE_BY_SEASON`), season-dependent
- `base_deposit_krw` override per course: `courses.deposit_krw` (DB), env fallback `BASE_DEPOSIT_KRW`
- `minimum_hours = 2`
- `jumbo_min_passengers = 5`
