import { detectGeometry } from "./geometry";
self.onmessage = (
  event: MessageEvent<{ pixels: ArrayBuffer; width: number; height: number }>,
) => {
  try {
    self.postMessage({
      result: detectGeometry(
        new Uint8ClampedArray(event.data.pixels),
        event.data.width,
        event.data.height,
      ),
    });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Geometry analysis failed.",
    });
  }
};
