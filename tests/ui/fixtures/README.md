# Test fixtures

`uniwrt/` stands in for the UniWRT Portal theme installed alongside CleanX:
UniWRT's real `menu.d` file plus small stand-ins for its pages. The harness
server only adds them after `GET /__coexist?on=1` (netmap.test.js does this),
so the main UI audit never sees them.
