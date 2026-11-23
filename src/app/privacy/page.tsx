import { PublicShell } from "@/components/public-shell";
import { loadSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy notice" };

export default async function PrivacyPage() {
  const s = await loadSettings();
  return (
    <PublicShell>
      <h1 className="hand-caps text-3xl">Privacy notice</h1>
      <div className="box mt-5 flex flex-col gap-4 p-5 leading-relaxed [&_h2]:font-extrabold [&_h2]:text-ink">
        <section>
          <h2>Cookie ratings are anonymous</h2>
          <p>
            Your ratings, votes and comments are stored without your name, email, phone, or IP address, and are kept
            separate from giveaway entries. We use them only to learn which flavors people love.
          </p>
        </section>
        <section>
          <h2>Giveaway entries</h2>
          <p>
            We collect your first name, email, and (optionally) phone number only to run the giveaway and contact the
            winner. We never sell or share it, never publish entrants&apos; or winners&apos; details, and don&apos;t
            use it for anything else — unless you tick the optional box to hear about Microdough news, which you can
            undo at any time by asking us.
          </p>
        </section>
        <section>
          <h2>How long we keep it</h2>
          <p>Giveaway contact details are deleted about {s.retentionDays} days after each giveaway closes.</p>
        </section>
        <section>
          <h2>Your choices</h2>
          <p>
            To see, correct, or delete your information, contact {s.sponsorName}
            {s.sponsorContact ? ` at ${s.sponsorContact}` : " via Instagram @micro.dough"}. We&apos;ll delete it
            promptly.
          </p>
        </section>
        <section>
          <h2>Security</h2>
          <p>
            Data is stored in an encrypted database and is only accessible to the Microdough owner through a
            password-protected dashboard. Your IP address is never stored; a one-way scrambled version is kept briefly
            to prevent spam.
          </p>
        </section>
      </div>
    </PublicShell>
  );
}
