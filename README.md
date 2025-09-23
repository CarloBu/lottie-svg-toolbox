# Lottie & SVG Preview Toolbox

A powerful web-based toolbox for previewing Lottie animations and converting them to static SVG, PNG, and JPEG formats. Built with Astro and Starwind UI.

## Features

- **Lottie Animation Viewer**: Load and preview Lottie animations with full playback controls
- **SVG File Viewer**: View and inspect SVG files with zoom and pan capabilities
- **Frame-by-Frame Navigation**: Scrub through animation frames with timeline controls
- **Advanced Viewing Controls**: Zoom, pan, and fit-to-screen options for detailed inspection
- **Multi-Format Export**: Export to SVG, PNG (transparent), or JPEG formats
- **Customizable Settings**: Adjust compression, resolution, and optimization options
- **Recent Files**: Quick access to recently opened Lottie and SVG files
- **Local Storage**: Preferences and recent files are saved locally
- **Modern UI**: Clean, responsive interface built with Astro and Tailwind CSS

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lottie-to-svg-converter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:4321`

## How to Use

### Loading Files

1. **Drag & Drop**: Simply drag a `.json` Lottie file or `.svg` file onto the upload area
2. **Click to Browse**: Click the upload area to open a file browser
3. **Recent Files**: Access recently opened files from the left sidebar

### Previewing Animations

- **Lottie Animations**:
  - **Play/Pause**: Use the play button to control animation playback
  - **Frame Navigation**: Use the timeline slider to scrub through frames
  - **Loop Control**: Toggle looping on/off
- **SVG Files**: Static viewing with zoom and pan controls
- **Zoom Controls**: 
  - Use mouse wheel to zoom in/out
  - Click and drag to pan when zoomed
  - Use "Fit to Screen" to reset view

### Exporting Files

1. **Select Format**: Choose from SVG, PNG, or JPEG
2. **Adjust Settings**:
   - **SVG**: Toggle compression for smaller file sizes
   - **PNG/JPEG**: Adjust resolution (1x to 5x) and compression quality
3. **Download**: Click the download button to save your file

## Technical Details

### Built With

- **[Astro](https://astro.build/)** - Modern web framework
- **[Lottie Web](https://github.com/airbnb/lottie-web)** - Animation rendering
- **[Tailwind CSS](https://tailwindcss.com/)** - Styling
- **[SVGO](https://github.com/svg/svgo)** - SVG optimization
- **TypeScript** - Type safety

### Project Structure

```
src/
├── components/
│   ├── leftSidebar/     # Upload and recent files
│   ├── preview/         # Animation canvas and zoom
│   ├── rightSidebar/    # Export and settings panels
│   ├── timeline/        # Animation controls
│   └── starwind/        # Reusable UI components
├── scripts/
│   ├── lottie-converter.ts  # Core conversion logic
│   └── recent-files.ts      # File management
├── utils/
│   ├── svg-utils.ts         # Export utilities
│   └── preferences.ts       # Settings management
└── types/
    └── lottie.ts            # TypeScript definitions
```

## Available Scripts

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Install dependencies                             |
| `npm run dev`             | Start development server at `localhost:4321`     |
| `npm run build`           | Build for production to `./dist/`                |
| `npm run preview`         | Preview production build locally                 |
| `npm run astro ...`       | Run Astro CLI commands                          |

## Use Cases

- **Animation Review**: Preview and inspect Lottie animations before implementation
- **SVG Inspection**: View and analyze SVG files with detailed zoom capabilities
- **Design Workflows**: Review animations and vector graphics for design systems
- **Web Development**: Convert Lottie animations to static assets for faster loading
- **Performance Optimization**: Create lightweight SVG alternatives to heavy animations
- **Cross-Platform Assets**: Generate static images for platforms that don't support Lottie

## Configuration

The application automatically saves your preferences including:
- Export format settings
- Compression levels
- Recent file history
- Viewer preferences (zoom, pan, etc.)

## Supported Formats

### Input
- **Lottie JSON files** (`.json`) - Standard Lottie animation format
- **SVG files** (`.svg`) - Scalable vector graphics format

### Output
- **SVG** - Vector format with optional compression
- **PNG** - Raster format with transparency support
- **JPEG** - Compressed raster format


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Lottie Web](https://github.com/airbnb/lottie-web) by Airbnb for the animation engine
- [Astro](https://astro.build/) for the modern web framework
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
# lottie-svg-toolbox
# lottie-svg-toolbox
