# Spec Delta

## Purpose

Lets operations see and edit the closed days of each market in the admin panel, so national, regional, carrier, and ad hoc closures change preparation, pickup, and delivery dates without a deploy.

## ADDED Requirements

### Requirement: Closed days are listed by market and year

The system SHALL list the closed-day rows of one market (`BR` or `US`) and one calendar year, ordered by date. Each row MUST show the date, label, type (`national`, `regional`, `carrier`, or `adhoc`), whether it is active, and the three independent flags: closes preparation, closes pickup, and closes delivery. Inactive rows MUST be listed and marked as inactive.

#### Scenario: Listing a Brazil year

- **WHEN** an operator with `production.read` selects market `BR` and year 2027
- **THEN** the list shows every `BR` row dated in 2027, including the national holidays, ordered by date

#### Scenario: Flags are shown one by one

- **WHEN** the `US` 2027 list includes 24 December with only pickup closed
- **THEN** that row shows pickup closed and preparation and delivery open

#### Scenario: Inactive row stays visible

- **WHEN** a national holiday of the selected year was deactivated
- **THEN** it appears in the list marked as inactive

#### Scenario: Year with no rows

- **WHEN** the selected market and year have no rows
- **THEN** the page shows an empty state in Portuguese and no error

#### Scenario: Session limited to one market

- **WHEN** a session limited to `BR` by market scope asks for the `US` calendar
- **THEN** the API refuses the request and the page does not offer `US`

#### Scenario: Read-only user sees no write controls

- **WHEN** a `readonly` user opens the page
- **THEN** the list is shown with no create, edit, deactivate, reactivate, or remove controls

### Requirement: A date is closed when any active row closes it

The system SHALL treat a date as closed for preparation, pickup, or delivery when at least one active row of that market and date sets that flag. A date MUST hold at most one row per type. Inactive rows MUST NOT close anything.

#### Scenario: Two active rows on one date

- **WHEN** a date has an active `national` row that closes all three and an active `adhoc` row that closes only pickup
- **THEN** the date is closed for preparation, pickup, and delivery

#### Scenario: Only the inactive row closes the date

- **WHEN** the only row of a date that closes delivery is inactive
- **THEN** delivery is open on that date

#### Scenario: Second row of the same type is refused

- **WHEN** an operator adds a `regional` row on a date that already has a `regional` row in that market
- **THEN** the API refuses it with a conflict error and nothing is saved

### Requirement: Rows can be deactivated and reactivated

The system SHALL let a user with `production.write` deactivate an active row and reactivate an inactive row of any type. Deactivation MUST open only the flags no other active row of that date still sets. Deactivation MUST NOT change deliveries already scheduled or a stored Stripe `trial_end`.

#### Scenario: Opening Carnaval

- **WHEN** an operator deactivates the `national` row for Carnaval Monday in `BR`
- **THEN** the row stays in the list as inactive and that day becomes valid for preparation and delivery, unless another active row closes it

#### Scenario: Deactivation leaves scheduled deliveries alone

- **WHEN** a row is deactivated on a date that earlier closures moved deliveries away from
- **THEN** those deliveries keep their current dates and `trial_end`

#### Scenario: Reactivation follows the closure rule

- **WHEN** an operator reactivates a row whose flags close a preparation, pickup, or delivery already projected for that date
- **THEN** the reactivation goes through the same preview, lock check, and rescheduling as a new closure

#### Scenario: Read-only user cannot deactivate

- **WHEN** a `readonly` user calls the deactivate endpoint
- **THEN** the API refuses with a permission error and the row is unchanged

### Requirement: Flags of a row can be changed

The system SHALL let a user with `production.write` change the three flags of an existing row of any type. At least one flag MUST stay set. Turning a flag on MUST follow the closure rule. Turning a flag off MUST NOT change deliveries already scheduled or a stored Stripe `trial_end`.

#### Scenario: Turning delivery on for a pickup-only day

- **WHEN** an operator turns on the delivery flag of the `US` 24 December `carrier` row
- **THEN** the change goes through the same preview, lock check, and rescheduling as a new closure

#### Scenario: Turning a flag off

- **WHEN** an operator turns off the pickup flag of a row that also closes delivery
- **THEN** pickup opens on that date unless another active row closes it, and no delivery is rescheduled

