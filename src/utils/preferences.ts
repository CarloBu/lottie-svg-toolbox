/**
 * Unified preference management system for the Lottie Converter application
 * Centralizes all localStorage operations with type safety and error handling
 */

// Define all preference keys with their types
export interface PreferenceKeys {
	// Background preferences
	bg: "white" | "gray" | "dark-gray" | "black" | "checkers" | "custom";
	"bg-custom-color": string;

	// Export preferences
	"export-format": "svg" | "png" | "jpeg";
	"aggressive-optimization": boolean;

	// Animation preferences
	loop: boolean;
	"ignore-opacity": boolean;
	"show-frame": boolean;

	// Recent files (handled separately in recent-files.ts)
	"recent-files": string; // JSON string

	// Card states
	"card-collapsed": boolean; // Dynamic key: card-{cardId}-collapsed
}

// Default values for all preferences
export const DEFAULT_PREFERENCES: PreferenceKeys = {
	bg: "white",
	"bg-custom-color": "#ffffff",
	"export-format": "svg",
	"aggressive-optimization": false,
	loop: true,
	"ignore-opacity": false,
	"show-frame": false,
	"recent-files": "[]",
	"card-collapsed": false, // This is a template, actual keys are dynamic
};

// Preference key prefix
const PREFIX = "lottie-converter-";

/**
 * Get a preference value with type safety and fallback to default
 */
export function getPreference<K extends keyof PreferenceKeys>(key: K, defaultValue?: PreferenceKeys[K]): PreferenceKeys[K] {
	try {
		const stored = localStorage.getItem(PREFIX + key);
		if (stored === null) {
			return defaultValue ?? DEFAULT_PREFERENCES[key];
		}

		// Handle boolean values
		if (typeof DEFAULT_PREFERENCES[key] === "boolean") {
			return (stored === "true") as PreferenceKeys[K];
		}

		// Handle string values
		return stored as PreferenceKeys[K];
	} catch (error) {
		console.warn(`Failed to get preference ${key}:`, error);
		return defaultValue ?? DEFAULT_PREFERENCES[key];
	}
}

/**
 * Set a preference value with error handling
 */
export function setPreference<K extends keyof PreferenceKeys>(key: K, value: PreferenceKeys[K]): void {
	try {
		localStorage.setItem(PREFIX + key, String(value));
	} catch (error) {
		console.warn(`Failed to set preference ${key}:`, error);
	}
}

/**
 * Get a card collapse state
 */
export function getCardCollapsed(cardId: string): boolean {
	return getPreference("card-collapsed" as any, false);
}

/**
 * Set a card collapse state
 */
export function setCardCollapsed(cardId: string, collapsed: boolean): void {
	try {
		localStorage.setItem(`card-${cardId}-collapsed`, String(collapsed));
	} catch (error) {
		console.warn(`Failed to set card ${cardId} collapsed state:`, error);
	}
}

/**
 * Get all preferences as an object (useful for debugging or export)
 */
export function getAllPreferences(): Partial<PreferenceKeys> {
	const preferences: Partial<PreferenceKeys> = {};

	for (const key of Object.keys(DEFAULT_PREFERENCES) as Array<keyof PreferenceKeys>) {
		if (key !== "card-collapsed") {
			// Skip dynamic keys
			preferences[key] = getPreference(key);
		}
	}

	return preferences;
}

/**
 * Reset all preferences to defaults
 */
export function resetAllPreferences(): void {
	try {
		// Remove all lottie-converter preferences
		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key && (key.startsWith(PREFIX) || key.startsWith("card-"))) {
				keysToRemove.push(key);
			}
		}

		keysToRemove.forEach((key) => localStorage.removeItem(key));
	} catch (error) {
		console.warn("Failed to reset preferences:", error);
	}
}

/**
 * Check if localStorage is available
 */
export function isLocalStorageAvailable(): boolean {
	try {
		const test = "__localStorage_test__";
		localStorage.setItem(test, test);
		localStorage.removeItem(test);
		return true;
	} catch {
		return false;
	}
}
