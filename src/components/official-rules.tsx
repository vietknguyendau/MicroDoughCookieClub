import type { EventRow } from "@/lib/services/events";
import { formatDate, formatDateTime } from "@/lib/time";
import { money, siteUrl } from "@/lib/site";

type Sponsor = { sponsorName: string; sponsorContact: string };

/** Single template used for the public rules page AND the owner's approval preview. */
export function OfficialRules({ ev, sponsor }: { ev: EventRow; sponsor: Sponsor }) {
  const tz = ev.timezone;
  const url = `${siteUrl()}/event/${ev.slug}/enter`;
  const sponsorLine = `${sponsor.sponsorName}${sponsor.sponsorContact ? ` (${sponsor.sponsorContact})` : ""}`;
  return (
    <div className="flex flex-col gap-4 text-[0.95rem] leading-relaxed [&_h3]:font-extrabold [&_h3]:text-ink">
      <p className="font-bold">
        NO PURCHASE, SURVEY, OR SOCIAL MEDIA FOLLOW NECESSARY TO ENTER OR WIN. A PURCHASE OR SURVEY WILL NOT INCREASE
        YOUR CHANCES OF WINNING. VOID WHERE PROHIBITED.
      </p>
      <section>
        <h3>1. Sponsor</h3>
        <p>This giveaway (&ldquo;Giveaway&rdquo;) is sponsored by {sponsorLine} (&ldquo;Sponsor&rdquo;).</p>
      </section>
      <section>
        <h3>2. Eligibility</h3>
        <p>{ev.eligibility} Employees of Sponsor and their immediate household members are not eligible.</p>
      </section>
      <section>
        <h3>3. Entry period</h3>
        <p>
          Entries are accepted from {formatDateTime(ev.entryOpensAt, tz)} until {formatDateTime(ev.entryClosesAt, tz)}{" "}
          (the &ldquo;Entry Period&rdquo;). Sponsor may close entries early only by posting the change on this page.
        </p>
      </section>
      <section>
        <h3>4. How to enter</h3>
        <p>
          Scan the QR code at the {ev.name} pop-up, or enter from anywhere during the Entry Period at{" "}
          <span className="break-all font-semibold">{url}</span>. Provide your first name and email address (phone
          optional) and agree to these rules. Completing the cookie survey is optional and has no effect on eligibility
          or odds. Marketing consent is optional and has no effect on eligibility or odds.
        </p>
      </section>
      <section>
        <h3>5. Limit</h3>
        <p>
          One (1) entry per person for this Giveaway. Additional entries using the same or variant email addresses will
          be disregarded. Automated or bulk entries are void.
        </p>
      </section>
      <section>
        <h3>6. Prize</h3>
        <p>
          One (1) prize: {ev.prizeDescription}. Approximate retail value: {money(ev.prizeValueCents)}. No cash
          alternative or transfer. Prize is perishable and must be picked up as arranged. {ev.fulfillment}
        </p>
      </section>
      <section>
        <h3>7. Winner selection &amp; odds</h3>
        <p>
          On or about {formatDate(ev.drawingAt, tz)}, one winner will be selected at random by a secure computer
          process from all eligible entries received during the Entry Period. Every eligible entry has an equal chance.
          Odds depend on the number of eligible entries received.
        </p>
      </section>
      <section>
        <h3>8. Notification &amp; claiming</h3>
        <p>
          The winner will be contacted privately by email (and phone, if provided). The winner must respond within{" "}
          {ev.claimWindowHours} hours of notification. If the winner does not respond in time, is found ineligible,
          declines, or cannot claim the prize as arranged, the prize is forfeited and an alternate winner may be
          selected at random from the remaining eligible entries. Winner names are not published.
        </p>
      </section>
      <section>
        <h3>9. General</h3>
        <p>
          Sponsor may disqualify entries made through fraud or tampering. By entering, entrants agree to these rules and
          Sponsor&apos;s decisions. This Giveaway is not sponsored, endorsed, or administered by, or associated with,
          Instagram or Meta. Winner is responsible for any applicable taxes.
        </p>
        {ev.additionalRules && <p className="mt-2 whitespace-pre-line">{ev.additionalRules}</p>}
      </section>
      <section>
        <h3>10. Privacy</h3>
        <p>
          Entry information is used only to administer this Giveaway and, if you opt in, to send Microdough updates.
          See the Privacy Notice at {siteUrl()}/privacy.
        </p>
      </section>
    </div>
  );
}
