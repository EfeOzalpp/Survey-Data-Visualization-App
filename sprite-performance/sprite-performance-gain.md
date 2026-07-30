# Sprite Performance Memory Note

Chrome DevTools heap snapshot numbers for the first 3 seconds of initial 3D
scene load. These are JS/object-retention measurements, not GPU/VRAM numbers.

For GPU/VRAM: [GPU memory measurement](sprite-gpu-memory-note.md)

Why this still matters: the optimization here was about reducing sprite
material/texture churn, retained objects, and cache pressure on the JS side.
GPU memory should be measured separately with browser/WebGL tools or Task Manager.

With 80 visible shapes:

Without quantization and material caching:

| Constructor     | Shallow Size | Retained Size |
|----------------|--------------|---------------|
| SpriteMaterial | 78.7 KB      | 370 KB        |
| Sprite         | 22.4 KB      | 259 KB        |
| CanvasTexture  | 12.4 KB      | 248 KB        |
| Total          | 113.5 KB     | 877 KB        |

With quantization and material caching:

| Constructor     | Shallow Size | Retained Size |
|----------------|--------------|---------------|
| SpriteMaterial | 68.4 KB      | 315 KB        |
| Sprite         | 22.4 KB      | 259 KB        |
| CanvasTexture  | 9.2 KB       | 180 KB        |
| Total          | 100.0 KB     | 714 KB        |

Measured reduction:

- SpriteMaterial shallow size: `13.1%`
- SpriteMaterial retained size: `14.9%`
- CanvasTexture shallow size: `25.8%`
- CanvasTexture retained size: `27.4%`
- Total shallow size: `11.9%`
- Total retained size: `18.6%`

With 300 visible shapes:

Without quantization and material caching:

| Constructor     | Shallow Size | Retained Size |
|----------------|--------------|---------------|
| SpriteMaterial | 295 KB       | 1362 KB       |
| Sprite         | 84 KB        | 987 KB        |
| CanvasTexture  | 44.8 KB      | 878 KB        |

With quantization and material caching:

| Constructor     | Shallow Size | Retained Size |
|----------------|--------------|---------------|
| SpriteMaterial | 206 KB       | 976 KB        |
| Sprite         | 84 KB        | 944 KB        |
| CanvasTexture  | 18.1 KB      | 350 KB        |

Measured reduction:

- SpriteMaterial count: `25.0%` (`1200 -> 838`)
- SpriteMaterial shallow size: `30.2%`
- SpriteMaterial retained size: `28.3%`
- Sprite shallow size: `0.0%`
- Sprite retained size: `4.4%`
- CanvasTexture shallow size: `59.6%`
- CanvasTexture retained size: `60.1%`
