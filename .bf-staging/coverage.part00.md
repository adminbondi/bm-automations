# LoyalSnap coverage

Captured 11 Oct 2026 from the LoyalSnap inventory (9 funnels, 19 dashboard lanes, dynamic client lists, and the static client-list titles). 75 automations are rows in D1, including the red-flag credits rule. Rows that were off are seeded with enabled = false.

## Summary

| Set | Covered | Gap |
| --- | ---: | ---: |
| Automations (75) | 75 | 0 |
| Dashboard lanes (19) | 19 | 0 |
| Dynamic client lists (13) | 13 | 0 |
| Static client lists (244) | 0 | 244 |

Covered means the engine can express the rule and, for automations, a disabled D1 row exists. Gap means a fact or threshold was not in the export, so the row is not pretended to match.

Emails that have no listmonk template id stay with template_id null. Turning one on holds the job with reason template_missing and does not call listmonk. Package and contract names that were not in the export use an empty list, which matches nothing until an owner saves the names.

## Automations

| Funnel | Name | LoyalSnap | Trigger | Filters | Delay | Stop rules | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Birthday | Birthday (email) | off | morning cron | client has a birth date | on the birthday | once per calendar year | covered — D1 birthday-day-email. timing birthday_day. Template id unset. |
| Birthday | Birthday (text) | off | morning cron | client has a birth date | on the birthday | once per calendar year | covered — D1 birthday-day-text. timing birthday_day. |
| Birthday | Birthday month (email) | off | morning cron | client has a birth date | first day of the birthday month | once per calendar year | covered — D1 birthday-month-email. birthday_month_start. Template was missing in LoyalSnap too. |
| Birthday | Birthday month (text) | off | morning cron, after any client event schedules the job | client has a birth date | 1st of the birthday month | once per calendar year, then the job moves to next year | covered — D1 birthday-month-text. timing birthday_month_start, dedupeScope calendar_year, repeat yearly. |
| Black Friday | Moment 1 — Start | off | clientSale.created | intro pass name tokens (7-day / intro pass) | immediately (day 0 since activation) | one send per client | covered — D1 bf-intro-moment-1, template 14. Day 0 on Intro Pass sale. |
| Black Friday | Moment 2 — Midway | off | clientSale.created, then morning cron | intro pass name tokens | 3 days after activation (editable) | one send per client | covered — D1 bf-intro-moment-2, template 15. delay_days 3 from Intro Pass sale. |
| Black Friday | Moment 3 — Early Bird Access | off | clientSale.created, then morning cron | intro pass name tokens | 6 days after activation (editable) | one send per client | covered — D1 bf-intro-moment-3, template 16. delay_days 6 from Intro Pass sale. |
| Class packs | Class pack expiring in 3 days | off | package purchase, then the morning cron | class pack, at least 1 visit | 3 days before expiry | skip below 1 visit | covered — D1 pack-expiring-3-days. days_before_expiry 3, minVisits 1. Package names unset. |
| Class packs | Class pack welcome | off | clientSale.created | one of 6 packages (names were not in the export) | immediately | one send | covered — D1 pack-welcome. Empty package list fails closed. |
| Class packs | Pack empty (text) | off | class sign-in | 0 visits remaining | immediately | one send | covered — D1 pack-none-remaining-text. exactRemaining 0. |
| Class packs | Pack expired 1 month | off | package purchase, then the morning cron | class pack | 30 days after expiry (LoyalSnap said one month) | one send | covered — D1 pack-expired-30-days. days_after_expiry 30. |
| Class packs | Pack expired 5 days | off | package purchase, then the morning cron | class pack | 5 days after expiry | one send | covered — D1 pack-expired-5-days. days_after_expiry 5. |
| Class packs | Pack with 2 classes remaining | off | class sign-in | 2 visits remaining, at least 1 visit | immediately | one send | covered — D1 pack-two-remaining. filters.exactRemaining 2 from Mindbody ClientServices.Remaining. |
| Class packs | Pack with no classes remaining | off | class sign-in | 0 visits remaining on the class pack | immediately | one send | covered — D1 pack-none-remaining. exactRemaining 0. |
| Class packs | Red flag, under 3 credits | off | class booking or visit | fewer than 3 credits remaining | immediately | one send per client; stays off | covered — D1 red-flag-under-3-credits. maxRemaining 2 from the webhook remaining count. Enabled false. No template. |
| ClassPass | ClassPass 10 classes | off | class sign-in | ClassPass package | immediately | exactly 10 ClassPass visits | covered — D1 classpass-10-classes. exactVisits 10. |
| ClassPass | ClassPass 2+ classes in 2 weeks | off | class sign-in | ClassPass, between 2 and 999 visits in 14 days | immediately once the window matches | one send per client | covered — D1 classpass-two-in-two-weeks. visitWindowDays 14, min 2, max 999. |
| ClassPass | ClassPass 5 classes | off | class sign-in | one of 4 ClassPass packages (token match) | immediately | exactly 5 ClassPass visits | covered — D1 classpass-5-classes. exactVisits 5. |
| ClassPass | ClassPass after first class | off | class sign-in | ClassPass package | immediately | exactly 1 ClassPass visit | covered — D1 classpass-first-class. exactVisits 1, scope matching_package, ClassPass tokens. |
| ClassPass | ClassPass Welcome (ID 570472) | on | client.created or classRosterBooking.created | ClassPass package | immediately | skip if the waiver is already signed | covered — D1 classpass-welcome, template 13. skipIfWaiverSigned. |
| External leads | External lead day 10 | off | lead.created (after their information is received) | none (last-contact filter was off) | 10 days after the lead is received | one send per client | covered — D1 external-day-10. Trigger lead.created. delay_days 10, morning cron rechecks. |
| External leads | External lead day 10 (text) | off | lead.created (after their information is received) | none (last-contact filter was off) | 10 days after the lead is received | one send per client | covered — D1 external-day-10-text. Trigger lead.created. delay_days 10, morning cron rechecks. |
| External leads | External lead day 14 | off | lead.created (after their information is received) | none (last-contact filter was off) | 14 days after the lead is received | one send per client | covered — D1 external-day-14. Trigger lead.created. delay_days 14, morning cron rechecks. |
| External leads | External lead day 2 | off | lead.created (after their information is received) | none (last-contact filter was off) | 2 days after the lead is received | one send per client | covered — D1 external-day-2. Trigger lead.created. delay_days 2, morning cron rechecks. |
| External leads | External lead day 30 (text) | off | lead.created (after their information is received) | none (last-contact filter was off) | 30 days after the lead is received | one send per client | covered — D1 external-day-30-text. Trigger lead.created. delay_days 30, morning cron rechecks. |
| External leads | External lead day 5 (text) | off | lead.created (after their information is received) | none (last-contact filter was off) | 5 days after the lead is received | one send per client | covered — D1 external-day-5-text. Trigger lead.created. delay_days 5, morning cron rechecks. |
| External leads | External lead day 60 | off | lead.created (after their information is received) | none (last-contact filter was off) | 60 days after the lead is received | one send per client | covered — D1 external-day-60. Trigger lead.created. delay_days 60, morning cron rechecks. |
| External leads | External lead day 7 (text) | off | lead.created (after their information is received) | none (last-contact filter was off) | 7 days after the lead is received | one send per client | covered — D1 external-day-7-text. Trigger lead.created. delay_days 7, morning cron rechecks. |
| External leads | External lead welcome | off | lead.created (after their information is received) | none (last-contact filter was off) | immediately | one send per client | covered — D1 external-immediate. Trigger lead.created. Immediate. |
| External leads | External lead welcome (text) | off | lead.created (after their information is received) | none (last-contact filter was off) | immediately | one send per client | covered — D1 external-immediate-text. Trigger lead.created. Immediate. |
| Lapsed | Lapsed 180 days | off | class sign-in, then the morning cron | inactive client | 180 days after the last visit | one send per absence; a newer visit reschedules the job | covered — D1 lapsed-180-days. timing days_since_last_visit 180, clientActivity inactive. Visit start dates come from Mindbody StartDateTime. |
| Lapsed | Lapsed 210 days | off | class sign-in, then the morning cron | inactive client | 210 days after the last visit | one send per absence; a newer visit reschedules the job | covered — D1 lapsed-210-days. timing days_since_last_visit 210, clientActivity inactive. Visit start dates come from Mindbody StartDateTime. |
| Lapsed | Lapsed 240 days | off | class sign-in, then the morning cron | inactive client | 240 days after the last visit | one send per absence; a newer visit reschedules the job | covered — D1 lapsed-240-days. timing days_since_last_visit 240, clientActivity inactive. Visit start dates come from Mindbody StartDateTime. |
| Lapsed | Lapsed 270 days | off | class sign-in, then the morning cron | inactive client | 270 days after the last visit | one send per absence; a newer visit reschedules the job | covered — D1 lapsed-270-days. timing days_since_last_visit 270, clientActivity inactive. Visit start dates come from Mindbody StartDateTime. |
| Lapsed | Lapsed 30 days | off | class sign-in, then the morning cron | inactive client | 30 days after the last visit | one send per absence; a newer visit reschedules the job | covered — D1 lapsed-30-days. timing days_since_last_visit 30, clientActivity inactive. Visit start dates come from Mindbody StartDateTime. |
| Lapsed | Lapsed 300 days | off | class sign-in, then the morning cron | inactive client | 300 days after the last visit | one send per absence; a newer visit reschedules the job | covered — D1 lapsed-300-days. timing days_since_last_visit 300, clientActivity inactive. Visit start dates come from Mindbody StartDateTime. |
| Lapsed | Lapsed 330 days | off | class sign-in, then the morning cron | inactive client | 330 days after the last visit | one send per absence; a newer visit reschedules the job | covered — D1 lapsed-330-days. timing days_since_last_visit 330, clientActivity inactive. Visit start dates come from Mindbody StartDateTime. |
| Lapsed | Lapsed 360 days | off | class sign-in, then the morning cron | inactive client | 360 days after the last visit | one send per absence; a newer visit reschedules the job | covered — D1 lapsed-360-days. timing days_since_last_visit 360, clientActivity inactive. Visit start dates come from Mindbody StartDateTime. |
| Lapsed | Lapsed 60 days | off | class sign-in, then the morning cron | inactive client | 60 days after the last visit | one send per absence; a newer visit reschedules the job | covered — D1 lapsed-60-days. timing days_since_last_visit 60, clientActivity inactive. Visit start dates come from Mindbody StartDateTime. |
| Lapsed | Lapsed 90 days | off | class sign-in, then the morning cron | inactive client | 90 days after the last visit | one send per absence; a newer visit reschedules the job | covered — D1 lapsed-90-days. timing days_since_last_visit 90, clientActivity inactive. Visit start dates come from Mindbody StartDateTime. |
| Lapsed | Trial expired 3 days | off | intro purchase, then the morning cron | intro pass | 3 days after the pass expires | one send; missed the exact day is missed_window | covered — D1 trial-expired-3-days. days_after_expiry 3, intro tokens. |
