"""
Mobile end-to-end smoke test (optional, not part of `npm test`).
Run against a LOCAL app with a seeded LOCAL database — it creates events and entries.

  pip install playwright && playwright install chromium
  npm run build && npm start            # in one terminal
  ADMIN_PASSWORD=... python3 tests/e2e/smoke.py

Uses admin owner@example.com (create it with: ADMIN_PASSWORD=... npm run admin:create -- owner@example.com Owner).
Screenshots land in tests/e2e/shots/.
"""
import os
os.makedirs("tests/e2e/shots", exist_ok=True)
import re, time, datetime as dt
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright, expect

B = os.environ.get("BASE_URL", "http://localhost:3000")
tz = ZoneInfo("America/Chicago")
now = dt.datetime.now(tz)
f = lambda d: d.strftime("%Y-%m-%dT%H:%M")
shot = lambda p, n: p.screenshot(path=f"tests/e2e/shots/{n}.png", full_page=True)

with sync_playwright() as pw:
    br = pw.chromium.launch(args=["--no-sandbox"])
    phone = dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)

    # ---------- Owner ----------
    a = br.new_context(**phone).new_page()
    a.goto(B + "/admin"); assert "/admin/login" in a.url
    a.fill("#email", "owner@example.com"); a.fill("#password", "wrong-password"); a.click("button:has-text('Sign in')")
    expect(a.locator("p[role=alert]")).to_contain_text("don't match")
    a.fill("#password", os.environ["ADMIN_PASSWORD"]); a.click("button:has-text('Sign in')")
    expect(a).to_have_url(B + "/admin"); shot(a, "01-admin-empty")

    a.goto(B + "/admin/settings")
    a.fill("input[name=sponsorName]", "Microdough (Owner Name TBD)")
    a.fill("input[name=sponsorContact]", "hello@example.com · Minneapolis, MN")
    a.fill("textarea[name=nextPopupNote]", "Sat, Dec 13 · 11am–3pm · Lu's Sandwiches")
    a.click("button:has-text('Save settings')"); expect(a.locator("p[role=status]")).to_contain_text("saved")

    a.goto(B + "/admin/events/new")
    a.fill("input[name=name]", "Holiday Cookie Pop-up")
    a.fill("input[name=locationName]", "Lu's Sandwiches")
    a.fill("input[name=startsAt]", f(now - dt.timedelta(hours=1)))
    a.fill("input[name=endsAt]", f(now + dt.timedelta(hours=3)))
    a.fill("input[name=entryOpensAt]", f(now - dt.timedelta(hours=1)))
    a.fill("input[name=entryClosesAt]", f(now + dt.timedelta(days=2)))
    a.fill("input[name=drawingAt]", f(now + dt.timedelta(days=3)))
    a.click("button:has-text('Create pop-up')")
    expect(a).to_have_url(re.compile(r"/admin/events/[0-9a-f-]{36}")); event_admin = a.url.split("?")[0]
    shot(a, "02-admin-event-created"); a.wait_for_timeout(800)
    a.check("input[name=confirm]"); a.click("button:has-text('Approve & publish rules')")
    expect(a.locator("p[role=status]")).to_contain_text("approved"); a.wait_for_timeout(800)
    a.click("button:has-text('Go live')"); expect(a.locator("p[role=status]")).to_contain_text("Live")

    # ---------- Customer 1: survey + entry ----------
    c = br.new_context(**phone).new_page()
    c.goto(B + "/"); assert "/event/" in c.url, c.url
    slug = c.url.rstrip("/").split("/event/")[1]
    shot(c, "03-welcome")
    t0 = time.time()
    c.click("text=Rate Our Cookies"); expect(c).to_have_url(re.compile(f"/event/{slug}/feedback"))
    c.click("button:has-text('Next')"); expect(c.locator("p[role=alert]")).to_contain_text("at least one")
    cards = c.locator("li.box")
    cards.nth(0).locator("label").first.click()
    cards.nth(3).locator("label").first.click()
    c.click("button:has-text('Next')"); expect(c.locator("p[role=alert]")).to_contain_text("Finish rating")
    for i, stars in [(0, 5), (3, 4)]:
        cards.nth(i).get_by_text(f"{stars} stars").click(force=True)
    cards.nth(0).get_by_text("Absolutely!").click()
    cards.nth(3).get_by_text("Maybe").click()
    shot(c, "04-tasting-card")
    c.click("button:has-text('Next')")
    c.get_by_text("Pandacoco").first.click()
    c.fill("#next", "Matcha black sesame")
    c.fill("#comments", "Pandacoco is unreal. Purple Haze a little too sweet for me <b>honestly</b>.")
    shot(c, "05-vote")
    c.wait_for_timeout(1500)
    c.click("button:has-text('Send my ratings')")
    expect(c).to_have_url(re.compile(f"/event/{slug}/enter\\?after=survey"), timeout=15000)
    shot(c, "06-enter-after-survey")
    c.fill("#firstName", "Avery"); c.fill("#email", "avery.test+pop@gmail.com")
    c.wait_for_timeout(2100)
    c.click("button:has-text('Enter to win')")
    expect(c.locator("label span.text-berry")).to_contain_text("official rules")
    assert c.locator("#firstName").input_value() == "Avery", "name was wiped after error"
    c.check("input[name=acceptRules]"); c.click("button:has-text('Enter to win')")
    expect(c).to_have_url(re.compile(f"/event/{slug}/success"), timeout=15000); print(f"survey+entry flow took {time.time()-t0:.1f}s (incl. bot-timing waits)")
    shot(c, "07-success")

    # ---------- Customer 2: direct entry, then duplicate ----------
    d = br.new_context(**phone).new_page()
    d.goto(f"{B}/event/{slug}"); d.click("text=Enter Giveaway Without Survey")
    t0 = time.time(); time.sleep(2.6)
    d.fill("#firstName", "Jo"); d.fill("#email", "jo@example.com"); d.check("input[name=acceptRules]")
    d.click("button:has-text('Enter to win')"); expect(d).to_have_url(re.compile("/success"), timeout=15000); print(f"direct entry took {time.time()-t0:.1f}s")
    # duplicate (dot variant of customer 1) gets identical success screen
    d.goto(f"{B}/event/{slug}/enter"); time.sleep(2.6)
    d.fill("#firstName", "Avery"); d.fill("#email", "averytest@gmail.com"); d.check("input[name=acceptRules]")
    d.click("button:has-text('Enter to win')"); expect(d).to_have_url(re.compile("/success"), timeout=15000)
    expect(d.get_by_role("heading", name=re.compile("You're in"))).to_be_visible()

    # ---------- Security spot checks ----------
    x = br.new_context(**phone)
    x.add_cookies([{"name": "md_admin", "value": "forged-token", "url": B}])
    xp = x.new_page(); xp.goto(B + "/admin/giveaways"); assert "/admin/login" in xp.url, "forged cookie got in!"
    r = xp.request.get(B + "/api/admin/export/optins"); assert r.status == 401, r.status
    # instant bot submission is silently dropped
    xp.goto(f"{B}/event/{slug}/enter"); xp.evaluate("document.querySelector('input[name=t]').value='1.forged'")
    xp.fill("#firstName", "Bot"); xp.fill("#email", "bot@spam.com"); xp.check("input[name=acceptRules]")
    xp.click("button:has-text('Enter to win')"); expect(xp).to_have_url(re.compile("/success"), timeout=15000)

    # ---------- Owner: dashboard, doughboard, draw ----------
    a.goto(B + "/admin"); shot(a, "08-admin-dashboard")
    a.goto(B + "/admin/doughboard"); shot(a, "09-doughboard")
    a.goto(B + "/admin/feedback"); expect(a.get_by_text("<b>honestly</b>", exact=False).first).to_be_visible(); shot(a, "10-feedback")
    r = a.request.get(B + "/api/admin/export/feedback?event=all"); assert r.status == 200 and "Pandacoco" in r.text()
    a.goto(event_admin); a.click("text=Giveaway (")
    expect(a.locator("div.box", has_text="Eligible entries").first).to_contain_text("2")
    a.click("button:has-text('Close entries now')"); expect(a.locator("p[role=status]")).to_contain_text("closed"); a.wait_for_timeout(800)
    a.check("input[name=confirm]"); a.click("button:has-text('Draw winner')")
    expect(a.locator("p[role=status]")).to_contain_text("Winner drawn"); a.wait_for_timeout(800)
    a.click("button:has-text('Mark contacted')"); expect(a.locator("p[role=status]")).to_contain_text("contacted")
    shot(a, "11-giveaway-winner")
    a.goto(event_admin.replace("/admin/events/", "/admin/events/") + "/sign?type=permanent"); shot(a, "12-sign")
    a.goto(B + "/admin/flavors"); shot(a, "13-flavors")

    # winner not visible publicly anywhere
    c.goto(f"{B}/event/{slug}"); assert "Avery" not in c.content() and "jo@example.com" not in c.content()
    shot(c, "14-welcome-after-close")
    print("E2E OK")
    br.close()
