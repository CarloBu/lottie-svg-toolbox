export type RecentItem = {
	name: string;
	size: number;
	lastOpened: number;
	content?: string;
};

const RECENT_KEY = "lottie-converter-recent-files";
const MAX_ITEMS = 20;
const MAX_INLINE_BYTES = 300_000; // ~300KB cap for storing inline content

export function getRecentFiles(): RecentItem[] {
	try {
		const raw = localStorage.getItem(RECENT_KEY) || "[]";
		const parsed = JSON.parse(raw) as RecentItem[];
		if (Array.isArray(parsed)) return parsed;
		return [];
	} catch {
		return [];
	}
}

export function saveRecentFile(name: string, size: number, content?: string) {
	const items = getRecentFiles();
	const now = Date.now();

	let inlineContent: string | undefined = undefined;
	try {
		if (content !== undefined) {
			const bytes = new Blob([content]).size;
			if (bytes <= MAX_INLINE_BYTES) inlineContent = content;
		}
	} catch {
		// ignore content storage errors
	}

	const withoutDupes = items.filter((it) => !(it.name === name && it.size === size));
	const next: RecentItem[] = [{ name, size, lastOpened: now, content: inlineContent }, ...withoutDupes].slice(0, MAX_ITEMS);

	localStorage.setItem(RECENT_KEY, JSON.stringify(next));
	// Notify UI panels to refresh
	document.dispatchEvent(new CustomEvent("recent:refresh"));
}

export function touchRecent(name: string, size: number) {
	const items = getRecentFiles();
	const now = Date.now();
	const next = items.map((it) => (it.name === name && it.size === size ? { ...it, lastOpened: now } : it));
	localStorage.setItem(RECENT_KEY, JSON.stringify(next));
	document.dispatchEvent(new CustomEvent("recent:refresh"));
}
