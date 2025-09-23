import lottie from "lottie-web";
import type { AnimationItem } from "lottie-web";
import type { LottieConverterState, ConversionOptions, DOMElements } from "../types/lottie";
import { downloadSVG, downloadRasterFromSVG } from "../utils/svg-utils";
import { saveRecentFile, touchRecent } from "./recent-files";
import { getPreference, setPreference } from "../utils/preferences";

export class LottieConverter {
	private state: LottieConverterState = {
		animationInstance: null,
		animationData: null,
		totalFrames: 0,
		currentFrame: 0,
		originalFilename: null,
		isPlaying: false,
		isLooping: true,
		zoomMode: "fit",
		zoomPercent: 100,
		ignoreOpacity: false,
	};

	// Track current file for recent files management
	private currentFileName: string | null = null;
	private currentFileSize: number | null = null;

	private hasInteractedSinceLoad: boolean = false;

	// Panning helpers (not persisted)
	private isPanning: boolean = false;
	private lastClientX: number = 0;
	private lastClientY: number = 0;
	private panOffsetX: number = 0;
	private panOffsetY: number = 0;

	private elements: DOMElements = {
		uploadSection: null,
		previewSection: null,
		lottieContainer: null,
		frameSlider: null,
		currentFrameSpan: null,
		totalFramesSpan: null,
		aggressiveOptimizationCheckbox: null,
		downloadBtn: null,
		playBtn: null,
		loopCheckbox: null,
		exportFormatSelect: null,
		compressionSlider: null,
		rasterScaleSlider: null,
		ignoreOpacitySwitch: null,
	};

	constructor() {
		this.initializeElements();
		this.setupEventListeners();
	}

	private initializeElements() {
		this.elements = {
			uploadSection: document.getElementById("upload-section"),
			previewSection: document.getElementById("preview-section"),
			previewContainer: document.getElementById("preview-container"),
			lottieContainer: document.getElementById("lottie-container"),
			frameSlider: document.querySelector('input[name="frame-slider"]') as HTMLInputElement,
			currentFrameSpan: document.getElementById("current-frame") as HTMLSpanElement,
			totalFramesSpan: document.getElementById("total-frames") as HTMLSpanElement,
			aggressiveOptimizationCheckbox: document.getElementById("aggressive-optimization") as HTMLButtonElement,
			downloadBtn: document.getElementById("download-btn") as HTMLButtonElement,
			playBtn: document.getElementById("play-btn") as HTMLButtonElement,
			loopCheckbox: document.getElementById("loop-toggle-switch") as HTMLButtonElement,
			// Starwind Select builds a hidden select with the provided name
			exportFormatSelect: document.querySelector('select[name="export-format"]') as HTMLSelectElement,
			compressionSlider: document.querySelector('input[name="compression-level"]') as HTMLInputElement,
			rasterScaleSlider: document.querySelector('input[name="raster-scale"]') as HTMLInputElement,
			detailDuration: document.getElementById("detail-duration"),
			detailFrames: document.getElementById("detail-frames"),
			detailFps: document.getElementById("detail-fps"),
			detailDimensions: document.getElementById("detail-dimensions"),
			detailSize: document.getElementById("detail-size"),
			ignoreOpacitySwitch: document.getElementById("ignore-opacity-switch") as HTMLButtonElement,
		};
	}

	private setupEventListeners() {
		this.setupFileUpload();
		this.setupFrameSlider();
		// trim-empty-space removed
		this.setupDownloadButton();
		this.setupPlaybackControls();
		this.setupZoomControls();
		this.setupWheelZoom();
		this.setupPanControls();
		this.setupFrameToggle();
		this.setupIgnoreOpacityToggle();
	}

	private setupIgnoreOpacityToggle() {
		const switchEl = this.elements.ignoreOpacitySwitch as HTMLButtonElement | null;
		if (!switchEl) return;
		// Restore saved preference using unified system
		this.state.ignoreOpacity = getPreference("ignore-opacity");
		const setUi = (on: boolean) => {
			switchEl.setAttribute("aria-checked", on ? "true" : "false");
		};
		setUi(this.state.ignoreOpacity || false);
		// Apply immediately if SVG is present
		this.applyOpacityOverride();
		switchEl.addEventListener("starwind-switch:change", (e: Event) => {
			const detail = (e as CustomEvent).detail as { checked: boolean } | undefined;
			if (!detail) return;
			this.state.ignoreOpacity = detail.checked;
			setUi(this.state.ignoreOpacity || false);
			setPreference("ignore-opacity", this.state.ignoreOpacity || false);
			this.applyOpacityOverride();
		});
	}

	private applyOpacityOverride() {
		const container = this.elements.lottieContainer as HTMLElement | null;
		if (!container) return;
		const svg = container.querySelector("svg") as SVGSVGElement | null;
		if (!svg) return;
		// Manage a dedicated style element
		let styleEl = svg.querySelector('style[data-ignore-opacity="true"]') as HTMLStyleElement | null;
		if (this.state.ignoreOpacity) {
			if (!styleEl) {
				styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style") as unknown as HTMLStyleElement;
				styleEl.setAttribute("data-ignore-opacity", "true");
				svg.appendChild(styleEl);
			}
			styleEl.textContent = `*{opacity:1 !important}`;
		} else {
			if (styleEl) styleEl.remove();
		}
	}

	private computeFitScale(): number | null {
		const container = this.elements.previewContainer as HTMLElement | null;
		const width = this.state.width || 0;
		const height = this.state.height || 0;
		if (!container || !width || !height) return null;
		const rect = container.getBoundingClientRect();
		if (!rect.width || !rect.height) return null;
		const pad = this.getFitPaddingPx();
		const availW = Math.max(1, rect.width - (pad.left + pad.right));
		const availH = Math.max(1, rect.height - (pad.top + pad.bottom));
		return Math.min(availW / width, availH / height);
	}