#### Scenario: Last flag cannot be turned off

- **WHEN** an operator turns off the only flag still set on a row
- **THEN** the API refuses it with a validation error and points to deactivation

### Requirement: National holidays cannot be removed

The system MUST refuse to delete a row of type `national`. A national holiday SHALL be turned off only by deactivation.

#### Scenario: Remove is refused for a national holiday

- **WHEN** an operator asks to remove the `BR` national row of 25 December
- **THEN** the API refuses it, the row stays, and the page offers deactivation instead

### Requirement: Regional and ad hoc closures can be added

The system SHALL let a user with `production.write` add a row of type `regional` or `adhoc` with a date, a label, and at least one of the three flags set. A row with no flag set MUST be refused. In `BR`, regional covers Curitiba and Paraná. In `US`, it covers the kitchen's state.

#### Scenario: Ad hoc closure for maintenance

- **WHEN** an operator adds an `adhoc` row in `BR` for a maintenance day with all three flags set
- **THEN** that day is closed for preparation, pickup, and delivery

#### Scenario: Regional closure next to a national one

- **WHEN** an operator adds a `regional` row on a date that already has an active `national` row
- **THEN** both rows are stored and listed for that date

#### Scenario: No flag set

- **WHEN** an operator submits a new row with preparation, pickup, and delivery all open
- **THEN** the API refuses it with a validation error and nothing is saved

#### Scenario: Short notice warns but saves

- **WHEN** an operator adds a closure dated less than 7 days after today in the market timezone
- **THEN** the dialog shows a warning in Portuguese and the save still goes through on confirm

### Requirement: A new closure shows the affected deliveries first

Before saving a write that closes a flag that was open on a date, the system SHALL list the subscriptions of that market whose next or projected preparation, pickup, or delivery falls on that date for that flag. Each item MUST say whether the delivery is locked. The preview MUST NOT change Stripe or any delivery.

#### Scenario: Preview lists the affected subscriptions

- **WHEN** an operator prepares a closure on a date with two projected deliveries, one of them `in_production`
- **THEN** the dialog lists both subscriptions and marks the `in_production` one as locked

#### Scenario: Preview with no affected deliveries

- **WHEN** no projected preparation, pickup, or delivery falls on the date for the flags being closed
- **THEN** the dialog says no delivery is affected and lets the operator confirm

### Requirement: A closure moves editable deliveries in one transaction

On confirm, the system SHALL check the affected deliveries again. When none is locked, each MUST move to the next valid preparation day. The closure, the moved dates, one pending Stripe sync per moved subscription with a `trial_end`, and the audit entry MUST commit together or not at all. The confirm MUST NOT call Stripe.

#### Scenario: Editable delivery moves

- **WHEN** an operator confirms a closure on a date where an editable delivery was due
- **THEN** the closure is saved, that delivery moves to the next valid preparation day, Meu Plano shows the new date, and a pending sync targets `trial_end` at 00:00 of that day in the market timezone

#### Scenario: Locked delivery blocks the closure

- **WHEN** an affected delivery is `in_production`, `ready`, or `blocked`, or past its `editable_until`, at the moment of confirm
- **THEN** the API refuses the closure, names the locked subscription, and saves nothing

#### Scenario: Delivery locked after the preview

- **WHEN** a delivery was editable in the preview and became locked before confirm
- **THEN** the API refuses the closure and saves nothing

#### Scenario: Saving fails midway

- **WHEN** writing the sync row of the second of three affected subscriptions fails
- **THEN** the closure is not saved, no delivery moves, no sync row and no audit entry remain, and the operator sees an error in Portuguese

#### Scenario: Stripe is down at confirm

- **WHEN** Stripe is unavailable while an operator confirms a closure with affected deliveries
- **THEN** the closure is saved and the syncs stay pending

### Requirement: Moved charges reach Stripe through retried syncs

The system SHALL apply each pending sync by setting the subscription's Stripe `trial_end` to its target with no proration, retrying transient errors with backoff. Applying a sync twice MUST leave Stripe as one application would. A sync MUST NOT write when Stripe's `trial_end` is neither the value expected before the move nor the target.

