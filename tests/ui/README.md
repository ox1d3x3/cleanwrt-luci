# UI interaction audit

Checks that every option in LuCI can be reached and used with CleanX exactly
as with stock LuCI (Bootstrap).

```sh
npm install && npx playwright install chromium     # once, in this directory
./run.sh openwrt-25.12                              # or openwrt-24.10
./run.sh openwrt-25.12 390x844                      # phone-sized viewport
./run.sh openwrt-25.12 1440x900 'firewall|dhcp'     # only matching pages
```

## How it works

| File | Role |
| --- | --- |
| `setup.sh` | Fetches the LuCI sources of a release branch and builds `ucode`. |
| `assemble.sh` | Lays out a router-like web root: LuCI, Bootstrap and CleanX (CSS minified as released; `MINIFY=0` for the readable source). |
| `server.js` | Renders pages with LuCI's real ucode templates, serves the menu built from `menu.d` like LuCI's dispatcher, and answers `/ubus` with `mock.js`. |
| `mock.js` | A mocked router: OpenWrt's default configs (network, two radios, DHCP, fw4 zones/rules, LEDs, ...) and replies to every ubus call the views make, including Wi-Fi clients, wired hosts behind bridge ports and growing traffic counters for the Network Map. |
| `audit.js` | Drives Chromium with a real mouse: every page, tab (nested ones too), Edit/Add dialog, checkbox, radio, select, text field and dropdown item. Also flags things LuCI hides but a theme shows (inactive options and tab panes, empty tabs, expanded closed dropdowns, squeezed nested sections). |
| `compare.py` | Compares the CleanX run with the Bootstrap run and fails on anything that works with Bootstrap but not with CleanX. |
| `health.js` | Opens every page once more with each theme and reports what goes wrong only with CleanX: JavaScript errors, sideways scrolling (page or sidebar), oversized graphics, broken images, controls off the right edge and extra router requests while idle. |
| `fixtures/uniwrt/` | UniWRT's menu plus stand-ins for its pages, switched on with `/__coexist?on=1` to check CleanX alongside UniWRT. |
| `netmap.test.js` | Checks CleanX's Network Map: desktop and phone, light and dark, access-point mode (`/__scenario?name=ap` on the server), the device dialog, saving a name and icon, and the message under other themes. Also checks the login page and CleanX alongside UniWRT. `run.sh` runs it after the audit. |

Failure screenshots are saved next to the JSON reports in `.work/out-*/`.
Unknown ubus calls are listed at `http://localhost:<port>/__unknown` while
the server runs; add them to `mock.js` when LuCI gains new views.