	private getCurrentScale(): number {
		if (this.state.zoomMode === "fixed") {
			const p = this.state.zoomPercent || 100;
			return Math.max(0.02, Math.min(32, p / 100));
		}
		return this.computeFitScale() || 1;
	}

	private updateFrameOutlineAppearance() {
		if (!this.frameOutlineOn) return;
		const svg = this.elements.lottieContainer?.querySelector("svg") as SVGSVGElement | null;
		if (!svg) return;
		const rect = svg.querySelector('rect[data-frame-overlay="true"]') as SVGRectElement | null;
		if (!rect) return;
		const scale = this.getCurrentScale();
		// Keep outline visually consistent regardless of zoom scale
		const desiredWidthPx = 2;
		const desiredDashPx = 10;
		const desiredGapPx = 6;
		const strokeWidth = desiredWidthPx / scale;
		const dash = desiredDashPx / scale;
		const gap = desiredGapPx / scale;
		rect.setAttribute("stroke-width", String(strokeWidth));
		rect.setAttribute("stroke-dasharray", `${dash},${gap}`);
	}

	private getRemInPixels(): number {
		const root = document.documentElement;
		const fontSize = getComputedStyle(root).fontSize;
		const value = parseFloat(fontSize || "16");
		return Number.isFinite(value) ? value : 16;
	}

	private getFitPaddingPx(): { left: number; right: number; top: number; bottom: number } {
		// pl-80 (20rem), pr-80 (20rem), pb-20 (5rem), pt-0
		const rem = this.getRemInPixels();
		return {
			left: 20 * rem,
			right: 20 * rem,
			top: 0,
			bottom: 5 * rem,
		};
	}

	private setupFileUpload() {
		const dropzoneInput = document.querySelector('input[name="lottie-file"]') as HTMLInputElement;
		if (dropzoneInput) {
			dropzoneInput.addEventListener("change", this.handleFileUpload.bind(this));
		}

		// Handle drag and drop
		const dropzone = document.querySelector("[data-dropzone]") || document.querySelector(".dropzone");
		if (dropzone) {
			dropzone.addEventListener("dragover", (e: Event) => {
				e.preventDefault();
				dropzone.classList.add("drag-over");
			});

			dropzone.addEventListener("dragleave", (e: Event) => {
				e.preventDefault();
				dropzone.classList.remove("drag-over");
			});

			dropzone.addEventListener("drop", (e: Event) => {
				e.preventDefault();
				dropzone.classList.remove("drag-over");
				const files = (e as DragEvent).dataTransfer?.files;
				if (files && files.length > 0) {
					this.handleFile(files[0]);
				}
			});
		}
	}

	private setupFrameSlider() {
		// Look for the new starwind slider input (hidden range input)
		const sliderInput = document.querySelector('input[name="frame-slider"]') as HTMLInputElement;
		if (sliderInput) {
			this.elements.frameSlider = sliderInput;
			sliderInput.addEventListener("input", (e: Event) => {
				const target = e.target as HTMLInputElement;
				this.state.currentFrame = parseInt(target.value);
				if (this.elements.currentFrameSpan) {
					this.elements.currentFrameSpan.textContent = this.state.currentFrame.toString();
				}
				if (this.state.animationInstance) {
					this.state.animationInstance.goToAndStop(this.state.currentFrame, true);
					this.applyZoom();
				}
				this.touchRecentIfNeeded();
			});
		}
	}

	private setupPlaybackControls() {
		// Loop state from switch (aria-checked). Page script handles toggling and calling setLoop.
		const loopSwitch = document.getElementById("loop-toggle-switch") as HTMLButtonElement | null;
		if (loopSwitch) {
			this.state.isLooping = loopSwitch.getAttribute("aria-checked") !== "false";
		}

		// Play/Pause button
		if (this.elements.playBtn) {
			this.elements.playBtn.addEventListener("click", () => {
				if (!this.state.animationInstance) return;
				if (this.state.isPlaying) {
					this.pause();
				} else {
					this.play();
				}
			});
			this.updatePlayButtonUI();
		}
	}

	// setupStripCheckbox removed

	private setupDownloadButton() {
		this.elements.downloadBtn?.addEventListener("click", () => {
			this.downloadCurrentFrame();
		});
	}

