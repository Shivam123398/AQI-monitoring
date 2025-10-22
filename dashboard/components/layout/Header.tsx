"use client";

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Header() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	return (
		<header className="sticky top-0 z-10 w-full border-b border-gray-200 bg-white/70 backdrop-blur dark:border-gray-700 dark:bg-gray-900/70">
			<div className="container mx-auto flex items-center justify-between px-4 py-3">
				<Link href="/" className="text-lg font-semibold">
					AeroGuard AI
				</Link>
				<nav className="flex items-center gap-4">
					<Link href="/map" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Map</Link>
					<Link href="/devices" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Devices</Link>
					<Link href="/forecast" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Forecast</Link>
					<Link href="/health" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Health</Link>
					<Link href="/alerts" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Alerts</Link>
					<Link href="/reports" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Reports</Link>
					<button
						aria-label="Toggle theme"
						onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
						className="rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
					>
						{mounted && theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
					</button>
				</nav>
			</div>
		</header>
	);
}
