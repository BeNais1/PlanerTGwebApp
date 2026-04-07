Apple's website is a masterclass in controlled drama — vast expanses of pure black and near-white serve as cinematic backdrops for products that are photographed as if they were sculptures in a gallery. The design philosophy is reductive to its core: every pixel exists in service of the product, and the interface itself retreats until it becomes invisible. This is not minimalism as aesthetic preference; it is minimalism as reverence for the object.

The typography anchors everything. San Francisco (SF Pro Display for large sizes, SF Pro Text for body) is Apple's proprietary typeface, engineered with optical sizing that automatically adjusts letterforms depending on point size. At display sizes (56px), weight 600 with a tight line-height of 1.07 and subtle negative letter-spacing (-0.28px) creates headlines that feel machined rather than typeset — precise, confident, and unapologetically direct. At body sizes (17px), the tracking loosens slightly (-0.374px) and line-height opens to 1.47, creating a reading rhythm that is comfortable without ever feeling slack.

The color story is starkly binary. Product sections alternate between pure black (`#000000`) backgrounds with white text and light gray (`#f5f5f7`) backgrounds with near-black text (`#1d1d1f`). This creates a cinematic pacing — dark sections feel immersive and premium, light sections feel open and informational. The only chromatic accent is Apple Blue (`#0071e3`), reserved exclusively for interactive elements: links, buttons, and focus states. This singular accent color in a sea of neutrals gives every clickable element unmistakable visibility.

**Key Characteristics:**
- SF Pro Display/Text with optical sizing — letterforms adapt automatically to size context
- Binary light/dark section rhythm: black (`#000000`) alternating with light gray (`#f5f5f7`)
- Single accent color: Apple Blue (`#0071e3`) reserved exclusively for interactive elements
- Product-as-hero photography on solid color fields — no gradients, no textures, no distractions
- Extremely tight headline line-heights (1.07-1.14) creating compressed, billboard-like impact
- Full-width section layout with centered content — the viewport IS the canvas
- Pill-shaped CTAs (980px radius) creating soft, approachable action buttons
- Generous whitespace between sections allowing each product moment to breathe

### Primary
- **Pure Black** (`#000000`): Hero section backgrounds, immersive product showcases. The darkest canvas for the brightest products.
- **Light Gray** (`#f5f5f7`): Alternate section backgrounds, informational areas. Not white — the slight blue-gray tint prevents sterility.
- **Near Black** (`#1d1d1f`): Primary text on light backgrounds, dark button fills. Slightly warmer than pure black for comfortable reading.

### Interactive
- **Apple Blue** (`#0071e3`): `--sk-focus-color`, primary CTA backgrounds, focus rings. The ONLY chromatic color in the interface.
- **Link Blue** (`#0066cc`): `--sk-body-link-color`, inline text links. Slightly darker than Apple Blue for text-level readability.
- **Bright Blue** (`#2997ff`): Links on dark backgrounds. Higher luminance for contrast on black sections.

### Text
- **White** (`#ffffff`): Text on dark backgrounds, button text on blue/dark CTAs.
- **Near Black** (`#1d1d1f`): Primary body text on light backgrounds.
- **Black 80%** (`rgba(0, 0, 0, 0.8)`): Secondary text, nav items on light backgrounds. Slightly softened.
- **Black 48%** (`rgba(0, 0, 0, 0.48)`): Tertiary text, disabled states, carousel controls.

### Surface & Dark Variants
- **Dark Surface 1** (`#272729`): Card backgrounds in dark sections.
- **Dark Surface 2** (`#262628`): Subtle surface variation in dark contexts.
- **Dark Surface 3** (`#28282a`): Elevated cards on dark backgrounds.
- **Dark Surface 4** (`#2a2a2d`): Highest dark surface elevation.
- **Dark Surface 5** (`#242426`): Deepest dark surface tone.

