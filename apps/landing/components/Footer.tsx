import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="relative bg-gray-950 px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between border-t border-gray-800 pt-6">
        <span className="text-xs text-gray-500">
          &copy; {new Date().getFullYear()} Leyline
        </span>
        <Link
          href="/privacy"
          className="text-xs text-gray-500 transition-colors hover:text-purple-400"
        >
          Privacy Policy
        </Link>
      </div>
    </footer>
  )
}
