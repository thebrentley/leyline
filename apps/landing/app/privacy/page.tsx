import type { Metadata } from 'next'
import Link from 'next/link'
import LeylineLogo from '../../components/LeylineLogo'

export const metadata: Metadata = {
  title: 'Privacy Policy | Leyline',
  description: 'Leyline privacy policy — how we collect, use, and protect your data.',
}

export default function PrivacyPolicy() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-gray-950 via-purple-950/40 to-gray-950">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 py-4 md:px-8 md:py-6">
        <Link href="/" className="flex items-center gap-2 md:gap-3">
          <LeylineLogo className="h-8 w-8 md:h-10 md:w-10" />
          <div>
            <div className="text-base font-light tracking-wider text-white md:text-xl">
              LEYLINE
            </div>
            <div className="hidden text-[10px] font-light tracking-[0.3em] text-gray-400 sm:block">
              EVERYTHING. CONNECTED.
            </div>
          </div>
        </Link>

        <Link
          href="/"
          className="rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm transition-all hover:border-purple-600/50 hover:bg-gray-800/50 md:px-5 md:py-2.5 md:text-sm"
        >
          Back to Home
        </Link>
      </header>

      {/* Content */}
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-8 md:px-8 md:pt-12">
        <h1 className="mb-8 text-4xl font-light tracking-tight text-white md:mb-12 md:text-5xl">
          Privacy Policy
        </h1>

        <div className="space-y-8 text-gray-300">
          <p className="text-sm text-gray-400">
            Last updated: February 9, 2026
          </p>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              Overview
            </h2>
            <p>
              Leyline (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your
              privacy. This Privacy Policy explains how we collect, use, and safeguard
              your information when you use our website, mobile application, and services
              (collectively, the &quot;Service&quot;).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              Information We Collect
            </h2>
            <h3 className="text-lg font-medium text-gray-200">
              Account Information
            </h3>
            <p>
              When you create an account, we collect your email address, username, and
              password. If you sign up using a third-party service, we may receive your
              name and email address from that provider.
            </p>
            <h3 className="text-lg font-medium text-gray-200">
              Usage Data
            </h3>
            <p>
              We collect information about how you interact with the Service, including
              decks you build, games you play, and features you use. This helps us
              improve and personalize your experience.
            </p>
            <h3 className="text-lg font-medium text-gray-200">
              Device Information
            </h3>
            <p>
              We may collect device type, operating system, browser type, and general
              location data (country/region) to optimize performance and troubleshoot
              issues.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              How We Use Your Information
            </h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Provide, maintain, and improve the Service</li>
              <li>Personalize your experience and deliver relevant content</li>
              <li>Communicate with you about updates, features, and support</li>
              <li>Analyze usage trends to improve our products</li>
              <li>Protect against fraud, abuse, and unauthorized access</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              Data Sharing
            </h2>
            <p>
              We do not sell your personal information. We may share data with
              third-party service providers who help us operate the Service (e.g.,
              hosting, analytics), but only as necessary and under strict
              confidentiality obligations. We may also disclose information if required
              by law or to protect our rights and safety.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              Data Security
            </h2>
            <p>
              We implement industry-standard security measures to protect your data,
              including encryption in transit and at rest. However, no method of
              transmission or storage is 100% secure, and we cannot guarantee absolute
              security.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              Your Rights
            </h2>
            <p>
              You may access, update, or delete your account information at any time
              through your account settings. You can also request a copy of your data or
              ask us to delete your account by contacting us. If you are in the EU/EEA,
              you have additional rights under the GDPR, including the right to data
              portability and the right to restrict processing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              Cookies
            </h2>
            <p>
              We use essential cookies to keep you logged in and remember your
              preferences. We may also use analytics cookies to understand how the
              Service is used. You can control cookie settings through your browser.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              Children&apos;s Privacy
            </h2>
            <p>
              The Service is not intended for children under 13. We do not knowingly
              collect personal information from children under 13. If we learn that we
              have collected such information, we will delete it promptly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of
              significant changes by posting a notice on the Service or sending you an
              email. Your continued use of the Service after changes take effect
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-white md:text-2xl">
              Contact Us
            </h2>
            <p>
              If you have questions about this Privacy Policy or your data, please
              contact us at{' '}
              <a
                href="mailto:privacy@leyline.gg"
                className="text-purple-400 underline transition-colors hover:text-purple-300"
              >
                privacy@leyline.gg
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      {/* Background Glow Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-3xl" />
      </div>
    </div>
  )
}