	private handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			this.handleFile(file);
		}
	}

	private handleFile(file: File) {
		const lower = file.name.toLowerCase();
		const isJson = lower.endsWith(".json");
		const isSvg = lower.endsWith(".svg");
		if (!isJson && !isSvg) {
			alert("Please select a .json (Lottie) or .svg file");
			return;
		}

		// Store the original filename (strip extension) and ext
		this.state.originalFilename = isJson ? file.name.replace(/\.json$/i, "") : file.name.replace(/\.svg$/i, "");
		this.state.originalFileExt = isJson ? ".json" : ".svg";

		// store file size for details panel
		this.state.fileSizeBytes = file.size;

		// Track current file for recent files management
		this.currentFileName = file.name;
		this.currentFileSize = file.size;

		const reader = new FileReader();
		reader.onload = (e) => {
			const result = e.target?.result;
			if (typeof result !== "string") return;
			if (isJson) {
				try {
					this.state.animationData = JSON.parse(result);
					this.loadLottieAnimation();
					try {
						saveRecentFile(file.name, file.size, result);
					} catch {}
				} catch (error) {
					alert("Invalid JSON file. Please select a valid Lottie animation file.");
					console.error("JSON parse error:", error);
				}
			} else if (isSvg) {
				this.loadStaticSVG(result, file.name);
				try {
					saveRecentFile(file.name, file.size, result);
				} catch {}
			}
		};
		reader.readAsText(file);
	}

	// Public method: load from a JSON string (used by Recent Files)
	public loadFromJSONString(filename: string, size: number, json: string) {
		try {
			this.state.originalFilename = filename.replace(/\.(json|svg)$/i, "");
			this.state.originalFileExt = filename.toLowerCase().endsWith(".svg") ? ".svg" : ".json";
			this.state.animationData = JSON.parse(json);
			// Preserve list order on open; only update on user interaction
			this.state.fileSizeBytes = size;

			// Track current file for recent files management
			this.currentFileName = filename;
			this.currentFileSize = size;

			this.loadLottieAnimation();
		} catch (error) {
			alert("Failed to load saved file.");
			console.error("loadFromJSONString error:", error);
		}
	}

	// Public method: load a raw SVG string (used for direct SVGs and recents)
	public loadFromSVGString(filename: string, size: number, svg: string) {
		this.state.originalFilename = filename.replace(/\.(json|svg)$/i, "");
		this.state.originalFileExt = ".svg";
		this.state.fileSizeBytes = size;

		// Track current file for recent files management
		this.currentFileName = filename;
		this.currentFileSize = size;

		this.loadStaticSVG(svg, filename);
	}

	private loadStaticSVG(svgString: string, filenameForDetails: string) {
		if (!this.elements.lottieContainer) return;
		// Clear any Lottie instance
		if (this.state.animationInstance) {
			this.state.animationInstance.destroy();
			this.state.animationInstance = null;
		}
		this.elements.lottieContainer.innerHTML = svgString;
		(this.elements.lottieContainer as HTMLElement).style.visibility = "hidden";

		// Extract dimensions from viewBox or width/height
		const svg = this.elements.lottieContainer.querySelector("svg") as SVGSVGElement | null;
		if (!svg) return;
		let width = 0;
		let height = 0;
		if (svg.viewBox && svg.viewBox.baseVal) {
			width = svg.viewBox.baseVal.width || 0;
			height = svg.viewBox.baseVal.height || 0;
		}
		if ((!width || !height) && svg.getAttribute("width") && svg.getAttribute("height")) {
			const wAttr = svg.getAttribute("width") || "0";
			const hAttr = svg.getAttribute("height") || "0";
			const toPx = (val: string) => parseFloat(String(val).replace(/[^0-9.]+/g, "")) || 0;
			width = toPx(wAttr);
			height = toPx(hAttr);
		}
		this.state.width = width || this.state.width;
		this.state.height = height || this.state.height;
		this.state.totalFrames = 0;
		this.state.currentFrame = 0;
		// Update details panel for static SVG
		this.state.fps = undefined;
		this.updateDetailsPanel();

		// Hide upload, show preview
		if (this.elements.previewSection) this.elements.previewSection.classList.remove("hidden");
		if (this.elements.uploadSection) this.elements.uploadSection.classList.add("hidden");

		// Disable play and frame-specific controls for static SVG
		this.state.isPlaying = false;
		this.updatePlayButtonUI();
		if (this.elements.frameSlider) {
			this.elements.frameSlider.value = "0";
			this.elements.frameSlider.max = "0";
		}
		if (this.elements.totalFramesSpan) this.elements.totalFramesSpan.textContent = "0";
		if (this.elements.currentFrameSpan) this.elements.currentFrameSpan.textContent = "0";
		this.updateFrameNumberWidths();

		// Ensure fit/zoom styles are applied
		this.applyZoom();
		this.waitForSvgAndReveal();

		// Enable download and play button
		if (this.elements.downloadBtn) this.elements.downloadBtn.disabled = false;
		if (this.elements.playBtn) this.elements.playBtn.disabled = false;

		// Dispatch event to notify UI about file type change
		document.dispatchEvent(new CustomEvent("lottie:fileLoaded", { detail: { isSVG: true } }));
	}

	private loadLottieAnimation() {
		if (!this.elements.lottieContainer || !this.state.animationData) return;

		// Clear previous animation
		if (this.state.animationInstance) {
			this.state.animationInstance.destroy();
		}
		this.elements.lottieContainer.innerHTML = "";
		// Hide during initial layout to avoid scale flash until SVG is ready
		(this.elements.lottieContainer as HTMLElement).style.visibility = "hidden";

		// Load new animation
		this.state.animationInstance = lottie.loadAnimation({
			container: this.elements.lottieContainer,
			renderer: "svg",
			loop: this.state.isLooping,
			autoplay: false,
			animationData: this.state.animationData,
		});

		this.state.animationInstance.addEventListener("DOMLoaded", () => {
			if (!this.state.animationInstance) return;
			// Reset pan on new load
			this.panOffsetX = 0;
			this.panOffsetY = 0;
			// Set panning cursor when ready
			if (this.elements.previewContainer) {
				(this.elements.previewContainer as HTMLElement).style.cursor = "grab";
			}

			this.state.totalFrames = this.state.animationInstance.totalFrames - 1;
			// Pull details from raw data if present
			const data = this.state.animationData as any;
			this.state.fps = Number(data?.fr) || this.state.fps;
			this.state.width = Number(data?.w) || this.state.width;
			this.state.height = Number(data?.h) || this.state.height;

			// Reset to frame 0 for each new load BEFORE updating max to avoid stale slider value
			this.state.currentFrame = 0;
			if (this.elements.frameSlider) {
				this.elements.frameSlider.value = "0";
				// Sync Starwind slider knob position if available
				if ((window as any).StarwindSlider && typeof (window as any).StarwindSlider.setValue === "function") {
					(window as any).StarwindSlider.setValue(this.elements.frameSlider.name, 0);
				}
			}

			// Update slider max after resetting value
			this.updateSliderMax(this.state.totalFrames);
			if (this.elements.totalFramesSpan) {
				this.elements.totalFramesSpan.textContent = this.state.totalFrames.toString();
			}
			// Keep '/' centered by reserving equal width for both numbers
			this.updateFrameNumberWidths();

			// Ensure SVG fits properly within container (may run before SVG exists)
			this.applyZoom();
			// Reveal as soon as the SVG is present
			this.waitForSvgAndReveal();

			// Update zoom label now that dimensions are known
			setTimeout(() => {
				if (this.state.zoomMode === "fit") {
					const percent = this.computeFitPercent();
					if (percent) {
						this.updateTriggerLabel(Math.round(percent));
					}
				} else {
					this.updateTriggerLabel(this.state.zoomPercent || 100);
				}
			}, 50);

			// Show preview section and hide upload section
			if (this.elements.previewSection) {
				this.elements.previewSection.classList.remove("hidden");
			}
			if (this.elements.uploadSection) {
				this.elements.uploadSection.classList.add("hidden");
			}

			// Enable download and play button
			if (this.elements.downloadBtn) {
				this.elements.downloadBtn.disabled = false;
			}
			if (this.elements.playBtn) {
				this.elements.playBtn.disabled = false;
			}

			// Go to first frame (already set to 0 above) after ensuring SVG exists
			this.state.animationInstance.goToAndStop(0, true);
			this.applyZoom();
			if (this.elements.currentFrameSpan) {
				this.elements.currentFrameSpan.textContent = this.state.currentFrame.toString();
			}

			// Sync current frame while playing
			this.state.animationInstance?.addEventListener("enterFrame", () => {
				if (!this.state.animationInstance) return;
				const frame = Math.round((this.state.animationInstance as AnimationItem).currentFrame || 0);
				this.state.currentFrame = frame;
				if (this.elements.currentFrameSpan) {
					this.elements.currentFrameSpan.textContent = frame.toString();
				}
				if (this.elements.frameSlider) {
					this.elements.frameSlider.value = frame.toString();
					// Update Starwind slider UI without triggering input handlers
					if ((window as any).StarwindSlider && typeof (window as any).StarwindSlider.setValue === "function") {
						(window as any).StarwindSlider.setValue(this.elements.frameSlider.name, frame);
					}
				}
			});

			// Handle completion when not looping
			this.state.animationInstance?.addEventListener("complete", () => {
				if (!this.state.isLooping) {
					this.state.isPlaying = false;
					this.updatePlayButtonUI();
				}
			});

			// Ensure loop flag is applied to instance
			(this.state.animationInstance as AnimationItem).loop = this.state.isLooping;

			// Reset play state on new load
			this.state.isPlaying = false;
			this.updatePlayButtonUI();
			// Update details panel now that all values are known
			this.updateDetailsPanel();

			// Dispatch event to notify UI about file type change
			document.dispatchEvent(new CustomEvent("lottie:fileLoaded", { detail: { isSVG: false } }));
		});
	}

	private touchRecentIfNeeded() {
		if (this.hasInteractedSinceLoad) return;
		const ext = this.state.originalFileExt || ".json";
		const name = this.state.originalFilename ? `${this.state.originalFilename}${ext}` : undefined;
		const size = this.state.fileSizeBytes;
		if (name && typeof size === "number") {
			try {
				touchRecent(name, size);
			} catch {}
			this.hasInteractedSinceLoad = true;
		}
	}

	private updateDetailsPanel() {
		const isSVG = this.isSVGLoaded();

		// Animation-specific fields (only for Lottie files)
		if (!isSVG) {
			const seconds = this.state.fps && this.state.totalFrames ? (this.state.totalFrames / this.state.fps).toFixed(1) : "—";
			if (this.elements.detailDuration) this.elements.detailDuration.textContent = typeof seconds === "string" ? `${seconds} seconds` : "—";
			if (this.elements.detailFrames) this.elements.detailFrames.textContent = String(this.state.totalFrames || "—");
			if (this.elements.detailFps) this.elements.detailFps.textContent = this.state.fps ? `${this.state.fps} fps` : "—";
		} else {
			// Clear animation-specific fields for SVG files
			if (this.elements.detailDuration) this.elements.detailDuration.textContent = "—";
			if (this.elements.detailFrames) this.elements.detailFrames.textContent = "—";
			if (this.elements.detailFps) this.elements.detailFps.textContent = "—";
		}

		// Common fields (always updated)
		if (this.elements.detailDimensions)
			this.elements.detailDimensions.textContent = this.state.width && this.state.height ? `${this.state.width} × ${this.state.height} px` : "—";
		if (this.elements.detailSize)
			this.elements.detailSize.textContent = this.state.fileSizeBytes ? `${Math.round((this.state.fileSizeBytes || 0) / 1024)} KB` : "—";
	}

	// Reserve equal width for current/total frame spans so '/' remains centered
	private updateFrameNumberWidths() {
		const currentEl = this.elements.currentFrameSpan as HTMLSpanElement | null;
		const totalEl = this.elements.totalFramesSpan as HTMLSpanElement | null;
		if (!currentEl || !totalEl) return;
		const total = this.state.totalFrames || 0;
		const digits = Math.max(1, String(total).length);
		const widthCh = `${digits}ch`;
		currentEl.style.minWidth = widthCh;
		totalEl.style.minWidth = widthCh;
		currentEl.style.fontVariantNumeric = "tabular-nums";
		totalEl.style.fontVariantNumeric = "tabular-nums";
	}

	private async downloadCurrentFrame() {
		if (!this.elements.lottieContainer) return;

		try {
			this.touchRecentIfNeeded();
			// Get the SVG from the container
			const svgElement = this.elements.lottieContainer.querySelector("svg") as SVGSVGElement;
			if (!svgElement) {
				alert("No SVG found. Please ensure the animation is loaded.");
				return;
			}

			// Serialize a clean export-ready SVG (remove preview transforms/overlays, enforce original dimensions)
			const svgString = this.buildExportableSVGString(svgElement);

			// Decide format
			const format = (this.elements.exportFormatSelect?.value || "svg") as "svg" | "png" | "jpeg";
			const baseFilename = this.state.originalFilename || "graphic";
			if (format === "svg") {
				const isAnimated = !!this.state.animationInstance;
				const filename = isAnimated ? `${baseFilename}-${this.state.currentFrame}-frame.svg` : `${baseFilename}.svg`;
				// Let the download helper handle cleaning/optimization
				downloadSVG(svgString, filename, this.getConversionOptions().aggressiveOptimization);
			} else {
				// Compression slider 0..100 mapped to JPEG quality 0..1
				const level = parseInt(this.elements.compressionSlider?.value || "80", 10);
				const quality = Math.max(0, Math.min(1, level / 100));
				// Raster scale from resolution slider
				const scaleSteps = [0.25, 0.5, 1, 2, 4, 8];
				let scaleIdx = parseInt(this.elements.rasterScaleSlider?.value || "2", 10);
				if (!Number.isFinite(scaleIdx)) scaleIdx = 2;
				// Treat leftmost (0) as 1x to match UI behavior
				if (scaleIdx === 0) scaleIdx = 2;
				const scale = scaleSteps[Math.max(0, Math.min(scaleSteps.length - 1, scaleIdx))];
				const isAnimated = !!this.state.animationInstance;
				const nameNoExt = isAnimated ? `${baseFilename}-${this.state.currentFrame}-frame` : `${baseFilename}`;
				await downloadRasterFromSVG(svgString, nameNoExt, format, quality, scale);
			}
		} catch (error) {
			alert("Error generating SVG. Please try again.");
			console.error("Download error:", error);
		}
	}

	// Create a clean, export-ready SVG string that reflects the original animation dimensions
	private buildExportableSVGString(originalSvg: SVGSVGElement): string {
		// Clone to avoid mutating the live preview
		const svg = originalSvg.cloneNode(true) as SVGSVGElement;

		// Remove frame overlay if present
		const overlay = svg.querySelector('rect[data-frame-overlay="true"]');
		if (overlay) overlay.remove();

		// Remove preview-only ignore-opacity style if present
		const ignoreOpacityStyle = svg.querySelector('style[data-ignore-opacity="true"]');
		if (ignoreOpacityStyle) ignoreOpacityStyle.remove();

		// Strip preview styling that repositions/scales the root SVG
		svg.removeAttribute("style");
		svg.style.cssText = "";

		// Enforce original dimensions
		const width = this.state.width || svg.viewBox?.baseVal?.width || 0;
		const height = this.state.height || svg.viewBox?.baseVal?.height || 0;
		if (width && height) {
			svg.setAttribute("width", String(Math.round(width)));
			svg.setAttribute("height", String(Math.round(height)));
			// Ensure a correct viewBox exists
			svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
		}
		// Use a standard aspect ratio behavior
		svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

		// Serialize
		const serializer = new XMLSerializer();
		return serializer.serializeToString(svg);
	}

	private fitToContainer(svgElement: SVGSVGElement) {
		// Absolutely position intrinsic-sized SVG and scale to fit via transform
		const width = this.state.width || svgElement.viewBox?.baseVal?.width || 0;
		const height = this.state.height || svgElement.viewBox?.baseVal?.height || 0;
		svgElement.style.position = "absolute";
		const pad = this.getFitPaddingPx();
		const xShift = (pad.left - pad.right) / 2;
		const yShift = (pad.top - pad.bottom) / 2;
		svgElement.style.left = `calc(50% + ${((this.panOffsetX || 0) + xShift).toFixed(2)}px)`;
		svgElement.style.top = `calc(50% + ${((this.panOffsetY || 0) + yShift).toFixed(2)}px)`;
		svgElement.style.transformOrigin = "center center";
		svgElement.style.objectFit = "contain";
		svgElement.style.maxWidth = "none";
		svgElement.style.maxHeight = "none";
		svgElement.style.width = width ? `${width}px` : "auto";
		svgElement.style.height = height ? `${height}px` : "auto";
		svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
		const container = this.elements.lottieContainer as HTMLElement;
		const rect = container.getBoundingClientRect();
		const availW = Math.max(1, rect.width - (pad.left + pad.right));
		const availH = Math.max(1, rect.height - (pad.top + pad.bottom));
		const scale = width && height ? Math.min(availW / width, availH / height) : 1;
		svgElement.style.transform = `translate(-50%, -50%) scale(${scale})`;
	}

	private setFixedZoom(svgElement: SVGSVGElement, percent: number) {
		const width = this.state.width || svgElement.viewBox?.baseVal?.width || 0;
		const height = this.state.height || svgElement.viewBox?.baseVal?.height || 0;
		svgElement.style.position = "absolute";
		const pad = this.getFitPaddingPx();
		const xShift = (pad.left - pad.right) / 2;
		const yShift = (pad.top - pad.bottom) / 2;
		svgElement.style.left = `calc(50% + ${((this.panOffsetX || 0) + xShift).toFixed(2)}px)`;
		svgElement.style.top = `calc(50% + ${((this.panOffsetY || 0) + yShift).toFixed(2)}px)`;
		svgElement.style.transformOrigin = "center center";
		svgElement.style.objectFit = "contain";
		svgElement.style.maxWidth = "none";
		svgElement.style.maxHeight = "none";
		svgElement.style.width = width ? `${width}px` : "auto";
		svgElement.style.height = height ? `${height}px` : "auto";
		svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
		const scale = Math.max(0.02, Math.min(32, percent / 100));
		svgElement.style.transform = `translate(-50%, -50%) scale(${scale})`;
	}

	private updateTriggerLabel(percent: number) {
		const zoomContainer = document.getElementById("preview-zoom");
		const trigger = zoomContainer?.querySelector(".starwind-select-trigger span");
		if (trigger) {
			trigger.textContent = `${percent}%`;
		}
	}

	private waitForSvgAndReveal() {
		const container = this.elements.lottieContainer as HTMLElement | null;
		if (!container) return;
		const reveal = () => {
			this.applyZoom();
			this.applyFrameOutline();
			this.updateFrameOutlineAppearance();
			this.applyOpacityOverride();
			container.style.visibility = "visible";
		};
		// If SVG already exists, reveal immediately
		if (container.querySelector("svg")) {
			reveal();
			return;
		}
		// Otherwise, observe for the first SVG insertion
		const observer = new MutationObserver(() => {
			if (container.querySelector("svg")) {
				reveal();
				observer.disconnect();
			}
		});
		observer.observe(container, { childList: true, subtree: true });
	}

	private frameOutlineOn: boolean = false;

	private setupFrameToggle() {
		const switchEl = document.getElementById("frame-toggle-switch") as HTMLButtonElement | null;
		if (!switchEl) return;
		// Restore saved preference using unified system
		this.frameOutlineOn = getPreference("show-frame");
		const setUi = (on: boolean) => {
			switchEl.setAttribute("aria-checked", on ? "true" : "false");
		};
		setUi(this.frameOutlineOn);
		// Apply on init in case SVG is already present
		this.applyFrameOutline();
		switchEl.addEventListener("starwind-switch:change", (e: Event) => {
			const detail = (e as CustomEvent).detail as { checked: boolean } | undefined;
			if (!detail) return;
			this.frameOutlineOn = detail.checked;
			setUi(this.frameOutlineOn);
			// Persist preference using unified system
			setPreference("show-frame", this.frameOutlineOn);
			this.applyFrameOutline();
		});
	}

	private applyFrameOutline() {
		const svg = this.elements.lottieContainer?.querySelector("svg") as SVGSVGElement | null;
		if (!svg) return;
		// Ensure a single overlay rect exists, toggle its visibility
		let rect = svg.querySelector('rect[data-frame-overlay="true"]') as SVGRectElement | null;
		if (!this.frameOutlineOn) {
			if (rect) rect.remove();
			return;
		}
		const width = this.state.width || svg.viewBox?.baseVal?.width || 0;
		const height = this.state.height || svg.viewBox?.baseVal?.height || 0;
		if (!width || !height) return;
		if (!rect) {
			rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
			rect.setAttribute("data-frame-overlay", "true");
			rect.setAttribute("fill", "none");
			rect.setAttribute("pointer-events", "none");
			rect.setAttribute("shape-rendering", "crispEdges");
			// width and dash will be normalized after zoom is applied
			rect.setAttribute("stroke", "currentColor");
			// Put on top without interfering with content order too much
			svg.appendChild(rect);
		}
		rect.setAttribute("x", "0");
		rect.setAttribute("y", "0");
		rect.setAttribute("width", String(width));
		rect.setAttribute("height", String(height));
		this.updateFrameOutlineAppearance();
	}

	private computeFitPercent(): number | null {
		const container = this.elements.previewContainer as HTMLElement | null;
		const width = this.state.width || 0;
		const height = this.state.height || 0;
		if (!container || !width || !height) {
			return null;
		}
		const rect = container.getBoundingClientRect();
		if (!rect.width || !rect.height) {
			return null;
		}
		const pad = this.getFitPaddingPx();
		const availW = Math.max(1, rect.width - (pad.left + pad.right));
		const availH = Math.max(1, rect.height - (pad.top + pad.bottom));
		const scale = Math.min(availW / width, availH / height);
		const percent = Math.max(0.02, Math.min(32, scale)) * 100;
		return percent;
	}

	private applyZoom() {
		if (!this.elements.lottieContainer) return;
		const svgElement = this.elements.lottieContainer.querySelector("svg") as SVGSVGElement;
		if (!svgElement) return;

		if (this.state.zoomMode === "fit") {
			this.fitToContainer(svgElement);
		} else {
			const p = this.state.zoomPercent || 100;
			this.setFixedZoom(svgElement, p);
		}
		this.updateFrameOutlineAppearance();
	}

	private setupZoomControls() {
		const zoomContainer = document.getElementById("preview-zoom");
		if (!zoomContainer) return;

		// Initialize trigger label
		const initializeLabel = () => {
			if (this.state.zoomMode === "fit") {
				const percent = this.computeFitPercent();
				if (percent) {
					this.updateTriggerLabel(Math.round(percent));
				}
			} else {
				this.updateTriggerLabel(this.state.zoomPercent || 100);
			}
		};

		const setModeFit = () => {
			this.state.zoomMode = "fit";
			// Reset pan when switching to fit
			this.panOffsetX = 0;
			this.panOffsetY = 0;
			this.applyZoom();
			// Update label with actual fit percentage
			const percent = this.computeFitPercent();
			if (percent) this.updateTriggerLabel(Math.round(percent));
			this.updateFrameOutlineAppearance();
		};

		const setPercent = (percent: number) => {
			this.state.zoomMode = "fixed";
			this.state.zoomPercent = percent;
			this.applyZoom();
			this.updateTriggerLabel(percent);
			this.updateFrameOutlineAppearance();
		};

		const handleSelectChange = (value: string) => {
			const currentPercent = this.state.zoomMode === "fixed" ? this.state.zoomPercent || 100 : Math.round(this.computeFitPercent() || 100);

			switch (value) {
				case "zoom-in":
					const nextIn = currentPercent >= 200 ? 400 : currentPercent >= 100 ? 200 : currentPercent >= 50 ? 100 : 50;
					setPercent(nextIn);
					break;
				case "zoom-out":
					const nextOut = currentPercent <= 50 ? 25 : currentPercent <= 100 ? 50 : currentPercent <= 200 ? 100 : 200;
					setPercent(nextOut);
					break;
				case "fit":
					setModeFit();
					break;
				default:
					const numeric = parseInt(value, 10);
					if (!Number.isNaN(numeric)) {
						setPercent(numeric);
					}
			}
		};

		// Listen for selection changes
		zoomContainer.addEventListener("starwind-select:change", (e: Event) => {
			const detail = (e as CustomEvent).detail as { value: string } | undefined;
			if (detail) {
				handleSelectChange(detail.value);

				// Force update the trigger label after selection
				requestAnimationFrame(() => {
					initializeLabel();
				});
			}
		});

		// Initialize label on setup
		setTimeout(initializeLabel, 100);

		// Re-apply on resize if in fit mode
		window.addEventListener(
			"resize",
			() => {
				if (this.state.zoomMode === "fit") {
					this.applyZoom();
					initializeLabel();
					this.updateFrameOutlineAppearance();
				}
			},
			{ passive: true },
		);
	}

	private setupPanControls() {
		const container = this.elements.previewContainer as HTMLElement | null;
		if (!container) return;

		const zoomUi = document.getElementById("preview-zoom");

		const shouldIgnoreTarget = (target: EventTarget | null) => {
			if (!(target instanceof HTMLElement)) return false;
			return !!(zoomUi && zoomUi.contains(target));
		};

		container.addEventListener("mousedown", (e: MouseEvent) => {
			// Left button only and ignore interactive overlay
			if (e.button !== 0 || shouldIgnoreTarget(e.target)) return;
			this.isPanning = true;
			this.lastClientX = e.clientX;
			this.lastClientY = e.clientY;
			container.style.cursor = "grabbing";
			// Prevent text selection
			e.preventDefault();
		});

		window.addEventListener(
			"mousemove",
			(e: MouseEvent) => {
				if (!this.isPanning) return;
				const dx = e.clientX - this.lastClientX;
				const dy = e.clientY - this.lastClientY;
				this.lastClientX = e.clientX;
				this.lastClientY = e.clientY;
				this.panOffsetX = (this.panOffsetX || 0) + dx;
				this.panOffsetY = (this.panOffsetY || 0) + dy;
				this.applyZoom();
			},
			{ passive: true },
		);

		const endPan = () => {
			if (!this.isPanning) return;
			this.isPanning = false;
			container.style.cursor = "grab";
		};

		window.addEventListener("mouseup", endPan, { passive: true });
		container.addEventListener("mouseleave", endPan, { passive: true });

		// Double-click to reset pan
		container.addEventListener("dblclick", (e: MouseEvent) => {
			if (shouldIgnoreTarget(e.target)) return;
			this.panOffsetX = 0;
			this.panOffsetY = 0;
			this.applyZoom();
		});
	}

	private setupWheelZoom() {
		const container = this.elements.previewContainer as HTMLElement | null;
		if (!container) return;

		const zoomUi = document.getElementById("preview-zoom");

		const shouldIgnoreTarget = (target: EventTarget | null) => {
			if (!(target instanceof HTMLElement)) return false;
			return !!(zoomUi && zoomUi.contains(target));
		};

		container.addEventListener(
			"wheel",
			(e: WheelEvent) => {
				// Ignore wheel over UI elements
				if (shouldIgnoreTarget(e.target)) return;
				// Prevent page scroll while zooming
				e.preventDefault();

				// No SVG yet
				if (!this.elements.lottieContainer || !this.elements.lottieContainer.querySelector("svg")) return;

				// Determine current and next zoom percent
				const oldScale = this.getCurrentScale();
				let basePercent: number;
				if (this.state.zoomMode === "fit") {
					basePercent = Math.round(this.computeFitPercent() || 100);
				} else {
					basePercent = this.state.zoomPercent || 100;
				}

				// Zoom sensitivity: scale multiplicative per wheel delta
				// Normalize delta: positive deltaY => zoom out, negative => zoom in
				const delta = e.deltaY;
				const zoomFactorPerStep = 1.1; // ~10% per notch
				const steps = Math.max(-4, Math.min(4, Math.round(delta / 100)));
				const factor = steps === 0 ? (delta < 0 ? 1 / zoomFactorPerStep : zoomFactorPerStep) : Math.pow(zoomFactorPerStep, steps);
				const newPercentRaw = basePercent * (1 / factor);
				const newPercent = Math.max(2, Math.min(3200, Math.round(newPercentRaw)));

				// Set to fixed zoom mode
				this.state.zoomMode = "fixed";
				this.state.zoomPercent = newPercent;

				// Adjust pan so zoom pivots around the SCREEN CENTER, not the element/cursor
				const newScale = this.getCurrentScale();
				const ratio = newScale / (oldScale || 1);
				const pad = this.getFitPaddingPx();
				const xShift = (pad.left - pad.right) / 2;
				const yShift = (pad.top - pad.bottom) / 2;
				const oldPxFromCenterX = (this.panOffsetX || 0) + xShift;
				const oldPxFromCenterY = (this.panOffsetY || 0) + yShift;
				const newPxFromCenterX = ratio * oldPxFromCenterX;
				const newPxFromCenterY = ratio * oldPxFromCenterY;
				this.panOffsetX = newPxFromCenterX - xShift;
				this.panOffsetY = newPxFromCenterY - yShift;

				this.applyZoom();
				this.updateTriggerLabel(newPercent);
				this.updateFrameOutlineAppearance();
			},
			{ passive: false },
		);
	}

	private getConversionOptions(): ConversionOptions {
		const aggressive = this.elements.aggressiveOptimizationCheckbox?.getAttribute("aria-checked") === "true";
		return {
			aggressiveOptimization: aggressive ?? true,
		};
	}

	private updatePlayButtonUI() {
		if (!this.elements.playBtn) return;
		if (this.state.isPlaying) {
			this.elements.playBtn.innerHTML =
				"<svg class='w-4 h-4 mr-2' fill='currentColor' viewBox='0 0 24 24' aria-hidden='true'><path d='M6 5h4v14H6zM14 5h4v14h-4z'></path></svg><span>Pause</span>";
		} else {
			this.elements.playBtn.innerHTML =
				"<svg class='w-4 h-4 mr-2' fill='currentColor' viewBox='0 0 24 24' aria-hidden='true'><path d='M8 5v14l11-7-11-7z'></path></svg><span>Play</span>";
		}
	}

	public setLoop(loop: boolean) {
		this.state.isLooping = loop;
		if (this.state.animationInstance) {
			(this.state.animationInstance as AnimationItem).loop = loop;
		}
	}

	public play() {
		if (!this.state.animationInstance) return;
		// If at the last frame and not looping, restart
		if (!this.state.isLooping && this.state.currentFrame >= this.state.totalFrames) {
			this.state.animationInstance.goToAndStop(0, true);
		}
		(this.state.animationInstance as AnimationItem).loop = this.state.isLooping;
		this.state.animationInstance.play();
		this.state.isPlaying = true;
		this.updatePlayButtonUI();
		this.touchRecentIfNeeded();
	}

	public pause() {
		if (!this.state.animationInstance) return;
		this.state.animationInstance.pause();
		this.state.isPlaying = false;
		this.updatePlayButtonUI();
	}

	// Public method to set current frame
	public setFrame(frame: number) {
		if (!this.state.animationInstance) return;

		const clampedFrame = Math.max(0, Math.min(frame, this.state.totalFrames));
		this.state.currentFrame = clampedFrame;

		// Update the animation
		this.state.animationInstance.goToAndStop(clampedFrame, true);

		// Ensure zoom persists after frame change
		this.applyZoom();

		// Update UI elements if they exist
		if (this.elements.currentFrameSpan) {
			this.elements.currentFrameSpan.textContent = clampedFrame.toString();
		}

		// Update the slider if it exists
		if (this.elements.frameSlider) {
			this.elements.frameSlider.value = clampedFrame.toString();
			// Trigger the slider UI update
			this.elements.frameSlider.dispatchEvent(new Event("input", { bubbles: true }));
		}
	}

	// Public method to update slider max value
	public updateSliderMax(maxValue: number) {
		if (this.elements.frameSlider) {
			this.elements.frameSlider.max = maxValue.toString();
			this.elements.frameSlider.dispatchEvent(new Event("input", { bubbles: true }));
		}
	}

	// Public method to clear current animation
	public clearAnimation() {
		// Clear animation instance
		if (this.state.animationInstance) {
			this.state.animationInstance.destroy();
			this.state.animationInstance = null;
		}

		// Clear container
		if (this.elements.lottieContainer) {
			this.elements.lottieContainer.innerHTML = "";
		}

		// Reset state
		this.state.animationData = null;
		this.state.totalFrames = 0;
		this.state.currentFrame = 0;
		this.state.originalFilename = null;

		// Clear current file tracking
		this.currentFileName = null;
		this.currentFileSize = null;

		// Reset UI elements
		if (this.elements.currentFrameSpan) {
			this.elements.currentFrameSpan.textContent = "0";
		}
		if (this.elements.totalFramesSpan) {
			this.elements.totalFramesSpan.textContent = "0";
		}
		// Reset widths back to match current total (0 => 1ch)
		this.updateFrameNumberWidths();
		if (this.elements.frameSlider) {
			this.elements.frameSlider.value = "0";
			this.elements.frameSlider.max = "100";
		}
		if (this.elements.downloadBtn) {
			this.elements.downloadBtn.disabled = true;
		}
		if (this.elements.playBtn) {
			this.elements.playBtn.disabled = true;
		}

		// Reset playback state and UI
		this.state.isPlaying = false;
		const loopSwitch = document.getElementById("loop-toggle-switch") as HTMLButtonElement | null;
		this.state.isLooping = loopSwitch ? loopSwitch.getAttribute("aria-checked") !== "false" : true;
		this.updatePlayButtonUI();
	}

	// Public method to reinitialize (useful for Astro page transitions)
	public reinitialize() {
		this.initializeElements();
		this.setupEventListeners();
	}

	// Public method to check if a file is currently open
	public isCurrentFile(filename: string, size: number): boolean {
		return this.currentFileName === filename && this.currentFileSize === size;
	}

	// Public method to check if an SVG file is currently loaded
	public isSVGLoaded(): boolean {
		return this.state.totalFrames === 0 && this.state.animationInstance === null && this.currentFileName !== null;
	}

	// Public method to clear current file and reset UI
	public clearCurrentFile() {
		this.clearAnimation();

		// Show upload section and hide preview section
		if (this.elements.previewSection) this.elements.previewSection.classList.add("hidden");
		if (this.elements.uploadSection) this.elements.uploadSection.classList.remove("hidden");
	}
}
