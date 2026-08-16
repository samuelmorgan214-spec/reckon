// Betfair API hosts, in one place so the ingester and the lookup helper cannot
// drift apart.
//
// Australian jurisdiction. Betfair AU/NZ is a separate licence from the
// international exchange, and an AU account will not authenticate against the
// .com hosts: the login returns INVALID_USERNAME_OR_PASSWORD, which reads like
// a bad password rather than a wrong endpoint. If login fails against these,
// try identitysso.betfair.com and api.betfair.com before assuming the
// credentials are wrong.
export const IDENTITY = 'https://identitysso.betfair.com.au/api/login';
export const BETTING = 'https://api.betfair.com.au/exchange/betting/rest/v1.0';
