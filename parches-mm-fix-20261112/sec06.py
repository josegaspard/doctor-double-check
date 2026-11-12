p = "/etc/caddy/extra/medical-masters.caddy"
s = open(p).read()
lines = s.split("\n")
i = next(k for k, l in enumerate(lines) if "Content-Security-Policy" in l)
csp = lines[i]
for o in (" https://api.resend.com", " https://generativelanguage.googleapis.com"):
    assert o in csp, o
    csp = csp.replace(o, "", 1)
lines[i] = csp
extra = [
    '\theader Strict-Transport-Security "max-age=31536000; includeSubDomains"',
    '\theader X-Frame-Options SAMEORIGIN',
    '\theader Permissions-Policy "geolocation=(self), usb=(), serial=(), hid=(), bluetooth=(), browsing-topics=()"',
]
assert "X-Frame-Options" not in s
lines[i + 1:i + 1] = extra
open(p, "w").write("\n".join(lines))
print("ok")