#### Scenario: Sync applied

- **WHEN** a pending sync runs and Stripe still has the expected `trial_end`
- **THEN** Stripe's `trial_end` becomes the target and the sync is marked synced

#### Scenario: Retry after a transient error

- **WHEN** Stripe returns a transient error for a pending sync
- **THEN** the sync stays pending with one more attempt and runs again later

#### Scenario: Already applied

- **WHEN** a sync runs again after Stripe already has the target `trial_end`
- **THEN** no second Stripe write is made and the sync is marked synced

#### Scenario: Value changed meanwhile

- **WHEN** the customer skipped the delivery after the closure and before the sync ran
- **THEN** the sync makes no Stripe write, is marked conflict, and keeps the `trial_end` found in Stripe

#### Scenario: Retries run out

- **WHEN** a sync reaches the attempt limit without success
- **THEN** it is marked failed and is no longer retried

#### Scenario: Second closure before the sync

- **WHEN** a second closure moves a subscription whose earlier sync is still pending
- **THEN** the earlier sync is superseded and only the new target is written to Stripe

### Requirement: The panel shows delayed, failed, and conflict syncs

The system SHALL list, for the session's market, syncs still pending 15 minutes after creation as delayed, and failed and conflict syncs together in one list. Each item MUST show the subscription, the expected and the target `trial_end`, the attempts, and the last error. A conflict MUST also show the `trial_end` found in Stripe. Users with `production.read` MUST see these lists.

#### Scenario: Delayed sync

- **WHEN** a sync was created 20 minutes ago and is still pending
- **THEN** the panel lists it as delayed

#### Scenario: Failed and conflict syncs listed together

- **WHEN** one sync is failed and another is conflict
- **THEN** both appear in the same list with their status, subscription, expected and target `trial_end`, and last error, and the conflict also shows the `trial_end` found in Stripe

#### Scenario: Nothing to show

- **WHEN** every sync is synced or superseded, or pending for less than 15 minutes
- **THEN** the panel shows no sync alert

### Requirement: Failed and conflict syncs can be resent

The system SHALL let a user with `production.write` resend a failed or conflict sync, returning it to pending. A conflict MUST show the found and the target `trial_end` before confirm, and the confirm MUST be refused if Stripe changed since. A resend MUST be refused when the target is past or the sync is synced or superseded.

#### Scenario: Resending a failed sync

- **WHEN** an operator resends a failed sync whose target is in the future
- **THEN** the sync is pending again with zero attempts and the job applies it on its next run

#### Scenario: Conflict shows both values first

- **WHEN** an operator chooses to resend a conflict sync
- **THEN** the dialog shows the `trial_end` found in Stripe and the target, and nothing changes until the operator confirms

#### Scenario: Confirmed conflict resend

- **WHEN** the operator confirms and Stripe still has the found `trial_end`
- **THEN** the sync is pending again and the job writes the target over the found value

#### Scenario: Stripe changed again before the resend

- **WHEN** the operator confirms a conflict resend but Stripe's `trial_end` is no longer the value shown
- **THEN** the API refuses the resend, the sync stays conflict, and the panel shows the new found value

#### Scenario: Target already past

- **WHEN** an operator resends a sync whose target `trial_end` has passed
- **THEN** the API refuses the resend and the sync is unchanged

#### Scenario: Read-only user cannot resend

- **WHEN** a `readonly` user calls the resend endpoint
- **THEN** the API refuses with a permission error and the panel shows no resend button

### Requirement: Regional and ad hoc closures can be removed

The system SHALL let a user with `production.write` delete a row of type `regional` or `adhoc`. Removal MUST open only the flags no other active row of that date sets, and MUST NOT change deliveries already scheduled or a stored Stripe `trial_end`.

#### Scenario: Removing an ad hoc closure on a Brazil national holiday

- **WHEN** 1 January 2028 in `BR` has an active `national` row and an `adhoc` row, and the operator removes the `adhoc` row
- **THEN** the `national` row stays and the date is still closed

#### Scenario: Removing an ad hoc closure on a UPS holiday

- **WHEN** 1 January 2028 in `US` has an active `carrier` row and an `adhoc` row, and the operator removes the `adhoc` row
- **THEN** the `carrier` row stays and the date is still closed

