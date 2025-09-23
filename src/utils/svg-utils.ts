// Use the browser-compatible build to avoid Node stream dependency
import { optimize } from "svgo/browser";

/**
 * Optimizes SVG content using SVGO (similar to Figma's optimization)
 */
export function optimizeSVG(svgContent: string, aggressive: boolean = true): string {
	try {
		const result = optimize(svgContent, {
			plugins: [
				// Enable default optimization plugins, but preserve IDs/defs used by masks/gradients
				{
					name: "preset-default",
					params: {
						overrides: {
							cleanupIds: false,
							removeUselessDefs: false,
							removeHiddenElems: false,
							removeEmptyContainers: false,
						},
					},
				},
				// Additional optimizations for aggressive mode
				...(aggressive
					? [
							{
								name: "convertPathData",
								params: {
									floatPrecision: 2, // Reduce coordinate precision (Figma uses ~2-3)
									transformPrecision: 2,
									removeUseless: true,
									collapseRepeated: true,
									utilizeAbsolute: true,
									leadingZero: true,
									negativeExtraSpace: true,
								},
							},
							{
								name: "convertTransform",
								params: {
									floatPrecision: 2,
									transformPrecision: 2,
									matrixToTransform: true,
									shortTranslate: true,
									shortScale: true,
									shortRotate: true,
									removeUseless: true,
									collapseIntoOne: true,
									leadingZero: true,
									negativeExtraSpace: true,
								},
							},
							{
								name: "cleanupNumericValues",
								params: {
									floatPrecision: 2,
									leadingZero: true,
									defaultAttrs: true,
									removeUseless: true,
								},
							},
						]
					: []),
			],
		});

		return result.data;
	} catch (error) {
		console.warn("SVGO optimization failed, returning cleaned SVG:", error);
		return cleanLottieIds(svgContent);
	}
}

/**
 * Cleans up Lottie-generated IDs and attributes from SVG content
 */
export function cleanLottieIds(svgContent: string): string {
	// Preserve IDs to keep mask/clipPath/filter/gradient references intact.
	// Only strip lottie-specific data attributes and excess whitespace.
	let cleanedSvg = svgContent.replace(/\s*data-lottie-[^=]*="[^"]*"/g, "");
	cleanedSvg = cleanedSvg.replace(/\s+/g, " ");
	return cleanedSvg;
}

/**
 * Downloads SVG content as a file
 */
export function downloadSVG(svgContent: string, filename: string, aggressive: boolean = true) {
	// Clean minimal attributes and optimize before downloading (preserve IDs/defs)
	const optimizedSvg = optimizeSVG(cleanLottieIds(svgContent), aggressive);

	const blob = new Blob([optimizedSvg], { type: "image/svg+xml" });
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Converts SVG markup to an Image element using a data URL
 */
function svgToImage(svgContent: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		try {
			const svgBlob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
			const url = URL.createObjectURL(svgBlob);
			const img = new Image();
			img.onload = () => {
				URL.revokeObjectURL(url);
				resolve(img);
			};
			img.onerror = (e) => {
				URL.revokeObjectURL(url);
				reject(e);
			};
			// Ensure SVG width/height are respected (important for raw SVG imports)
			img.decoding = "async";
			img.src = url;
		} catch (e) {
			reject(e);
		}
	});
}

/**
 * Rasterizes SVG content to PNG or JPEG and triggers a download
 */
export async function downloadRasterFromSVG(
	svgContent: string,
	filenameWithoutExt: string,
	format: "png" | "jpeg",
	quality: number = 0.8,
	scale: number = 1,
): Promise<void> {
	// Clean minimal attributes; keep IDs/defs so masks/gradients render correctly
	const img = await svgToImage(cleanLottieIds(svgContent));

	const baseWidth = Math.max(1, img.naturalWidth || img.width);
	const baseHeight = Math.max(1, img.naturalHeight || img.height);
	const width = Math.max(1, Math.round(baseWidth * (Number.isFinite(scale) ? scale : 1)));
	const height = Math.max(1, Math.round(baseHeight * (Number.isFinite(scale) ? scale : 1)));

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas 2D context not available");

	// For JPEG, draw a white background to avoid black/transparent artifacts
	if (format === "jpeg") {
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, width, height);
	}
	ctx.drawImage(img, 0, 0, width, height);

	const mime = format === "png" ? "image/png" : "image/jpeg";
	const ext = format === "png" ? "png" : "jpg";

	await new Promise<void>((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					reject(new Error("Failed to create image blob"));
					return;
				}
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `${filenameWithoutExt}.${ext}`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
				resolve();
			},
			mime,
			// quality is ignored for PNG by spec; used for JPEG
			Math.max(0, Math.min(1, quality)),
		);
	});
}