### Button States
- **Button Active** (`#ededf2`): Active/pressed state for light buttons.
- **Button Default Light** (`#fafafc`): Search/filter button backgrounds.
- **Overlay** (`rgba(210, 210, 215, 0.64)`): Media control scrims, overlays.
- **White 32%** (`rgba(255, 255, 255, 0.32)`): Hover state on dark modal close buttons.

### Shadows
- **Card Shadow** (`rgba(0, 0, 0, 0.22) 3px 5px 30px 0px`): Soft, diffused elevation for product cards. Offset and wide blur create a natural, photographic shadow.

### Font Family
- **Display**: `SF Pro Display`, with fallbacks: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Body**: `SF Pro Text`, with fallbacks: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- SF Pro Display is used at 20px and above; SF Pro Text is optimized for 19px and below.

### Hierarchy
| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Display Hero | Display | 56px | 600 | 1.07 (tight) | -0.28px | Product launch headlines |
| Section Heading | Display | 40px | 600 | 1.10 (tight) | normal | Feature section titles |
| Tile Heading | Display | 28px | 400 | 1.14 (tight) | 0.196px | Product tile headlines |
| Card Title | Display | 21px | 700 | 1.19 (tight) | 0.231px | Bold card headings |
| Nav Heading | Text | 34px | 600 | 1.47 | -0.374px | Large navigation headings |
| Sub-nav | Text | 24px | 300 | 1.50 | normal | Light sub-navigation text |
| Body | Text | 17px | 400 | 1.47 | -0.374px | Standard reading text |
| Body Emphasis | Text | 17px | 600 | 1.24 (tight) | -0.374px | Emphasized body text |
| Button | Text | 17px | 400 | 2.41 (relaxed)| normal | Standard button text |
| Link | Text | 14px | 400 | 1.43 | -0.224px | Body links, "Learn more" |
| Caption | Text | 14px | 400 | 1.29 (tight) | -0.224px | Secondary text |

### Principles
- **Optical sizing as philosophy**: SF Pro automatically switches between Display and Text optical sizes.
- **Weight restraint**: The scale spans 300 (light) to 700 (bold) but most text lives at 400 (regular) and 600 (semibold). 
- **Negative tracking at all sizes**: Subtle negative letter-spacing even at body sizes.
- **Extreme line-height range**: Headlines compress to 1.07 while body text opens to 1.47.

### Buttons
**Primary Blue (CTA)**
- Background: `#0071e3`
- Text: `#ffffff`
- Padding: 8px 15px
- Radius: 8px
- Hover: background brightens slightly

**Pill Link (Learn More / Shop)**
- Background: transparent
- Text: `#0066cc` (light bg) or `#2997ff` (dark bg)
- Radius: 980px (full pill)
- Border: 1px solid `#0066cc`
- Hover: underline decoration

### Focus / Shadows
- Focus: `2px solid var(--sk-focus-color, #0071E3)` outline
- Card Shadow: `rgba(0, 0, 0, 0.22) 3px 5px 30px 0px` for elevated product cards
- Borders: practically non-existent, use shadows or background color difference for depth

### Spacing System
- Base unit: 8px
- Scale: 2px, 4px, 5px, 6px, 7px, 8px, 9px, 10px, 11px, 14px, 15px, 17px, 20px, 24px

### Whitespace Philosophy
- **Cinematic breathing room**: Each product section occupies a full viewport height.
- **Vertical rhythm**: Use alternating background colors (black, `#f5f5f7`, white).
- **Compression within, expansion between**: Dense text blocks, vast surrounding space.

### Do
- Use SF Pro Display at 20px+ and SF Pro Text below 20px.
- Use Apple Blue (`#0071e3`) ONLY for interactive elements.
- Alternate between black and light gray (`#f5f5f7`) section backgrounds.
- Keep components clean, no heavy gradients/textures.

### Don't
- Don't construct multiple accent colors.
- Don't use heavy/multiple drop shadows.
- Don't use visible borders on cards.
- Don't center-align body text (only headlines).
- Don't push border radiuses pointlessly high except for pill buttons.