#### Scenario: Removing the only closure of a date

- **WHEN** an operator removes the only row of a date
- **THEN** that date opens for later projection and deliveries already moved away keep their dates

#### Scenario: Read-only user cannot remove

- **WHEN** a `readonly` user calls the remove endpoint
- **THEN** the API refuses with a permission error and the row stays

### Requirement: The UPS calendar is registered per year

The system SHALL let a user with `production.write` add `carrier` rows to `US` for a year the UPS publishes, each with a date, label, and its own flags. The same closure rule MUST apply to each row. No year of `US` carrier rows is created by the system on its own.

#### Scenario: Full UPS closure

- **WHEN** an operator adds Thanksgiving as a `carrier` row with all three flags set
- **THEN** that day is closed for preparation, pickup, and delivery in `US`

#### Scenario: Pickup-only closure

- **WHEN** an operator adds 24 December as a `carrier` row that closes only pickup
- **THEN** delivery is still possible on 24 December and no shipment is picked up that day

#### Scenario: Pickup and delivery closure

- **WHEN** an operator adds 31 December as a `carrier` row that closes pickup and delivery
- **THEN** no shipment is picked up or delivered that day and preparation stays open

#### Scenario: Brazil has no carrier rows

- **WHEN** an operator tries to add a `carrier` row in `BR`
- **THEN** the API refuses it with a validation error

### Requirement: The panel warns before the UPS calendar runs out

The system SHALL show a warning in the panel when today in `America/New_York` is less than 90 days before 31 December of the last `US` year with a loaded UPS calendar. A year with only a 1 January `carrier` row MUST NOT count as loaded. With no loaded year, the warning MUST show.

#### Scenario: Within 90 days of the covered end

- **WHEN** the last loaded UPS year is 2027 and today is 15 October 2027
- **THEN** the panel warns that the UPS calendar for 2028 is missing

#### Scenario: More than 90 days ahead

- **WHEN** the last loaded UPS year is 2027 and today is 5 October 2026
- **THEN** no UPS calendar warning is shown

#### Scenario: Lone 1 January does not count

- **WHEN** 2028 has only a 1 January `carrier` row and today is 15 October 2027
- **THEN** the warning is still shown

#### Scenario: Loading the next year clears the warning

- **WHEN** operations adds the 2028 UPS calendar while the warning is shown
- **THEN** the warning disappears until 90 days before 31 December 2028

### Requirement: Every calendar change is audited

The system SHALL record one audit entry for each create, remove, activation, deactivation, flag change, and sync resend. The entry MUST hold the actor, the time, the action, the market, date, type, and label, the previous and the new value of `active` and the three flags, and the subscriptions moved with their previous and new preparation day. A change that is not saved MUST leave no entry.

#### Scenario: Creating a closure that moves deliveries

- **WHEN** an operator creates an `adhoc` closure that moves two subscriptions
- **THEN** one entry records the operator, the time, no previous value, the new flags, and both subscriptions with their previous and new preparation day

#### Scenario: Flag change

- **WHEN** an operator turns off the pickup flag of a row
- **THEN** the entry records the flags before and after the change

#### Scenario: Removed row stays traceable

- **WHEN** an operator removes a `regional` row
- **THEN** the entry keeps its date, type, label, and previous flags after the row is gone

#### Scenario: Sync resend

- **WHEN** an operator resends a conflict sync
- **THEN** one entry records the operator, the time, the subscription, the previous status, and the expected, found, and target `trial_end`

#### Scenario: Refused change leaves no entry

- **WHEN** a closure is refused because an affected delivery is locked
- **THEN** no audit entry is recorded

### Requirement: Calendar history is visible in the panel

The system SHALL show the audit entries of the selected market and year in the panel, newest first, with actor, time, action, date, the values before and after, and the moved subscriptions. Users with `production.read` MUST see it. A session limited to one market MUST NOT see the other market's history.

#### Scenario: Reading the history

- **WHEN** a `readonly` user opens the history for `BR` 2027
- **THEN** the panel lists that year's `BR` calendar entries, newest first

#### Scenario: History of another market

- **WHEN** a session limited to `BR` asks for the `US` history
- **THEN** the API refuses the request
