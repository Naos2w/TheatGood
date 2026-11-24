# Century Asia Nangang Hall 23 — public seating-grid audit

- Observed 2026-11-25 in an unsigned Chrome browser using the normal public [session preview](https://www.centuryasia.com.tw/book.html?sid=Nangang), without entering purchase, login or selecting seats.
- Two 2026-11-26 sessions (11:30 and 13:40) both returned HTTP 200 and directly identified Nangang Hall 23. Their factual labelled positions and wheelchair marker agreed exactly. Sources: https://www.centuryasia.com.tw/Movie/GetSeatView/Nangang/0001058/2026-11-26/11-30/0023 and https://www.centuryasia.com.tw/Movie/GetSeatView/Nangang/0001058/2026-11-26/13-40/0023.
- 43 numbered seats, one wheelchair marker at row 1 column 12, four rows and thirteen columns. This reconciles with 44 published positions in the official 2026-11-18 capacity archive. Edge and interior gaps preserved. No operator artwork, availability, account details or ticket data retained; original 2D/3D geometry uses observed seat positions, estimated scene dimensions.
- This is an additional hall at a previously covered branch, not a newly covered cinema.
- Local acceptance: 217/217 unit tests; ESLint, TypeScript and production build passed. Chrome mobile 393x852 and Edge desktop 1280x800 both rendered 43 numbered seats, one wheelchair marker and WebGL with zero horizontal overflow and no JavaScript errors.
