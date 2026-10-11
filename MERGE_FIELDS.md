# Merge fields

LoyalSnap tokens from the automation export and the dashboard scripts. One row is one value. Aliases that print the same value share a row.

Mapped fields are read from Mindbody on each send and placed in `POST /api/tx` `data`. Subscriber attributes are written by the shared contact sync (`SYNC_CONTRACT.md`). This worker writes them only when `CONTACT_WRITE_MODE` is `self`. SMS bodies replace the LoyalSnap token. A gap has no Mindbody field. Studio name, phone, and address still fill from the worker, because the texts already say [Studio]. Offer prices, the agent name, and the purchase URLs stay empty until an owner sets them. A missing first name becomes "there". Other empty fallbacks remove the token.

| | Count |
| --- | ---: |
| Mapped | 9 |
| Gap | 12 |

| LoyalSnap field | Mindbody source | listmonk attrib | Template syntax | Example | Fallback |
| --- | --- | --- | --- | --- | --- |
| *&#124;FNAME&#124;*, [First name], @Client's first name | GET /client/clients — FirstName | attribs.first_name | {{ .Subscriber.FirstName }} and {{ .Tx.Data.FirstName }} | Alex | there |
| [Last name] | GET /client/clients — LastName | attribs.last_name | {{ .Subscriber.LastName }} and {{ .Tx.Data.LastName }} | Nguyen | empty |
| *&#124;EMAIL&#124;* | GET /client/clients — Email | attribs.email | {{ .Subscriber.Email }} and {{ .Tx.Data.Email }} | bondi@balancemoves.com.au | empty |
| *&#124;STUDIO&#124;*, [Studio], @Name of the client's studio | gap | attribs.studio | {{ .Subscriber.Attribs.studio }} and {{ .Tx.Data.studio }} | Balance Moves | Balance Moves |
| *&#124;PACK_NAME&#124;*, @Name of the client's package | GET /client/clientservices — Name | attribs.pack_name | {{ .Subscriber.Attribs.pack_name }} and {{ .Tx.Data.packName }} | 2 Week Intro Pass | your pass |
| pass end date (expiring automations; no *&#124;DATE&#124;* tag in the export) | GET /client/clientservices — ExpirationDate | attribs.pass_end_date | {{ .Subscriber.Attribs.pass_end_date }} and {{ .Tx.Data.passEndDate }} | 14 Oct 2026 | empty |
| visits (trial expiring copy says how many sessions; the preview hardcodes 5) | GET /client/clientvisits — signed-in visits in the automation's count | attribs.visits | {{ .Subscriber.Attribs.visits }} and {{ .Tx.Data.visits }} | 3 | 0 |
| @Number of credits remaining on the client's current package | GET /client/clientservices — Remaining | attribs.credits_remaining | {{ .Subscriber.Attribs.credits_remaining }} and {{ .Tx.Data.creditsRemaining }} | 2 | empty |
| @Days since the client's package expiration, in words | GET /client/clientservices — ExpirationDate, counted against today | attribs.days_since_expiry | {{ .Subscriber.Attribs.days_since_expiry }} and {{ .Tx.Data.daysSinceExpiry }} | two | empty |
| @Number of days since the client's last visit, in words | GET /client/clientvisits — StartDateTime of the latest signed-in visit | attribs.days_since_last_visit | {{ .Subscriber.Attribs.days_since_last_visit }} and {{ .Tx.Data.daysSinceLastVisit }} | seven | empty |
| <%asm_group_unsubscribe_raw_url%> | gap | — | {{ .Tx.Data.unsubscribeUrl }} | https://campaigns.balancemoves.com.au/subscription/form | empty |
| @Studio phone number, &#124;STUDIO PHONE&#124;, STUDIO_PHONE | gap | attribs.studio_phone | {{ .Subscriber.Attribs.studio_phone }} and {{ .Tx.Data.studioPhone }} | 0424 133 544 | 0424 133 544 |
| @Studio address | gap | attribs.studio_address | {{ .Subscriber.Attribs.studio_address }} and {{ .Tx.Data.studioAddress }} | 72A-74 Hall Street, Bondi Beach, NSW, 2026 | 72A-74 Hall Street, Bondi Beach, NSW, 2026 |
| @Agent | gap | — | {{ .Tx.Data.agent }} |  | empty |
| @Intro Offer Purchase URL | gap | — | {{ .Tx.Data.introOfferUrl }} |  | empty |
| @Secondary Offer Purchase URL | gap | — | {{ .Tx.Data.secondaryOfferUrl }} |  | empty |
| [Secondary Offer Display Name] | gap | — | {{ .Tx.Data.secondaryOfferName }} |  | empty |
| [Secondary Offer Discount Price] | gap | — | {{ .Tx.Data.secondaryOfferDiscountPrice }} |  | empty |
| [Secondary Offer Price] | gap | — | {{ .Tx.Data.secondaryOfferPrice }} |  | empty |
| [Secondary Offer Promo Code] | gap | — | {{ .Tx.Data.secondaryOfferPromoCode }} |  | empty |
| [Secondary Offer Expiration] | gap | — | {{ .Tx.Data.secondaryOfferExpiration }} |  | empty |
