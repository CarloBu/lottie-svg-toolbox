export interface LottieConverterState {
	animationInstance: any | null;
	animationData: any | null;
	totalFrames: number;
	currentFrame: number;
	originalFilename: string | null;
	originalFileExt?: string | null; // includes leading dot, e.g. ".json" or ".svg"
	isPlaying: boolean;
	isLooping: boolean;
	// Details
	fps?: number;
	width?: number;
	height?: number;
	fileSizeBytes?: number;
	// Zoom
	zoomMode?: "fit" | "fixed";
	zoomPercent?: number; // 2..3200
	// Viewer options
	ignoreOpacity?: boolean;
}

export interface ConversionOptions {
	aggressiveOptimization: boolean;
}

export interface DOMElements {
	uploadSection: HTMLElement | null;
	previewSection: HTMLElement | null;
	previewContainer?: HTMLElement | null;
	lottieContainer: HTMLElement | null;
	frameSlider: HTMLInputElement | null;
	currentFrameSpan: HTMLSpanElement | null;
	totalFramesSpan: HTMLSpanElement | null;
	aggressiveOptimizationCheckbox: HTMLButtonElement | null;
	downloadBtn: HTMLButtonElement | null;
	playBtn: HTMLButtonElement | null;
	prevBtn?: HTMLButtonElement | null;
	nextBtn?: HTMLButtonElement | null;
	loopCheckbox: HTMLButtonElement | null;
	// Export controls
	exportFormatSelect: HTMLSelectElement | null;
	compressionSlider: HTMLInputElement | null;
	rasterScaleSlider: HTMLInputElement | null;
	// Details panel elements
	detailDuration?: HTMLElement | null;
	detailFrames?: HTMLElement | null;
	detailFps?: HTMLElement | null;
	detailDimensions?: HTMLElement | null;
	detailSize?: HTMLElement | null;
	// Viewer settings controls
	ignoreOpacitySwitch?: HTMLButtonElement | null;
}
