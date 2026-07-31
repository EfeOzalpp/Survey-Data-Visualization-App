# Sprite GPU Memory

System/browser GPU reporting measured with Chrome task manager at the 300-sprite cap showed:

| Configuration | GPU memory |
| --- | ---: |
| Quantization and material cache enabled | ~450 MB |
| Quantization and material cache disabled | ~650 MB |

The optimized path used approximately 200 MB less GPU memory.

The sprite cache remained enabled in both configurations because disabling it
caused texture-retention behavior and did not provide a stable comparison.
These are GPU-side observations, not JavaScript heap measurements.

Theme changes temporarily increased memory while light and dark sprite variants
entered the cache, but the observed growth approached a plateau rather than
continuing linearly.
