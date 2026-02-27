import type { Metadata } from 'next'
import LeylineLogo from '../../components/LeylineLogo'

export const metadata: Metadata = {
  title: 'Delete Your Account | Leyline',
  description:
    'How to delete your Leyline account and what happens to your data.',
}

export default function AccountDeletion() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-gray-950 via-purple-950/40 to-gray-950">
      {/* Header */}
      <header className="relative z-10 flex items-center px-4 py-4 md:px-8 md:py-6">
        <div className="flex items-center gap-2 md:gap-3">
          <LeylineLogo className="h-8 w-8 md:h-10 md:w-10" />
          <div>
            <div className="text-base font-light tracking-wider text-white md:text-xl">
              LEYLINE
            </div>
            <div className="hidden text-[10px] font-light tracking-[0.3em] text-gray-400 sm:block">
              EVERYTHING. CONNECTED.
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-8 md:px-8 md:pt-12">
        <h1 className="mb-8 text-4xl font-light tracking-tight text-white md:mb-12 md:text-5xl">
          Delete Your Account
        </h1>

        <div className="space-y-8 text-gray-300">
          <p className="text-sm text-gray-400">Last updated: February 23, 2026</p>

          <p>
            Leyline allows you to permanently delete your account and associated
            data at any time. This page explains how to request account deletion
            and what happens to your data when you do.
          </p>

          {/* Steps */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              How to Delete Your Account
            </h2>
            <p>
              Follow these steps to delete your Leyline account from the mobile
              app:
            </p>
            <ol className="list-decimal space-y-4 pl-6">
              <li>
                <span className="font-medium text-white">
                  Open the Leyline app
                </span>{' '}
                and log in to your account.
              </li>
              <li>
                <span className="font-medium text-white">
                  Tap your profile icon
                </span>{' '}
                in the bottom navigation bar to go to your profile.
              </li>
              <li>
                <span className="font-medium text-white">
                  Tap &quot;Settings&quot;
                </span>{' '}
                (the gear icon).
              </li>
              <li>
                <span className="font-medium text-white">
                  Scroll down and tap &quot;Delete Account.&quot;
                </span>
              </li>
              <li>
                <span className="font-medium text-white">
                  Confirm the deletion
                </span>{' '}
                when prompted. You will be asked to confirm that you understand
                this action is permanent and cannot be undone.
              </li>
            </ol>
            <p className="mt-4">
              You can also request account deletion by emailing us at{' '}
              <a
                href="mailto:support@leyline.gg"
                className="text-purple-400 underline transition-colors hover:text-purple-300"
              >
                support@leyline.gg
              </a>{' '}
              from the email address associated with your account. We will
              process your request within 30 days.
            </p>
          </section>

          {/* Data Deleted */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              Data That Is Deleted
            </h2>
            <p>
              When your account is deleted, the following data is permanently
              removed from our systems:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Your account profile (username, email, and password)</li>
              <li>Saved decks and deck configurations</li>
              <li>Collection and inventory data</li>
              <li>Game history and play statistics</li>
              <li>Pod memberships and associated data</li>
              <li>App preferences and settings</li>
              <li>Push notification tokens and device registrations</li>
            </ul>
          </section>

          {/* Data Retained */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              Data That May Be Retained
            </h2>
            <p>
              Certain data may be retained for a limited period after account
              deletion for the following reasons:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <span className="font-medium text-white">
                  Anonymized analytics data
                </span>{' '}
                — Aggregated, non-identifiable usage statistics may be retained
                indefinitely to help us improve the service. This data cannot be
                linked back to your account.
              </li>
              <li>
                <span className="font-medium text-white">
                  Legal and compliance records
                </span>{' '}
                — Transaction records or data required by law may be retained for
                up to 90 days after deletion to comply with legal obligations,
                resolve disputes, or enforce our terms.
              </li>
              <li>
                <span className="font-medium text-white">Backup systems</span>{' '}
                — Your data may persist in encrypted backups for up to 30 days
                before being automatically purged.
              </li>
            </ul>
          </section>

          {/* Important Notes */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              Important Information
            </h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Account deletion is <span className="font-medium text-white">permanent and cannot be undone</span>.
                You will not be able to recover your account or any associated
                data after deletion.
              </li>
              <li>
                If you signed up using a third-party provider (e.g., Google or
                Apple), deleting your Leyline account does not affect your
                third-party account. You may also need to revoke Leyline&apos;s
                access from your third-party account settings.
              </li>
              <li>
                Any active subscriptions should be cancelled through the Google
                Play Store or Apple App Store before deleting your account.
                Deleting your Leyline account does not automatically cancel
                store-managed subscriptions.
              </li>
            </ul>
          </section>

          {/* Contact */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              Contact Us
            </h2>
            <p>
              If you have questions about account deletion or need assistance,
              contact us at{' '}
              <a
                href="mailto:support@leyline.gg"
                className="text-purple-400 underline transition-colors hover:text-purple-300"
              >
                support@leyline.gg
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-4 py-6 text-center text-xs text-gray-500 md:px-8">
        &copy; {new Date().getFullYear()} Leyline. All rights reserved.
      </footer>

      {/* Background Glow Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-3xl" />
      </div>
    </div>
  )
}
