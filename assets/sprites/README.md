# Unit Sprite Atlases

Each transparent PNG contains a 2 by 2 prototype unit atlas at 1254 by 1254 pixels.

| Cell | Unit role |
| --- | --- |
| Top left | Worker |
| Top right | Infantry |
| Bottom left | Light reconnaissance vehicle |
| Bottom right | Heavy vehicle |

The `*-units-source.png` files preserve the original chroma-key versions. The `*-units.png` files are the transparent runtime assets.

`UnitSpriteAtlas` maps the worker, infantry, light vehicle, and heavy vehicle game roles to these cells. Artillery reuses the heavy vehicle cell until it receives a dedicated sprite; aircraft continue using the procedural fallback.
